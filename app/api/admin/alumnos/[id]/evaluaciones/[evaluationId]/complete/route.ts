import { requireAdminApiResponse } from "@/lib/admin-api-auth";
import { missingEssentialFields } from "@/lib/evaluation-workflow";
import { evaluationInclude, serializeWorkflowEvaluation } from "@/lib/evaluation-persistence";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: RouteContext<"/api/admin/alumnos/[id]/evaluaciones/[evaluationId]/complete">) {
  const unauthorized = await requireAdminApiResponse();
  if (unauthorized) return unauthorized;
  const { id: studentId, evaluationId } = await context.params;
  const outcome = await prisma.$transaction(async (transaction) => {
    const current = await transaction.physicalEvaluation.findFirst({ where: { id: evaluationId, studentId }, include: evaluationInclude });
    if (!current) return { kind: "missing" as const };
    if (current.status !== "IN_PROGRESS") return { kind: "immutable" as const, record: current };
    const serialized = serializeWorkflowEvaluation(current);
    const missing = missingEssentialFields(serialized);
    if (missing.length) return { kind: "incomplete" as const, missing };
    const record = await transaction.physicalEvaluation.update({ where: { id: evaluationId }, data: { status: "COMPLETED", completedAt: new Date() }, include: evaluationInclude });
    return { kind: "completed" as const, record };
  });
  if (outcome.kind === "missing") return Response.json({ error: "Evaluación no encontrada." }, { status: 404 });
  if (outcome.kind === "incomplete") return Response.json({ error: "Falta información esencial para completar la evaluación.", missing: outcome.missing }, { status: 422 });
  if (outcome.kind === "immutable") return Response.json({ error: "La evaluación ya fue completada y está protegida contra cambios." }, { status: 409 });
  return Response.json(serializeWorkflowEvaluation(outcome.record));
}
