import { databaseUnavailable, evaluationData, serializeEvaluation, validateEvaluation, type EvaluationInput } from "@/lib/evaluaciones";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { achievementCelebrationPayload, notifyNewAchievements } from "@/lib/push-notifications";
import { reconcileStudentPointsAfterMutation } from "@/lib/student-points";
import { evaluationInclude, normalizePhysicalEvaluation } from "@/lib/evaluation-persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function notFound(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

export async function GET(_request: Request, context: RouteContext<"/api/evaluaciones/[id]">) {
  try {
    const { id } = await context.params;
    const studentId = new URL(_request.url).searchParams.get("studentId")?.trim();
    const record = await prisma.physicalEvaluation.findFirst({ where: { id, ...(studentId ? { studentId } : {}) }, include: evaluationInclude });
    if (!record) return Response.json({ error: "Evaluación no encontrada." }, { status: 404 });
    return Response.json(normalizePhysicalEvaluation(record));
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

    const existing = await prisma.physicalEvaluation.findUnique({ where: { id }, select: { studentId: true, status: true } });
    if (!existing) return Response.json({ error: "Evaluación no encontrada." }, { status: 404 });
    if (existing.studentId !== input.studentId) return Response.json({ error: "No se puede cambiar el alumno de una evaluación existente." }, { status: 409 });
    if (existing.status !== "IN_PROGRESS") return Response.json({ error: "Una evaluación completada no puede editarse. Creá una nueva versión." }, { status: 409 });
    const duplicate = await prisma.physicalEvaluation.findFirst({ where: { id: { not: id }, studentId: input.studentId, date: evaluationData(input).date }, select: { id: true } });
    if (duplicate) return Response.json({ error: "Ya existe otra evaluación para ese alumno en esa fecha." }, { status: 409 });
    const record = await prisma.physicalEvaluation.update({
      where: { id },
      data: evaluationData(input),
      include: { student: true },
    });
    const claimedAchievements = await notifyNewAchievements(record.studentId);
    const pointResult = await reconcileStudentPointsAfterMutation(record.studentId);
    const newAchievements = await achievementCelebrationPayload(record.studentId, claimedAchievements);
    return Response.json({
      ...serializeEvaluation(record),
      newAchievements,
      pointsAwarded: pointResult?.gained.reduce((sum, item) => sum + item.points, 0) ?? 0,
    });
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

export async function DELETE(request: Request, context: RouteContext<"/api/evaluaciones/[id]">) {
  try {
    const { id } = await context.params;
    const studentId = new URL(request.url).searchParams.get("studentId")?.trim();
    if (!studentId) return Response.json({ error: "Falta identificar al alumno de la evaluación." }, { status: 400 });
    const evaluation = await prisma.physicalEvaluation.findFirst({ where: { id, studentId }, select: { id: true, status: true } });
    if (!evaluation) return Response.json({ error: "La evaluación no existe o no pertenece al alumno indicado." }, { status: 404 });
    if (evaluation.status !== "IN_PROGRESS") return Response.json({ error: "Solo pueden eliminarse borradores en curso." }, { status: 409 });
    await prisma.physicalEvaluation.delete({ where: { id: evaluation.id } });
    await reconcileStudentPointsAfterMutation(studentId);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (notFound(error)) return Response.json({ error: "Evaluación no encontrada." }, { status: 404 });
    console.error("Error al eliminar evaluación física", error);
    const unavailable = databaseUnavailable(error);
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudo eliminar la evaluación de Neon." }, { status: unavailable ? 503 : 500 });
  }
}
