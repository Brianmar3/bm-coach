import { prisma } from "@/lib/prisma";
import { getPortalSession, validRequestOrigin } from "@/lib/portal-auth";
import { dateKeyToDatabase, isDateKey } from "@/lib/payment-dates";
import type { PortalWorkoutSession } from "@/types/portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function rating(value: number | null) {
  return value === null || (Number.isInteger(value) && value >= 1 && value <= 5);
}

function validate(input: PortalWorkoutSession) {
  if (!input.routineId || !input.dayId || !isDateKey(input.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.startTime)) return "Completá rutina, día, fecha y hora.";
  if (input.durationMinutes !== null && (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 1 || input.durationMinutes > 1440)) return "La duración debe estar entre 1 y 1440 minutos.";
  if (![input.energyBefore, input.difficulty, input.energyAfter].every(rating)) return "Las escalas de energía y dificultad deben estar entre 1 y 5.";
  if (input.hasPain && !input.painDetails.trim()) return "Contanos dónde sentís dolor o molestia.";
  if (input.finalComment.length > 2000 || input.painDetails.length > 1000) return "El comentario es demasiado extenso.";
  if (!["pendiente", "en_progreso", "finalizado"].includes(input.status)) return "El estado no es válido.";
  for (const exercise of input.exercises) {
    if (!exercise.exerciseId || exercise.observation.length > 1000) return "Los datos del ejercicio no son válidos.";
    for (const set of exercise.sets) {
      if (!Number.isInteger(set.setNumber) || set.setNumber < 1 || set.setNumber > 100) return "El número de serie no es válido.";
      if (set.weight !== null && (!Number.isFinite(set.weight) || set.weight < 0 || set.weight > 1000)) return "El peso debe estar entre 0 y 1000 kg.";
      if (set.repetitions !== null && (!Number.isInteger(set.repetitions) || set.repetitions < 0 || set.repetitions > 1000)) return "Las repeticiones no son válidas.";
      if (set.effort !== null && (!Number.isFinite(set.effort) || set.effort < 0 || set.effort > 10)) return "El esfuerzo debe estar entre 0 y 10.";
      if (set.observation.length > 500) return "La observación de una serie es demasiado extensa.";
    }
  }
  return null;
}

export async function POST(request: Request) {
  try {
    if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
    const session = await getPortalSession();
    if (!session) return Response.json({ error: "Sesión no válida." }, { status: 401 });
    if (session.credential.mustChangePassword) return Response.json({ error: "Debés cambiar tu contraseña temporal." }, { status: 403 });
    const input = await request.json() as PortalWorkoutSession;
    const validationError = validate(input);
    if (validationError) return Response.json({ error: validationError }, { status: 400 });

    const assignment = await prisma.trainingRoutineAssignment.findUnique({
      where: { routineId_studentId: { routineId: input.routineId, studentId: session.studentId } },
      include: { routine: { include: { days: { include: { exercises: true } } } } },
    });
    const day = assignment?.routine.days.find((item) => item.id === input.dayId);
    if (!assignment || !day) return Response.json({ error: "La rutina o el día ya no están asignados a tu perfil." }, { status: 403 });
    const validExerciseIds = new Set(day.exercises.map((exercise) => exercise.id));
    if (input.exercises.some((exercise) => !validExerciseIds.has(exercise.exerciseId))) return Response.json({ error: "Uno de los ejercicios no pertenece a tu rutina." }, { status: 403 });

    const saved = await prisma.$transaction(async (transaction) => {
      if (input.id) {
        const existing = await transaction.workoutSession.findFirst({ where: { id: input.id, studentId: session.studentId }, select: { id: true } });
        if (!existing) throw new Error("NOT_FOUND");
        await transaction.workoutExerciseLog.deleteMany({ where: { sessionId: existing.id } });
      }
      const data = {
        studentId: session.studentId,
        routineId: input.routineId,
        dayId: input.dayId,
        date: dateKeyToDatabase(input.date),
        startTime: input.startTime,
        durationMinutes: input.durationMinutes,
        energyBefore: input.energyBefore,
        difficulty: input.difficulty,
        energyAfter: input.energyAfter,
        finalComment: input.finalComment.trim(),
        hasPain: input.hasPain,
        painDetails: input.painDetails.trim(),
        status: input.status === "finalizado" ? "COMPLETED" as const : input.status === "en_progreso" ? "IN_PROGRESS" as const : "PENDING" as const,
        exercises: {
          create: input.exercises.map((exercise) => ({
            exerciseId: exercise.exerciseId,
            observation: exercise.observation.trim(),
            sets: { create: exercise.sets.map((set) => ({ setNumber: set.setNumber, weight: set.weight, repetitions: set.repetitions, effort: set.effort, completed: set.completed, observation: set.observation.trim() })) },
          })),
        },
      };
      return input.id
        ? transaction.workoutSession.update({ where: { id: input.id }, data })
        : transaction.workoutSession.create({ data });
    });
    return Response.json({ id: saved.id, status: input.status });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") return Response.json({ error: "El entrenamiento ya no existe o no te pertenece." }, { status: 404 });
    console.error("Error al guardar entrenamiento del portal", error);
    return Response.json({ error: "No se pudo guardar el entrenamiento." }, { status: 500 });
  }
}
