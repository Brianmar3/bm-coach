import { databaseUnavailable, evaluationData, serializeEvaluation, validateEvaluation, type EvaluationInput } from "@/lib/evaluaciones";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function notFound(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

export async function GET(_request: Request, context: RouteContext<"/api/evaluaciones/[id]">) {
  try {
    const { id } = await context.params;
    const record = await prisma.physicalEvaluation.findUnique({ where: { id }, include: { student: true } });
    if (!record) return Response.json({ error: "Evaluación no encontrada." }, { status: 404 });
    return Response.json(serializeEvaluation(record));
  } catch (error) {
    console.error("Error al consultar evaluación física", error);
    const unavailable = databaseUnavailable(error);
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudo cargar la evaluación desde Neon." }, { status: unavailable ? 503 : 500 });
  }
}

export async function PUT(request: Request, context: RouteContext<"/api/evaluaciones/[id]">) {
  try {
    const { id } = await context.params;
    const input = (await request.json()) as EvaluationInput;
    const validationError = validateEvaluation(input);
    if (validationError) return Response.json({ error: validationError }, { status: 400 });

    const student = await prisma.studentRecord.findUnique({ where: { id: input.studentId }, select: { id: true } });
    if (!student) return Response.json({ error: "El alumno seleccionado no existe." }, { status: 404 });

    const record = await prisma.physicalEvaluation.update({
      where: { id },
      data: evaluationData(input),
      include: { student: true },
    });
    return Response.json(serializeEvaluation(record));
  } catch (error) {
    if (notFound(error)) return Response.json({ error: "Evaluación no encontrada." }, { status: 404 });
    console.error("Error al actualizar evaluación física", error);
    const unavailable = databaseUnavailable(error);
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudo actualizar la evaluación en Neon." }, { status: unavailable ? 503 : 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext<"/api/evaluaciones/[id]">) {
  return PUT(request, context);
}

export async function DELETE(_request: Request, context: RouteContext<"/api/evaluaciones/[id]">) {
  try {
    const { id } = await context.params;
    await prisma.physicalEvaluation.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (notFound(error)) return Response.json({ error: "Evaluación no encontrada." }, { status: 404 });
    console.error("Error al eliminar evaluación física", error);
    const unavailable = databaseUnavailable(error);
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudo eliminar la evaluación de Neon." }, { status: unavailable ? 503 : 500 });
  }
}
