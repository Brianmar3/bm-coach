import { Prisma } from "@prisma/client";
import { after } from "next/server";
import { argentinaClock, ensureClassOccurrences, occurrenceHasStarted, occurrenceStatusLabel } from "@/lib/class-occurrences";
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const occurrenceInclude = (studentId: string) => ({
  responses: { where: { studentId }, select: { response: true } },
  _count: { select: { responses: { where: { response: "GOING" as const } } } },
});

function serializeOccurrence(occurrence: Prisma.ClassOccurrenceGetPayload<{ include: ReturnType<typeof occurrenceInclude> }>) {
  const started = occurrenceHasStarted(occurrence.date, occurrence.startTime);
  return {
    id: occurrence.id,
    scheduleId: occurrence.scheduleId,
    date: databaseDateKey(occurrence.date),
    startTime: occurrence.startTime,
    endTime: occurrence.endTime,
    name: occurrence.classNameSnapshot,
    category: occurrence.categorySnapshot,
    status: occurrence.status,
    statusLabel: occurrenceStatusLabel(occurrence.status, started),
    capacity: occurrence.capacityOverride,
    confirmedCount: occurrence._count.responses,
    response: occurrence.responses[0]?.response ?? null,
    canRespond: occurrence.status === "SCHEDULED" && !started,
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
    const range = await ensureClassOccurrences(35);
    const schedules = await prisma.weeklyClassAssignment.findMany({ where: { studentId: session.studentId, active: true }, include: { schedule: true } });
    const occurrences = await prisma.classOccurrence.findMany({
      where: {
        date: { gte: dateKeyToDatabase(range.from), lte: dateKeyToDatabase(range.to) },
        OR: [
          { schedule: { active: true } },
          { responses: { some: { studentId: session.studentId } } },
        ],
      },
      include: occurrenceInclude(session.studentId),
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });
    return Response.json({
      scheduleLabels: schedules.map((item) => weeklyScheduleLabel(item.schedule)),
      flexibleSchedule: (session.credential.student.data as unknown as Student).flexibleSchedule ?? "",
      occurrences: occurrences.map(serializeOccurrence),
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
        include: { _count: { select: { responses: { where: { response: "GOING" } } } }, responses: { where: { studentId: session.studentId } } },
      });
      if (!occurrence) throw new Error("NOT_FOUND");
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
    if (result.changed && result.responseUpdatedAt) {
      const student = session.credential.student.data as unknown as Student;
      const notificationInput = {
        eventKey: `class-response:${occurrence.id}:${session.studentId}:${requestedResponse}:${result.responseUpdatedAt.toISOString()}`,
        studentId: session.studentId,
        studentName: `${student.firstName} ${student.lastName}`.trim(),
        occurrenceId: occurrence.id,
        scheduleId: occurrence.scheduleId,
        className: occurrence.classNameSnapshot,
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
        ? `Asistencia confirmada para ${occurrence.classNameSnapshot} · ${day} ${occurrence.startTime}`
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
