import { databaseUnavailable, exerciseData, serializeExercise, validateExercise, type ExerciseInput } from "@/lib/rutinas";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExerciseUpdateInput = ExerciseInput & { dayNumber: number };
function notFound(error: unknown) { return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025"; }

export async function GET(_request: Request, context: RouteContext<"/api/rutinas/[id]/ejercicios/[exerciseId]">) {
  try {
    const { id, exerciseId } = await context.params;
    const exercise = await prisma.trainingRoutineExercise.findFirst({ where: { id: exerciseId, day: { routineId: id } }, include: { day: true } });
    if (!exercise) return Response.json({ error: "Ejercicio no encontrado." }, { status: 404 });
    return Response.json({ ...serializeExercise(exercise), dayNumber: exercise.day.dayNumber });
  } catch (error) {
    console.error("Error al consultar ejercicio", error);
    const unavailable = databaseUnavailable(error);
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudo cargar el ejercicio desde Neon." }, { status: unavailable ? 503 : 500 });
  }
}

export async function PUT(request: Request, context: RouteContext<"/api/rutinas/[id]/ejercicios/[exerciseId]">) {
  try {
    const { id, exerciseId } = await context.params;
    const input = (await request.json()) as ExerciseUpdateInput;
    if (!Number.isInteger(input.dayNumber) || input.dayNumber < 1 || input.dayNumber > 7) return Response.json({ error: "El día debe estar entre 1 y 7." }, { status: 400 });
    const validationError = validateExercise(input);
    if (validationError) return Response.json({ error: validationError }, { status: 400 });
    const current = await prisma.trainingRoutineExercise.findFirst({
      where: { id: exerciseId, active: true, day: { routineId: id, active: true, routine: { status: "ACTIVA" } } },
      select: { id: true, dayId: true, workoutLogs: { select: { id: true }, take: 1 } },
    });
    if (!current) return Response.json({ error: "Ejercicio no encontrado." }, { status: 404 });
    const day = await prisma.trainingRoutineDay.findFirst({ where: { routineId: id, dayNumber: input.dayNumber, active: true } });
    if (!day) return Response.json({ error: "Día no encontrado." }, { status: 404 });
    if (current.dayId !== day.id && current.workoutLogs.length) {
      return Response.json({ error: "No se puede mover de día un ejercicio con historial. Duplicalo en el nuevo día y archivá el anterior." }, { status: 409 });
    }
    const exercise = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.trainingRoutineExercise.update({ where: { id: exerciseId }, data: { dayId: day.id, ...exerciseData(input) } });
      await transaction.trainingRoutine.update({ where: { id }, data: { updatedAt: new Date() } });
      return updated;
    });
    return Response.json({ ...serializeExercise(exercise), dayNumber: input.dayNumber });
  } catch (error) {
    if (notFound(error)) return Response.json({ error: "Ejercicio no encontrado." }, { status: 404 });
    console.error("Error al actualizar ejercicio", error);
    const unavailable = databaseUnavailable(error);
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudo actualizar el ejercicio en Neon." }, { status: unavailable ? 503 : 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext<"/api/rutinas/[id]/ejercicios/[exerciseId]">) { return PUT(request, context); }

export async function DELETE(_request: Request, context: RouteContext<"/api/rutinas/[id]/ejercicios/[exerciseId]">) {
  try {
    const { id, exerciseId } = await context.params;
    const result = await prisma.$transaction(async (transaction) => {
      const exercise = await transaction.trainingRoutineExercise.findFirst({
        where: { id: exerciseId, day: { routineId: id } },
        include: {
          workoutLogs: { select: { id: true }, take: 1 },
          followUpComments: { select: { id: true }, take: 1 },
        },
      });
      if (!exercise) return null;
      const hasHistory = exercise.workoutLogs.length > 0 || exercise.followUpComments.length > 0;
      if (hasHistory) {
        await transaction.trainingRoutineExercise.update({
          where: { id: exerciseId },
          data: { active: false, archivedAt: new Date() },
        });
      } else {
        await transaction.trainingRoutineExercise.delete({ where: { id: exerciseId } });
      }
      await transaction.trainingRoutine.update({ where: { id }, data: { updatedAt: new Date() } });
      return hasHistory ? "archived" as const : "deleted" as const;
    });
    if (!result) return Response.json({ error: "Ejercicio no encontrado." }, { status: 404 });
    return Response.json({
      action: result,
      message: result === "archived" ? "Ejercicio archivado para conservar su historial." : "Ejercicio eliminado definitivamente.",
    });
  } catch (error) {
    if (notFound(error)) return Response.json({ error: "Ejercicio no encontrado." }, { status: 404 });
    console.error("Error al eliminar ejercicio", error);
    const unavailable = databaseUnavailable(error);
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudo eliminar el ejercicio de Neon." }, { status: unavailable ? 503 : 500 });
  }
}
