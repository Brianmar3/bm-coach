import { databaseUnavailable, exerciseData, serializeExercise, validateExercise, type ExerciseInput } from "@/lib/rutinas";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExerciseCreateInput = ExerciseInput & { dayNumber: number };

export async function GET(_request: Request, context: RouteContext<"/api/rutinas/[id]/ejercicios">) {
  try {
    const { id } = await context.params;
    const days = await prisma.trainingRoutineDay.findMany({ where: { routineId: id }, include: { exercises: { orderBy: { order: "asc" } } }, orderBy: { dayNumber: "asc" } });
    return Response.json(days.flatMap((day) => day.exercises.map((exercise) => ({ ...serializeExercise(exercise), dayNumber: day.dayNumber }))));
  } catch (error) {
    console.error("Error al consultar ejercicios", error);
    const unavailable = databaseUnavailable(error);
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudieron cargar los ejercicios desde Neon." }, { status: unavailable ? 503 : 500 });
  }
}

export async function POST(request: Request, context: RouteContext<"/api/rutinas/[id]/ejercicios">) {
  try {
    const { id } = await context.params;
    const input = (await request.json()) as ExerciseCreateInput;
    if (!Number.isInteger(input.dayNumber) || input.dayNumber < 1 || input.dayNumber > 7) return Response.json({ error: "El día debe estar entre 1 y 7." }, { status: 400 });
    const validationError = validateExercise(input);
    if (validationError) return Response.json({ error: validationError }, { status: 400 });
    const day = await prisma.trainingRoutineDay.findUnique({ where: { routineId_dayNumber: { routineId: id, dayNumber: input.dayNumber } } });
    if (!day) return Response.json({ error: "Rutina o día no encontrado." }, { status: 404 });
    const exercise = await prisma.trainingRoutineExercise.create({ data: { dayId: day.id, ...exerciseData(input) } });
    await prisma.trainingRoutine.update({ where: { id }, data: { updatedAt: new Date() } });
    return Response.json({ ...serializeExercise(exercise), dayNumber: input.dayNumber }, { status: 201 });
  } catch (error) {
    console.error("Error al crear ejercicio", error);
    const unavailable = databaseUnavailable(error);
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudo guardar el ejercicio en Neon." }, { status: unavailable ? 503 : 500 });
  }
}
