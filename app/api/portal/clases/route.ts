import { Prisma } from "@prisma/client";
import { after } from "next/server";
import { argentinaClock, ensureClassOccurrences, occurrenceClassName, occurrenceHasEnded, occurrenceHasStarted, occurrenceStatusLabel } from "@/lib/class-occurrences";
import { databaseDateKey, dateKeyToDatabase } from "@/lib/payment-dates";
import { getPortalSession, validRequestOrigin } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { weeklyScheduleLabel } from "@/lib/student-enrollment";
import {
  createAttendanceTrainerNotification,
  dispatchTrainerPush,
} from "@/lib/trainer-notifications";
import type { Student } from "@/types/gestion";
import { hasGroupClasses } from "@/lib/student-service";
import {
  classIsEligibleForStudent,
  PORTAL_CLASS_SEARCH_DAYS,
  selectActivePortalSchedules,
  selectPortalClassAgenda,
  studentClassAvailability,
} from "@/lib/portal-class-schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const occurrenceInclude = (studentId: string) => ({
  schedule: { select: { classType: true } },
  responses: { where: { studentId }, select: { response: true } },
  _count: { select: { responses: { where: { response: "GOING" as const } } } },
});

function serializeOccurrence(occurrence: Prisma.ClassOccurrenceGetPayload<{ include: ReturnType<typeof occurrenceInclude> }>) {
  const started = occurrenceHasStarted(occurrence.date, occurrence.startTime);
  const ended = occurrenceHasEnded(occurrence.date, occurrence.endTime);
  const response = occurrence.responses[0]?.response ?? null;
  const full = occurrence.capacityOverride !== null && occurrence._count.responses >= occurrence.capacityOverride;
  return {
    id: occurrence.id,
    scheduleId: occurrence.scheduleId,
    date: databaseDateKey(occurrence.date),
    startTime: occurrence.startTime,
    endTime: occurrence.endTime,
    name: occurrenceClassName(occurrence),
    category: occurrenceClassName(occurrence),
    status: occurrence.status,
    statusLabel: full && response !== "GOING" ? "Cupo completo" : occurrenceStatusLabel(occurrence.status, started, ended),
    capacity: occurrence.capacityOverride,
    confirmedCount: occurrence._count.responses,
    response,
    canRespond: occurrence.status === "SCHEDULED" && !started && (!full || response === "GOING"),
    strengthAvailable: false,
    strengthBlock: null,
    workoutLog: null,
  };
}

export async function GET() {
  const session = await getPortalSession();
  if (!session) return Response.json({ error: "Sesión vencida." }, { status: 401 });
  if (!hasGroupClasses(session.credential.student.serviceType)) return Response.json({ error: "Las clases grupales no están disponibles para tu servicio." }, { status: 403 });
  if (session.credential.mustChangePassword) return Response.json({ error: "Primero cambiá tu contraseña.", code: "PASSWORD_CHANGE_REQUIRED" }, { status: 403 });
  try {
    const student = session.credential.student.data as unknown as Student;
    const assignments = await prisma.weeklyClassAssignment.findMany({
      where: { studentId: session.studentId },
      include: { schedule: true },
    });
    const schedules = selectActivePortalSchedules(assignments);
    const scheduleLabels = schedules.map((item) => `${weeklyScheduleLabel(item.schedule)} · Vigente`);
    const availability = studentClassAvailability(student.status, student.lifecycleStatus);
    if (!availability.eligible) {
      const agenda = selectPortalClassAgenda([], student.studentType);
      return Response.json({
        availability,
        scheduleLabels,
        flexibleSchedule: student.flexibleSchedule ?? "",
        occurrences: [],
        focus: { ...agenda.focus, subtitle: availability.message ?? agenda.focus.subtitle },
        upcoming: agenda.upcoming,
        summary: agenda.summary,
      });
    }
    const range = await ensureClassOccurrences(PORTAL_CLASS_SEARCH_DAYS);
    const occurrences = await prisma.classOccurrence.findMany({
      where: {
        date: { gte: dateKeyToDatabase(range.from), lte: dateKeyToDatabase(range.to) },
        schedule: { active: true, archivedAt: null },
      },
      include: occurrenceInclude(session.studentId),
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });
    const agenda = selectPortalClassAgenda(occurrences.map(serializeOccurrence), student.studentType);
    return Response.json({
      availability,
      scheduleLabels,
      flexibleSchedule: student.flexibleSchedule ?? "",
      occurrences: agenda.occurrences,
      focus: agenda.focus,
      upcoming: agenda.upcoming,
      summary: agenda.summary,
    });
  } catch (error) {
    console.error("No se pudieron cargar las clases del portal", error);
    return Response.json({ error: "No se pudieron cargar las clases y horarios." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const session = await getPortalSession();
  if (!session) return Response.json({ error: "Sesión vencida." }, { status: 401 });
  if (!hasGroupClasses(session.credential.student.serviceType)) return Response.json({ error: "Las clases grupales no están disponibles para tu servicio." }, { status: 403 });
  const student = session.credential.student.data as unknown as Student;
  if (!studentClassAvailability(student.status, student.lifecycleStatus).eligible) return Response.json({ error: "Tu cuenta no tiene clases activas." }, { status: 403 });
  try {
    const input = await request.json() as { occurrenceId?: unknown; response?: unknown };
    if (typeof input.occurrenceId !== "string" || !["GOING", "NOT_GOING"].includes(String(input.response))) {
      return Response.json({ error: "La clase o la respuesta no son válidas." }, { status: 400 });
    }
    const occurrenceId = input.occurrenceId;
    const requestedResponse = input.response === "GOING" ? "GOING" : "NOT_GOING";
    const result = await prisma.$transaction(async (transaction) => {
      const occurrence = await transaction.classOccurrence.findUnique({
        where: { id: occurrenceId },
        include: {
          schedule: {
            select: {
              classType: true,
              active: true,
              archivedAt: true,
            },
          },
          _count: { select: { responses: { where: { response: "GOING" } } } },
          responses: { where: { studentId: session.studentId } },
        },
      });
      if (!occurrence) throw new Error("NOT_FOUND");
      if (!occurrence.schedule?.active || occurrence.schedule.archivedAt || !classIsEligibleForStudent(occurrence.schedule.classType, student.studentType)) throw new Error("NOT_FOUND");
      if (occurrence.status !== "SCHEDULED" || occurrenceHasStarted(occurrence.date, occurrence.startTime)) throw new Error("CLOSED");
      const previousResponse = occurrence.responses[0]?.response ?? null;
      const alreadyGoing = previousResponse === "GOING";
      if (requestedResponse === "GOING" && !alreadyGoing && occurrence.capacityOverride !== null && occurrence._count.responses >= occurrence.capacityOverride) throw new Error("FULL");
      if (previousResponse === requestedResponse) {
        return { occurrence, changed: false, responseUpdatedAt: null };
      }
      const savedResponse = await transaction.classOccurrenceAttendance.upsert({
        where: { occurrenceId_studentId: { occurrenceId: occurrence.id, studentId: session.studentId } },
        create: { occurrenceId: occurrence.id, studentId: session.studentId, response: requestedResponse, respondedAt: new Date() },
        update: { response: requestedResponse, respondedAt: new Date() },
      });
      return { occurrence, changed: true, responseUpdatedAt: savedResponse.updatedAt };
    }, { isolationLevel: "Serializable" });
    const occurrence = result.occurrence;
    const className = occurrenceClassName(occurrence);
    if (result.changed && result.responseUpdatedAt) {
      const notificationInput = {
        eventKey: `class-response:${occurrence.id}:${session.studentId}:${requestedResponse}:${result.responseUpdatedAt.toISOString()}`,
        studentId: session.studentId,
        studentName: `${student.firstName} ${student.lastName}`.trim(),
        occurrenceId: occurrence.id,
        scheduleId: occurrence.scheduleId,
        className,
        classDateKey: databaseDateKey(occurrence.date),
        startTime: occurrence.startTime,
        response: requestedResponse,
      } as const;
      const queuedNotification =
        await createAttendanceTrainerNotification(notificationInput);
      if (queuedNotification) {
        after(async () => {
          await dispatchTrainerPush(
            queuedNotification.notification.id,
            queuedNotification.payload,
          );
        });
      }
    }
    const day = new Date(`${databaseDateKey(occurrence.date)}T12:00:00Z`).toLocaleDateString("es-AR", { weekday: "long", timeZone: "UTC" });
    return Response.json({
      message: requestedResponse === "GOING"
        ? `Asistencia confirmada para ${className} · ${day} ${occurrence.startTime}`
        : "Tu asistencia fue cancelada.",
      savedAt: argentinaClock(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "NOT_FOUND") return Response.json({ error: "La clase ya no existe." }, { status: 404 });
    if (message === "CLOSED") return Response.json({ error: "La respuesta ya no puede modificarse porque la clase comenzó o finalizó." }, { status: 409 });
    if (message === "FULL") return Response.json({ error: "La clase ya alcanzó el cupo disponible." }, { status: 409 });
    console.error("No se pudo guardar la confirmación de clase", error);
    return Response.json({ error: "No se pudo guardar tu respuesta." }, { status: 500 });
  }
}
