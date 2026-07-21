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
    const current = await prisma.trainingRoutineExercise.findFirst({ where: { id: exerciseId, day: { routineId: id } }, select: { id: true } });
    if (!current) return Response.json({ error: "Ejercicio no encontrado." }, { status: 404 });
    const day = await prisma.trainingRoutineDay.findUnique({ where: { routineId_dayNumber: { routineId: id, dayNumber: input.dayNumber } } });
    if (!day) return Response.json({ error: "Día no encontrado." }, { status: 404 });
    const exercise = await prisma.trainingRoutineExercise.update({ where: { id: exerciseId }, data: { dayId: day.id, ...exerciseData(input) } });
    await prisma.trainingRoutine.update({ where: { id }, data: { updatedAt: new Date() } });
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
    const exercise = await prisma.trainingRoutineExercise.findFirst({ where: { id: exerciseId, day: { routineId: id } }, select: { id: true } });
    if (!exercise) return Response.json({ error: "Ejercicio no encontrado." }, { status: 404 });
    await prisma.trainingRoutineExercise.delete({ where: { id: exerciseId } });
    await prisma.trainingRoutine.update({ where: { id }, data: { updatedAt: new Date() } });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (notFound(error)) return Response.json({ error: "Ejercicio no encontrado." }, { status: 404 });
    console.error("Error al eliminar ejercicio", error);
    const unavailable = databaseUnavailable(error);
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudo eliminar el ejercicio de Neon." }, { status: unavailable ? 503 : 500 });
  }
}
