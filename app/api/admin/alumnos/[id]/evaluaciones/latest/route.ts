import { requireAdminApiResponse } from "@/lib/admin-api-auth";
import { evaluationInclude, serializeWorkflowEvaluation } from "@/lib/evaluation-persistence";
import { prisma } from "@/lib/prisma";
import { interpretEvaluation } from "@/lib/evaluation-interpretation";
import { argentinaDateKey } from "@/lib/payment-dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<"/api/admin/alumnos/[id]/evaluaciones/latest">) {
  const unauthorized = await requireAdminApiResponse();
  if (unauthorized) return unauthorized;
  const { id: studentId } = await context.params;
  const record = await prisma.physicalEvaluation.findFirst({ where: { studentId, status: { in: ["COMPLETED", "REASSESSMENT_RECOMMENDED"] } }, include: evaluationInclude, orderBy: [{ date: "desc" }, { version: "desc" }] });
  if (!record) return Response.json({ studentId, evaluation: null, interpretation: interpretEvaluation(null, argentinaDateKey()) });
  const evaluation = serializeWorkflowEvaluation(record);
  return Response.json({ studentId, evaluation, interpretation: interpretEvaluation(evaluation, argentinaDateKey()) });
}
