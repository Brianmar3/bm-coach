import { occurrenceHasStarted } from "@/lib/class-occurrences";
import { getPortalSession, validRequestOrigin } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type SetInput = { setNumber?: unknown; weight?: unknown; repetitions?: unknown; notes?: unknown };
type ExerciseInput = { blockExerciseId?: unknown; exerciseName?: unknown; order?: unknown; notes?: unknown; sets?: unknown };

function finiteNumber(value: unknown) {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const session = await getPortalSession();
  if (!session) return Response.json({ error: "Sesión vencida." }, { status: 401 });
  try {
    const input = await request.json() as { occurrenceId?: unknown; status?: unknown; notes?: unknown; exercises?: unknown };
    if (typeof input.occurrenceId !== "string" || !["DRAFT", "COMPLETED"].includes(String(input.status)) || !Array.isArray(input.exercises) || input.exercises.length > 30) {
      return Response.json({ error: "El registro de fuerza no es válido." }, { status: 400 });
    }
    const occurrence = await prisma.classOccurrence.findUnique({
      where: { id: input.occurrenceId },
      include: { strengthBlock: { include: { exercises: true } } },
    });
    if (!occurrence) return Response.json({ error: "La clase no existe." }, { status: 404 });
    if (occurrence.status === "CANCELLED" || (!occurrence.strengthEnabled && !occurrenceHasStarted(occurrence.date, occurrence.startTime))) {
      return Response.json({ error: "El registro de fuerza todavía no está habilitado." }, { status: 409 });
    }
    const blockById = new Map(occurrence.strengthBlock?.exercises.map((exercise) => [exercise.id, exercise]) ?? []);
    const exercises = (input.exercises as ExerciseInput[]).map((exercise, index) => {
      const blockExercise = typeof exercise.blockExerciseId === "string" ? blockById.get(exercise.blockExerciseId) : undefined;
      const name = blockExercise?.exerciseName ?? (typeof exercise.exerciseName === "string" ? exercise.exerciseName.trim() : "");
      const order = blockExercise?.order ?? Number(exercise.order ?? index + 1);
      if (!name || name.length > 120 || !Number.isInteger(order) || order < 1 || !Array.isArray(exercise.sets) || exercise.sets.length > 20) throw new Error("INVALID");
      return {
        exerciseNameSnapshot: name,
        order,
        notes: typeof exercise.notes === "string" ? exercise.notes.trim().slice(0, 1000) : "",
        sets: (exercise.sets as SetInput[]).map((set, setIndex) => {
          const setNumber = Number(set.setNumber ?? setIndex + 1);
          const weight = finiteNumber(set.weight);
          const repetitions = finiteNumber(set.repetitions);
          if (!Number.isInteger(setNumber) || setNumber < 1 || Number.isNaN(weight) || Number.isNaN(repetitions) || (weight !== null && weight < 0) || (repetitions !== null && (!Number.isInteger(repetitions) || repetitions < 0))) throw new Error("INVALID");
          return { setNumber, weight, repetitions, unit: "kg", notes: typeof set.notes === "string" ? set.notes.trim().slice(0, 500) : "" };
        }),
      };
    });
    if (input.status === "COMPLETED" && (!exercises.length || exercises.every((exercise) => !exercise.sets.length))) {
      return Response.json({ error: "Agregá al menos un ejercicio y una serie antes de finalizar." }, { status: 400 });
    }
    const saved = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.classWorkoutLog.findUnique({ where: { occurrenceId_studentId: { occurrenceId: occurrence.id, studentId: session.studentId } } });
      const data = {
        classNameSnapshot: occurrence.classNameSnapshot,
        classDateSnapshot: occurrence.date,
        status: input.status === "COMPLETED" ? "COMPLETED" as const : "DRAFT" as const,
        notes: typeof input.notes === "string" ? input.notes.trim().slice(0, 2000) : "",
        completedAt: input.status === "COMPLETED" ? new Date() : null,
      };
      const log = existing
        ? await transaction.classWorkoutLog.update({ where: { id: existing.id }, data })
        : await transaction.classWorkoutLog.create({ data: { ...data, occurrenceId: occurrence.id, studentId: session.studentId } });
      await transaction.classExerciseLog.deleteMany({ where: { classWorkoutLogId: log.id } });
      for (const exercise of exercises) {
        await transaction.classExerciseLog.create({
          data: { ...exercise, classWorkoutLogId: log.id, sets: { create: exercise.sets } },
        });
      }
      return log;
    });
    return Response.json({ id: saved.id, status: saved.status, message: saved.status === "COMPLETED" ? "Registro de fuerza finalizado." : "Borrador guardado." });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID") return Response.json({ error: "Revisá los ejercicios, series, pesos y repeticiones." }, { status: 400 });
    console.error("No se pudo guardar el bloque de fuerza", error);
    return Response.json({ error: "No se pudo guardar el registro de fuerza." }, { status: 500 });
  }
}
