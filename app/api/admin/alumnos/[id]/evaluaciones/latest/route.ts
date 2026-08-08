import { requireAdminApiResponse } from "@/lib/admin-api-auth";
import { evaluationInclude, serializeWorkflowEvaluation } from "@/lib/evaluation-persistence";
import { prisma } from "@/lib/prisma";
import { interpretEvaluation } from "@/lib/evaluation-interpretation";
import { argentinaDateKey } from "@/lib/payment-dates";
import { selectEvaluationForPlanning } from "@/lib/evaluation-read-model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<"/api/admin/alumnos/[id]/evaluaciones/latest">) {
  const unauthorized = await requireAdminApiResponse();
  if (unauthorized) return unauthorized;
  const { id: studentId } = await context.params;
  const records = await prisma.physicalEvaluation.findMany({ where: { studentId }, include: evaluationInclude, orderBy: [{ date: "desc" }, { version: "desc" }], take: 5 });
  const evaluation = selectEvaluationForPlanning(records.map(serializeWorkflowEvaluation));
  if (!evaluation) return Response.json({ studentId, evaluation: null, interpretation: interpretEvaluation(null, argentinaDateKey()) });
  return Response.json({ studentId, evaluation, interpretation: interpretEvaluation(evaluation, argentinaDateKey()) });
}
