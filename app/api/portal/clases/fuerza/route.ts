import { occurrenceHasStarted } from "@/lib/class-occurrences";
import { getPortalSession, validRequestOrigin } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { loadStrengthAchievements } from "@/lib/strength-achievements";
import { bmTrainingActivityStart } from "@/lib/bm-training";
import type { Student } from "@/types/gestion";

export const runtime = "nodejs";

type SetInput = { setNumber?: unknown; weight?: unknown; repetitions?: unknown; effort?: unknown; notes?: unknown };
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
    const input = await request.json() as { logId?: unknown; occurrenceId?: unknown; status?: unknown; notes?: unknown; exercises?: unknown };
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
      const exerciseName = blockExercise?.exerciseName ?? (typeof exercise.exerciseName === "string" ? exercise.exerciseName.trim() : "");
      const order = blockExercise?.order ?? Number(exercise.order ?? index + 1);
      if (!exerciseName || exerciseName.length > 120 || !Number.isInteger(order) || order < 1 || !Array.isArray(exercise.sets) || exercise.sets.length > 20) throw new Error("INVALID");
      return {
        exerciseNameSnapshot: exerciseName,
        order,
        notes: typeof exercise.notes === "string" ? exercise.notes.trim().slice(0, 1000) : "",
        sets: (exercise.sets as SetInput[]).map((set, setIndex) => {
          const setNumber = Number(set.setNumber ?? setIndex + 1);
          const weight = finiteNumber(set.weight);
          const repetitions = finiteNumber(set.repetitions);
          const effort = finiteNumber(set.effort);
          if (!Number.isInteger(setNumber) || setNumber < 1 || Number.isNaN(weight) || Number.isNaN(repetitions) || Number.isNaN(effort) || (weight !== null && weight < 0) || (repetitions !== null && (!Number.isInteger(repetitions) || repetitions < 0)) || (effort !== null && (effort < 0 || effort > 10))) throw new Error("INVALID");
          return { setNumber, weight, repetitions, effort, unit: "kg", notes: typeof set.notes === "string" ? set.notes.trim().slice(0, 500) : "" };
        }),
      };
    });
    if (input.status === "COMPLETED" && (!exercises.length || exercises.every((exercise) => !exercise.sets.length))) {
      return Response.json({ error: "Agregá al menos un ejercicio y una serie antes de finalizar." }, { status: 400 });
    }
    const saved = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.classWorkoutLog.findUnique({ where: { occurrenceId_studentId: { occurrenceId: occurrence.id, studentId: session.studentId } } });
      if (typeof input.logId === "string" && (!existing || existing.id !== input.logId)) throw new Error("FORBIDDEN");
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
        await transaction.classExerciseLog.create({ data: { ...exercise, classWorkoutLogId: log.id, sets: { create: exercise.sets } } });
      }
      return { log, updated: Boolean(existing) };
    });
    const student = session.credential.student.data as unknown as Student;
    const achievements = saved.log.status === "COMPLETED"
      ? (await loadStrengthAchievements(session.studentId, new Date(`${bmTrainingActivityStart(student.joinedAt)}T12:00:00Z`))).filter((achievement) => achievement.sessionId === saved.log.id)
      : [];
    return Response.json({ id: saved.log.id, status: saved.log.status, achievements, message: saved.updated ? "Bloque de fuerza actualizado correctamente." : saved.log.status === "COMPLETED" ? "Registro de fuerza finalizado." : "Borrador guardado." });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID") return Response.json({ error: "Revisá los ejercicios, series, pesos, repeticiones y RIR." }, { status: 400 });
    if (error instanceof Error && error.message === "FORBIDDEN") return Response.json({ error: "No tenés permiso para modificar este registro." }, { status: 403 });
    console.error("No se pudo guardar el bloque de fuerza", error);
    return Response.json({ error: "No se pudo guardar. Tus cambios permanecen en pantalla." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const session = await getPortalSession();
  if (!session) return Response.json({ error: "Sesión vencida." }, { status: 401 });
  try {
    const input = await request.json().catch(() => null) as { logId?: unknown } | null;
    if (typeof input?.logId !== "string" || !input.logId.trim()) return Response.json({ error: "El bloque seleccionado no es válido." }, { status: 400 });
    const log = await prisma.classWorkoutLog.findUnique({ where: { id: input.logId }, select: { id: true, studentId: true } });
    if (!log) return Response.json({ error: "No se encontró el bloque." }, { status: 404 });
    if (log.studentId !== session.studentId) return Response.json({ error: "No tenés permiso para modificar este registro." }, { status: 403 });
    await prisma.$transaction((transaction) => transaction.classWorkoutLog.delete({ where: { id: log.id } }));
    return Response.json({ message: "Bloque eliminado correctamente." });
  } catch (error) {
    console.error("No se pudo eliminar el bloque de fuerza", error);
    return Response.json({ error: "No se pudo eliminar. Intentá nuevamente." }, { status: 500 });
  }
}
