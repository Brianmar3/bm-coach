import { databaseUnavailable, nestedDays, routineData, routineInclude, serializeRoutine, validateRoutine, type RoutineInput } from "@/lib/rutinas";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function notFound(error: unknown) { return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025"; }

export async function GET(_request: Request, context: RouteContext<"/api/rutinas/[id]">) {
  try {
    const { id } = await context.params;
    const record = await prisma.trainingRoutine.findUnique({ where: { id }, include: routineInclude });
    if (!record) return Response.json({ error: "Rutina no encontrada." }, { status: 404 });
    return Response.json(serializeRoutine(record));
  } catch (error) {
    console.error("Error al consultar rutina", error);
    const unavailable = databaseUnavailable(error);
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudo cargar la rutina desde Neon." }, { status: unavailable ? 503 : 500 });
  }
}

export async function PUT(request: Request, context: RouteContext<"/api/rutinas/[id]">) {
  try {
    const { id } = await context.params;
    const input = (await request.json()) as RoutineInput;
    const validationError = validateRoutine(input);
    if (validationError) return Response.json({ error: validationError }, { status: 400 });
    const students = await prisma.studentRecord.count({ where: { id: { in: input.studentIds } } });
    if (students !== input.studentIds.length) return Response.json({ error: "Uno o más alumnos seleccionados ya no existen." }, { status: 404 });

    const record = await prisma.$transaction(async (transaction) => {
      await transaction.trainingRoutineDay.deleteMany({ where: { routineId: id } });
      await transaction.trainingRoutineAssignment.deleteMany({ where: { routineId: id } });
      return transaction.trainingRoutine.update({
        where: { id },
        data: {
          ...routineData(input),
          days: { create: nestedDays(input.days) },
          assignments: { create: input.studentIds.map((studentId) => ({ studentId })) },
        },
        include: routineInclude,
      });
    });
    return Response.json(serializeRoutine(record));
  } catch (error) {
    if (notFound(error)) return Response.json({ error: "Rutina no encontrada." }, { status: 404 });
    console.error("Error al actualizar rutina", error);
    const unavailable = databaseUnavailable(error);
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudo actualizar la rutina en Neon." }, { status: unavailable ? 503 : 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext<"/api/rutinas/[id]">) { return PUT(request, context); }

export async function DELETE(_request: Request, context: RouteContext<"/api/rutinas/[id]">) {
  try {
    const { id } = await context.params;
    await prisma.trainingRoutine.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (notFound(error)) return Response.json({ error: "Rutina no encontrada." }, { status: 404 });
    console.error("Error al eliminar rutina", error);
    const unavailable = databaseUnavailable(error);
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudo eliminar la rutina de Neon." }, { status: unavailable ? 503 : 500 });
  }
}
