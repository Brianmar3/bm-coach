import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { argentinaClock, occurrenceClassName } from "@/lib/class-occurrences";
import { argentinaDateTimeBoundary, databaseDateKey, isDateKey } from "@/lib/payment-dates";
import { CLASS_REACTIONS, type ClassReaction, type feedbackInput } from "@/lib/class-communication";

type Db = Pick<PrismaClient, "classOccurrenceAttendance">;

function endedClasses(workspaceId: string): Prisma.ClassOccurrenceWhereInput {
  const now = argentinaClock();
  return { workspaceId, status: { not: "CANCELLED" }, OR: [{ date: { lt: new Date(now.date + "T00:00:00Z") } }, { date: new Date(now.date + "T00:00:00Z"), endTime: { lte: now.time } }] };
}

function feedbackClasses(workspaceId: string, now = new Date()): Prisma.ClassOccurrenceWhereInput {
  const upper = argentinaClock(now), lower = argentinaClock(new Date(now.getTime() - 86_400_000));
  const lowerDate = new Date(lower.date + "T00:00:00Z"), upperDate = new Date(upper.date + "T00:00:00Z");
  return { workspaceId, status: { not: "CANCELLED" }, AND: [
    { date: { gte: lowerDate, lte: upperDate } },
    { OR: [{ date: { gt: lowerDate } }, { date: lowerDate, endTime: { gt: lower.time } }] },
    { OR: [{ date: { lt: upperDate } }, { date: upperDate, endTime: { lte: upper.time } }] },
  ] };
}

function feedbackDeadline(occurrence: { date: Date; startTime: string; endTime: string }) {
  // Occurrences store a civil date and HH:mm local times, not a completion timestamp.
  // Overnight/invalid intervals cannot be inferred reliably and are ineligible.
  const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (!time.test(occurrence.startTime) || !time.test(occurrence.endTime) || occurrence.endTime <= occurrence.startTime) return null;
  return new Date(new Date(databaseDateKey(occurrence.date) + "T" + occurrence.endTime + ":00-03:00").getTime() + 86_400_000);
}

export function eligibleFeedback(studentId: string, workspaceId: string): Prisma.ClassOccurrenceAttendanceWhereInput {
  return { studentId, student: { workspaceId }, actualAttendance: "PRESENT", classFeedbackAt: null, classFeedbackSkippedAt: null, occurrence: feedbackClasses(workspaceId) };
}

export async function availableClassFeedback(db: Db, studentId: string, workspaceId: string) {
  const rows = await db.classOccurrenceAttendance.findMany({
    where: eligibleFeedback(studentId, workspaceId),
    select: { occurrenceId: true, occurrence: true },
    orderBy: [{ occurrence: { date: "desc" } }, { occurrence: { startTime: "desc" } }, { id: "asc" }],
  });
  const now = Date.now();
  return rows.flatMap(({ occurrenceId, occurrence }) => {
    const deadline = feedbackDeadline(occurrence);
    if (!deadline || deadline.getTime() <= now) return [];
    return [{ occurrenceId, date: databaseDateKey(occurrence.date), className: occurrenceClassName(occurrence), startTime: occurrence.startTime, endTime: occurrence.endTime }];
  });
}

export async function submitClassFeedback(db: Db, studentId: string, workspaceId: string, input: ReturnType<typeof feedbackInput>) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const where = { ...eligibleFeedback(studentId, workspaceId), occurrenceId: input.occurrenceId };
    const existing = await db.classOccurrenceAttendance.findFirst({ where, include: { occurrence: true } });
    if (!existing) return false;
    const expiresAt = feedbackDeadline(existing.occurrence);
    const now = new Date();
    if (!expiresAt || expiresAt.getTime() <= now.getTime()) return false;
    // Preserve attendance chronology; retry a concurrent attendance update instead of
    // reporting it as an already answered invitation when nothing was persisted.
    const result = await db.classOccurrenceAttendance.updateMany({
      where: { ...eligibleFeedback(studentId, workspaceId), occurrenceId: input.occurrenceId, id: existing.id, updatedAt: existing.updatedAt, occurrence: { AND: [feedbackClasses(workspaceId), { date: existing.occurrence.date, startTime: existing.occurrence.startTime, endTime: existing.occurrence.endTime }] } },
      data: { updatedAt: existing.updatedAt, ...(input.skip ? { classFeedbackSkippedAt: now } : { classRating: input.rating, classComment: input.comment, classFeedbackAt: now }) },
    });
    if (result.count === 1) return true;
  }
  if (!await db.classOccurrenceAttendance.findFirst({ where: { ...eligibleFeedback(studentId, workspaceId), occurrenceId: input.occurrenceId }, select: { id: true } })) return false;
  throw new Error("No se pudo guardar la opinión por una actualización simultánea. Volvé a intentar.");
}

export async function reactToConfirmation(tx: Prisma.TransactionClient, workspaceId: string, id: string, reaction: ClassReaction) {
  const notification = await tx.trainerNotification.findFirst({ where: { id, workspaceId, type: "CLASS_RESPONSE", student: { workspaceId }, occurrence: { workspaceId } }, include: { occurrence: true } });
  if (!notification?.studentId || !notification.occurrence || !notification.response) return null;
  const label = CLASS_REACTIONS.find(item => item.value === reaction)!.label;
  const now = new Date();
  const readAt = notification.readAt ?? now;
  await tx.trainerNotification.update({ where: { id: notification.id }, data: { reaction, reactedAt: now, readAt } });
  const message = `${label}. Tu entrenador respondió a tu confirmación de ${notification.response === "GOING" ? "asistencia" : "inasistencia"} a ${occurrenceClassName(notification.occurrence)} del ${databaseDateKey(notification.occurrence.date)} a las ${notification.occurrence.startTime}.`;
  // Reuse one inbox item per confirmation. Changing a reaction never starts a conversation or sends push.
  await tx.studentNotification.upsert({ where: { eventKey: `class-reaction:${notification.id}` }, create: { studentId: notification.studentId, type: "FEEDBACK", eventKey: `class-reaction:${notification.id}`, title: "Respuesta de tu entrenador", message, url: "/portal/clases" }, update: { message } });
  const unreadCount = await tx.trainerNotification.count({ where: { workspaceId, readAt: null } });
  return { reaction, readAt: readAt.toISOString(), unreadCount };
}

export function feedbackReportFilter(params: URLSearchParams) {
  const today = argentinaClock().date;
  const from = params.get("from") ?? today.slice(0, 7) + "-01";
  const to = params.get("to") ?? today;
  const q = (params.get("class") ?? "").trim();
  const page = Number(params.get("page") ?? 1);
  const receivedOn = params.get("receivedOn") ?? "";
  const comments = params.get("comments") ?? "improve";
  if (!["improve", "positive"].includes(comments)) throw new Error("Seleccioná filtros válidos.");
  if (receivedOn && !isDateKey(receivedOn)) throw new Error("Seleccioná filtros válidos.");
  if (!isDateKey(from) || !isDateKey(to) || from > to || q.length > 120 || !Number.isSafeInteger(page) || page < 1) throw new Error("Seleccioná fechas y filtros válidos.");
  return { from, to, q, page, receivedOn, comments };
}

export async function classOpinions(db: Db, workspaceId: string, filter: ReturnType<typeof feedbackReportFilter>) {
  const where: Prisma.ClassOccurrenceAttendanceWhereInput = {
    student: { workspaceId }, actualAttendance: "PRESENT", classRating: { not: null },
    classFeedbackAt: filter.receivedOn ? receivedDayBounds(filter.receivedOn) : { not: null },
    occurrence: { AND: [endedClasses(workspaceId),
      ...(!filter.receivedOn ? [{ date: { gte: new Date(filter.from + "T00:00:00Z"), lte: new Date(filter.to + "T00:00:00Z") } }] : []),
      ...(filter.q ? [{ OR: [{ classNameSnapshot: { contains: filter.q, mode: "insensitive" as const } }, { categorySnapshot: { contains: filter.q, mode: "insensitive" as const } }] }] : []),
    ] },
  };
  const commentsWhere: Prisma.ClassOccurrenceAttendanceWhereInput = { ...where,
    classRating: filter.comments === "positive" ? { in: ["EXCELLENT", "GOOD"] } : "IMPROVE",
    classComment: { not: null, notIn: [""] },
  };
  const [groups, commentTotal] = await Promise.all([
    db.classOccurrenceAttendance.groupBy({ by: ["classRating"], where, _count: { _all: true } }),
    db.classOccurrenceAttendance.count({ where: commentsWhere }),
  ]);
  const distribution = { EXCELLENT: 0, GOOD: 0, IMPROVE: 0 };
  for (const group of groups) if (group.classRating && group.classRating in distribution) distribution[group.classRating as keyof typeof distribution] += group._count._all;
  const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);
  const pages = Math.max(1, Math.ceil(commentTotal / 30)), page = Math.min(filter.page, pages);
  const rows = await db.classOccurrenceAttendance.findMany({ where: commentsWhere,
    select: { id: true, classRating: true, classComment: true, occurrence: { select: { date: true, startTime: true, classNameSnapshot: true, categorySnapshot: true, status: true } } },
    orderBy: [{ classFeedbackAt: "desc" }, { id: "asc" }], take: 30, skip: (page - 1) * 30,
  });
  return { total, distribution, commentTotal, page, pages, comments: rows.map(row => ({ id: row.id,
    className: occurrenceClassName(row.occurrence), date: databaseDateKey(row.occurrence.date), startTime: row.occurrence.startTime,
    rating: row.classRating, comment: row.classComment!,
  })) };
}

function receivedDayBounds(today: string) {
  const next = new Date(today + "T12:00:00Z"); next.setUTCDate(next.getUTCDate() + 1);
  return { gte: argentinaDateTimeBoundary(today), lt: argentinaDateTimeBoundary(databaseDateKey(next)) };
}

export async function classOpinionsReceivedToday(db: Db, workspaceId: string, today = argentinaClock().date) {
  const groups = await db.classOccurrenceAttendance.groupBy({
    by: ["classRating"],
    where: { student: { workspaceId }, occurrence: { workspaceId }, classRating: { not: null }, classFeedbackAt: receivedDayBounds(today) },
    _count: { _all: true },
  });
  return { total: groups.reduce((sum, group) => sum + group._count._all, 0), improve: groups.find(group => group.classRating === "IMPROVE")?._count._all ?? 0 };
}
