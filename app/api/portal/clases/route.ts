import { Prisma } from "@prisma/client";
import { argentinaClock, ensureClassOccurrences, occurrenceHasStarted, occurrenceStatusLabel } from "@/lib/class-occurrences";
import { databaseDateKey, dateKeyToDatabase } from "@/lib/payment-dates";
import { getPortalSession, validRequestOrigin } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const occurrenceInclude = (studentId: string) => ({
  responses: { where: { studentId }, select: { response: true } },
  _count: { select: { responses: { where: { response: "GOING" as const } } } },
  strengthBlock: { include: { exercises: { orderBy: { order: "asc" as const } } } },
  workoutLogs: {
    where: { studentId },
    include: { exercises: { orderBy: { order: "asc" as const }, include: { sets: { orderBy: { setNumber: "asc" as const } } } } },
  },
});

function serializeOccurrence(occurrence: Prisma.ClassOccurrenceGetPayload<{ include: ReturnType<typeof occurrenceInclude> }>) {
  const started = occurrenceHasStarted(occurrence.date, occurrence.startTime);
  const log = occurrence.workoutLogs[0] ?? null;
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
    strengthAvailable: occurrence.status !== "CANCELLED" && (occurrence.strengthEnabled || started),
    strengthBlock: occurrence.strengthBlock,
    workoutLog: log ? {
      id: log.id,
      status: log.status,
      notes: log.notes,
      exercises: log.exercises.map((exercise) => ({
        exerciseName: exercise.exerciseNameSnapshot,
        order: exercise.order,
        notes: exercise.notes,
        sets: exercise.sets.map((set) => ({
          setNumber: set.setNumber,
          weight: set.weight === null ? null : Number(set.weight),
          repetitions: set.repetitions,
          unit: set.unit,
          notes: set.notes,
        })),
      })),
    } : null,
  };
}

export async function GET() {
  const session = await getPortalSession();
  if (!session) return Response.json({ error: "Sesión vencida." }, { status: 401 });
  if (session.credential.mustChangePassword) return Response.json({ error: "Primero cambiá tu contraseña.", code: "PASSWORD_CHANGE_REQUIRED" }, { status: 403 });
  try {
    const range = await ensureClassOccurrences(35);
    const occurrences = await prisma.classOccurrence.findMany({
      where: {
        date: { gte: dateKeyToDatabase(range.from), lte: dateKeyToDatabase(range.to) },
        OR: [
          { schedule: { active: true } },
          { responses: { some: { studentId: session.studentId } } },
          { workoutLogs: { some: { studentId: session.studentId } } },
        ],
      },
      include: occurrenceInclude(session.studentId),
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });
    const history = await prisma.classWorkoutLog.findMany({
      where: { studentId: session.studentId, status: "COMPLETED" },
      include: { exercises: { orderBy: { order: "asc" }, include: { sets: { orderBy: { setNumber: "asc" } } } } },
      orderBy: { classDateSnapshot: "desc" },
      take: 20,
    });
    return Response.json({
      occurrences: occurrences.map(serializeOccurrence),
      history: history.map((log) => ({
        id: log.id,
        occurrenceId: log.occurrenceId,
        date: databaseDateKey(log.classDateSnapshot),
        name: log.classNameSnapshot,
        notes: log.notes,
        exercises: log.exercises.map((exercise) => ({
          exerciseName: exercise.exerciseNameSnapshot,
          order: exercise.order,
          notes: exercise.notes,
          sets: exercise.sets.map((set) => ({ setNumber: set.setNumber, weight: set.weight === null ? null : Number(set.weight), repetitions: set.repetitions, unit: set.unit, notes: set.notes })),
        })),
      })),
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
      const alreadyGoing = occurrence.responses[0]?.response === "GOING";
      if (requestedResponse === "GOING" && !alreadyGoing && occurrence.capacityOverride !== null && occurrence._count.responses >= occurrence.capacityOverride) throw new Error("FULL");
      await transaction.classOccurrenceAttendance.upsert({
        where: { occurrenceId_studentId: { occurrenceId: occurrence.id, studentId: session.studentId } },
        create: { occurrenceId: occurrence.id, studentId: session.studentId, response: requestedResponse, respondedAt: new Date() },
        update: { response: requestedResponse, respondedAt: new Date() },
      });
      return occurrence;
    }, { isolationLevel: "Serializable" });
    const day = new Date(`${databaseDateKey(result.date)}T12:00:00Z`).toLocaleDateString("es-AR", { weekday: "long", timeZone: "UTC" });
    return Response.json({
      message: requestedResponse === "GOING"
        ? `Asistencia confirmada para ${result.classNameSnapshot} · ${day} ${result.startTime}`
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
