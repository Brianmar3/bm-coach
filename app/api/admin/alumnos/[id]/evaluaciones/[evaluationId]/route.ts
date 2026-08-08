import { requireAdminApiResponse } from "@/lib/admin-api-auth";
import { evaluationInclude, serializeWorkflowEvaluation, workflowUpdateData } from "@/lib/evaluation-persistence";
import { prisma } from "@/lib/prisma";
import type { EvaluationDraftInput } from "@/types/evaluation-workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function findEvaluation(studentId: string, evaluationId: string) {
  return prisma.physicalEvaluation.findFirst({ where: { id: evaluationId, studentId }, include: evaluationInclude });
}

export async function GET(_request: Request, context: RouteContext<"/api/admin/alumnos/[id]/evaluaciones/[evaluationId]">) {
  const unauthorized = await requireAdminApiResponse();
  if (unauthorized) return unauthorized;
  const { id: studentId, evaluationId } = await context.params;
  const record = await findEvaluation(studentId, evaluationId);
  if (!record) return Response.json({ error: "La evaluación no existe o no pertenece al alumno indicado." }, { status: 404 });
  return Response.json(serializeWorkflowEvaluation(record));
}

export async function PUT(request: Request, context: RouteContext<"/api/admin/alumnos/[id]/evaluaciones/[evaluationId]">) {
  const unauthorized = await requireAdminApiResponse();
  if (unauthorized) return unauthorized;
  const { id: studentId, evaluationId } = await context.params;
  const input = await request.json().catch(() => null) as EvaluationDraftInput | null;
  if (!input || input.studentId !== studentId) return Response.json({ error: "Los datos no corresponden al alumno indicado." }, { status: 400 });
  const parsed = workflowUpdateData(input);
  if (parsed.error || !parsed.data) return Response.json({ error: parsed.error ?? "Los datos no son válidos." }, { status: 400 });
  const existing = await prisma.physicalEvaluation.findFirst({ where: { id: evaluationId, studentId }, select: { id: true, status: true } });
  if (!existing) return Response.json({ error: "La evaluación no existe o no pertenece al alumno indicado." }, { status: 404 });
  if (existing.status !== "IN_PROGRESS") return Response.json({ error: "Una evaluación completada no puede editarse. Creá una nueva versión." }, { status: 409 });
  try {
    const record = await prisma.physicalEvaluation.update({ where: { id: evaluationId }, data: parsed.data, include: evaluationInclude });
    return Response.json(serializeWorkflowEvaluation(record));
  } catch (error) {
    console.error("No se pudo autoguardar la evaluación", error instanceof Error ? error.message : "Error desconocido");
    return Response.json({ error: "No se pudo guardar la evaluación. Los cambios siguen visibles para que puedas reintentar." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext<"/api/admin/alumnos/[id]/evaluaciones/[evaluationId]">) {
  const unauthorized = await requireAdminApiResponse();
  if (unauthorized) return unauthorized;
  const { id: studentId, evaluationId } = await context.params;
  const body = await request.json().catch(() => ({})) as { action?: string };
  if (body.action !== "recommendReassessment") return Response.json({ error: "Acción no reconocida." }, { status: 400 });
  const existing = await prisma.physicalEvaluation.findFirst({ where: { id: evaluationId, studentId }, select: { id: true, status: true } });
  if (!existing) return Response.json({ error: "Evaluación no encontrada." }, { status: 404 });
  if (existing.status === "IN_PROGRESS") return Response.json({ error: "Primero completá la evaluación." }, { status: 409 });
  const record = await prisma.physicalEvaluation.update({ where: { id: evaluationId }, data: { status: "REASSESSMENT_RECOMMENDED" }, include: evaluationInclude });
  return Response.json(serializeWorkflowEvaluation(record));
}

export async function DELETE(_request: Request, context: RouteContext<"/api/admin/alumnos/[id]/evaluaciones/[evaluationId]">) {
  const unauthorized = await requireAdminApiResponse();
  if (unauthorized) return unauthorized;
  const { id: studentId, evaluationId } = await context.params;
  const existing = await prisma.physicalEvaluation.findFirst({ where: { id: evaluationId, studentId }, select: { id: true, status: true } });
  if (!existing) return Response.json({ error: "Evaluación no encontrada." }, { status: 404 });
  if (existing.status !== "IN_PROGRESS") return Response.json({ error: "Solo pueden eliminarse borradores en curso." }, { status: 409 });
  await prisma.physicalEvaluation.delete({ where: { id: evaluationId } });
  return new Response(null, { status: 204 });
}
