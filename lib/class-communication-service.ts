import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { argentinaClock, occurrenceClassName } from "@/lib/class-occurrences";
import { databaseDateKey, isDateKey } from "@/lib/payment-dates";
import { CLASS_REACTIONS, type ClassReaction, type feedbackInput } from "@/lib/class-communication";

type Db = Pick<PrismaClient, "classOccurrenceAttendance">;

function endedClasses(workspaceId: string): Prisma.ClassOccurrenceWhereInput {
  const now = argentinaClock();
  return { workspaceId, status: { not: "CANCELLED" }, OR: [{ date: { lt: new Date(now.date + "T00:00:00Z") } }, { date: new Date(now.date + "T00:00:00Z"), endTime: { lte: now.time } }] };
}

export function eligibleFeedback(studentId: string, workspaceId: string): Prisma.ClassOccurrenceAttendanceWhereInput {
  return { studentId, student: { workspaceId }, actualAttendance: "PRESENT", classFeedbackAt: null, classFeedbackSkippedAt: null, occurrence: endedClasses(workspaceId) };
}

export async function pendingClassFeedback(db: Db, studentId: string, workspaceId: string) {
  const row = await db.classOccurrenceAttendance.findFirst({ where: eligibleFeedback(studentId, workspaceId), include: { occurrence: true }, orderBy: [{ occurrence: { date: "desc" } }, { occurrence: { startTime: "desc" } }] });
  return row ? { occurrenceId: row.occurrenceId, date: databaseDateKey(row.occurrence.date), className: occurrenceClassName(row.occurrence), startTime: row.occurrence.startTime, endTime: row.occurrence.endTime } : null;
}

export async function submitClassFeedback(db: Db, studentId: string, workspaceId: string, input: ReturnType<typeof feedbackInput>) {
  const where = { ...eligibleFeedback(studentId, workspaceId), occurrenceId: input.occurrenceId };
  const existing = await db.classOccurrenceAttendance.findFirst({ where, select: { id: true, updatedAt: true } });
  if (!existing) return false;
  // Preserve the timestamp used by legacy attendance ordering. Compare it to avoid stale writes.
  // One conditional write: concurrent submissions cannot overwrite a rating or create duplicates.
  const result = await db.classOccurrenceAttendance.updateMany({
    where: { ...where, id: existing.id, updatedAt: existing.updatedAt },
    data: { updatedAt: existing.updatedAt, ...(input.skip ? { classFeedbackSkippedAt: new Date() } : { classRating: input.rating, classComment: input.comment, classFeedbackAt: new Date() }) },
  });
  return result.count === 1;
}

export async function reactToConfirmation(tx: Prisma.TransactionClient, workspaceId: string, id: string, reaction: ClassReaction) {
  const notification = await tx.trainerNotification.findFirst({ where: { id, workspaceId, type: "CLASS_RESPONSE", student: { workspaceId }, occurrence: { workspaceId } }, include: { occurrence: true } });
  if (!notification?.studentId || !notification.occurrence || !notification.response) return null;
  const label = CLASS_REACTIONS.find(item => item.value === reaction)!.label;
  await tx.trainerNotification.update({ where: { id: notification.id }, data: { reaction, reactedAt: new Date() } });
  const message = `${label}. Tu entrenador respondió a tu confirmación de ${notification.response === "GOING" ? "asistencia" : "inasistencia"} a ${occurrenceClassName(notification.occurrence)} del ${databaseDateKey(notification.occurrence.date)} a las ${notification.occurrence.startTime}.`;
  // Reuse one inbox item per confirmation. Changing a reaction never starts a conversation or sends push.
  await tx.studentNotification.upsert({ where: { eventKey: `class-reaction:${notification.id}` }, create: { studentId: notification.studentId, type: "FEEDBACK", eventKey: `class-reaction:${notification.id}`, title: "Respuesta de tu entrenador", message, url: "/portal/clases" }, update: { message } });
  return { reaction };
}

export function feedbackReportFilter(params: URLSearchParams) {
  const today = argentinaClock().date;
  const from = params.get("from") ?? today.slice(0, 7) + "-01";
  const to = params.get("to") ?? today;
  const q = (params.get("class") ?? "").trim();
  const page = Number(params.get("page") ?? 1);
  if (!isDateKey(from) || !isDateKey(to) || from > to || q.length > 120 || !Number.isSafeInteger(page) || page < 1) throw new Error("Seleccioná fechas y filtros válidos.");
  return { from, to, q, page };
}

export async function classOpinions(db: Db, workspaceId: string, filter: ReturnType<typeof feedbackReportFilter>) {
  const where: Prisma.ClassOccurrenceAttendanceWhereInput = {
    student: { workspaceId }, actualAttendance: "PRESENT", classRating: { not: null }, classFeedbackAt: { not: null },
    occurrence: { AND: [endedClasses(workspaceId), { date: { gte: new Date(filter.from + "T00:00:00Z"), lte: new Date(filter.to + "T00:00:00Z") } }, ...(filter.q ? [{ OR: [{ classNameSnapshot: { contains: filter.q, mode: "insensitive" as const } }, { categorySnapshot: { contains: filter.q, mode: "insensitive" as const } }] }] : [])] },
  };
  const [total, groups] = await Promise.all([
    db.classOccurrenceAttendance.count({ where }),
    db.classOccurrenceAttendance.groupBy({ by: ["occurrenceId", "classRating"], where, _count: { _all: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / 30)); const page = Math.min(filter.page, pages);
  const rows = await db.classOccurrenceAttendance.findMany({ where, include: { occurrence: true, student: { select: { data: true } } }, orderBy: [{ classFeedbackAt: "desc" }, { id: "asc" }], take: 30, skip: (page - 1) * 30 });
  const classes = [...new Map(rows.map(row => [row.occurrenceId, row.occurrence])).values()].map(occurrence => {
    const distribution = { EXCELLENT: 0, GOOD: 0, IMPROVE: 0 };
    for (const group of groups.filter(item => item.occurrenceId === occurrence.id)) if (group.classRating && group.classRating in distribution) distribution[group.classRating as keyof typeof distribution] += group._count._all;
    return { id: occurrence.id, date: databaseDateKey(occurrence.date), className: occurrenceClassName(occurrence), startTime: occurrence.startTime, distribution, count: Object.values(distribution).reduce((sum, count) => sum + count, 0), opinions: rows.filter(row => row.occurrenceId === occurrence.id).map(row => {
      const data = row.student.data as Record<string, unknown>;
      return { id: row.id, studentName: [data.firstName, data.lastName].filter(Boolean).join(" ") || "Alumno", rating: row.classRating, comment: row.classComment ?? "" };
    }) };
  });
  return { classes, total, page, pages };
}
