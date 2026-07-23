import { databaseUnavailable, nestedDays, routineInclude, serializeRoutine, type ExerciseInput } from "@/lib/rutinas";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: RouteContext<"/api/rutinas/[id]/duplicar">) {
  try {
    const { id } = await context.params;
    const source = await prisma.trainingRoutine.findUnique({ where: { id }, include: routineInclude });
    if (!source) return Response.json({ error: "Rutina no encontrada." }, { status: 404 });
    const days = source.days.map((day) => ({
      dayNumber: day.dayNumber,
      exercises: day.exercises.map((exercise): ExerciseInput => ({
        name: exercise.name,
        muscleGroup: exercise.muscleGroup,
        sets: exercise.sets,
        repetitions: exercise.repetitions,
        weight: exercise.weight === null ? null : Number(exercise.weight),
        effortType: exercise.effortType,
        effortValue: exercise.effortValue === null ? null : Number(exercise.effortValue),
        restSeconds: exercise.restSeconds,
        observations: exercise.observations,
        videoUrl: exercise.videoUrl ?? "",
        order: exercise.order,
      })),
    }));
    const copy = await prisma.trainingRoutine.create({
      data: {
        name: `${source.name} (copia)`,
        objective: source.objective,
        level: source.level,
        status: "ACTIVA",
        archivedAt: null,
        days: { create: nestedDays(days) },
      },
      include: routineInclude,
    });
    return Response.json(serializeRoutine(copy), { status: 201 });
  } catch (error) {
    console.error("Error al duplicar rutina", error);
    const unavailable = databaseUnavailable(error);
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudo duplicar la rutina en Neon." }, { status: unavailable ? 503 : 500 });
  }
}
