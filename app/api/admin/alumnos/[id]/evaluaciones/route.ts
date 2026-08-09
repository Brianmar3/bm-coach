import { Prisma } from "@prisma/client";
import { requireAdminApiResponse } from "@/lib/admin-api-auth";
import { duplicateEvaluationData, evaluationInclude, serializeWorkflowEvaluation, workflowSummary } from "@/lib/evaluation-persistence";
import { prisma } from "@/lib/prisma";
import { argentinaDateKey } from "@/lib/payment-dates";
import { calculateAgeAtDate } from "@/lib/evaluation-workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<"/api/admin/alumnos/[id]/evaluaciones">) {
  const unauthorized = await requireAdminApiResponse();
  if (unauthorized) return unauthorized;
  const { id: studentId } = await context.params;
  const student = await prisma.studentRecord.findUnique({ where: { id: studentId }, select: { id: true } });
  if (!student) return Response.json({ error: "El alumno no existe." }, { status: 404 });
  const records = await prisma.physicalEvaluation.findMany({ where: { studentId }, include: evaluationInclude, orderBy: [{ date: "desc" }, { version: "desc" }] });
  return Response.json(records.map(workflowSummary));
}

export async function POST(request: Request, context: RouteContext<"/api/admin/alumnos/[id]/evaluaciones">) {
  const unauthorized = await requireAdminApiResponse();
  if (unauthorized) return unauthorized;
  const { id: studentId } = await context.params;
  const body = await request.json().catch(() => ({})) as { creationKey?: string; date?: string; baseEvaluationId?: string };
  const creationKey = body.creationKey?.trim();
  if (!creationKey || creationKey.length > 100) return Response.json({ error: "Falta una clave válida para prevenir duplicados." }, { status: 400 });
  try {
    const record = await prisma.$transaction(async (transaction) => {
      const prior = await transaction.physicalEvaluation.findUnique({ where: { creationKey }, include: evaluationInclude });
      if (prior) {
        if (prior.studentId !== studentId) throw new Error("CREATION_KEY_CONFLICT");
        return prior;
      }
      const student = await transaction.studentRecord.findUnique({ where: { id: studentId }, select: { id: true, serviceType: true, data: true } });
      if (!student) throw new Error("STUDENT_NOT_FOUND");
      if (student.serviceType === "CLASSES") throw new Error("SERVICE_NOT_ELIGIBLE");
      const inProgress = await transaction.physicalEvaluation.findFirst({ where: { studentId, status: "IN_PROGRESS" }, include: evaluationInclude, orderBy: { updatedAt: "desc" } });
      if (inProgress && body.baseEvaluationId) throw new Error("IN_PROGRESS_EXISTS");
      if (inProgress) return inProgress;
      const latest = await transaction.physicalEvaluation.aggregate({ where: { studentId }, _max: { version: true } });
      const candidate = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : argentinaDateKey();
      const studentData = student.data as Record<string, unknown>;
      const ageSnapshot = calculateAgeAtDate(typeof studentData.birthDate === "string" ? studentData.birthDate : "", candidate);
      if (body.baseEvaluationId) {
        const source = await transaction.physicalEvaluation.findFirst({ where: { id: body.baseEvaluationId, studentId }, include: evaluationInclude });
        if (!source) throw new Error("BASE_EVALUATION_NOT_FOUND");
        return transaction.physicalEvaluation.create({
          data: duplicateEvaluationData(source, { date: candidate, version: (latest._max.version ?? 0) + 1, creationKey, ageSnapshot }),
          include: evaluationInclude,
        });
      }
      return transaction.physicalEvaluation.create({
        data: { studentId, date: new Date(`${candidate}T12:00:00.000Z`), version: (latest._max.version ?? 0) + 1, status: "IN_PROGRESS", currentStep: 1, completionPercentage: 6, creationKey, generalData: ageSnapshot === null ? {} : { ageSnapshot } },
        include: evaluationInclude,
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return Response.json(serializeWorkflowEvaluation(record), { status: record.creationKey === creationKey ? 201 : 200 });
  } catch (error) {
    if (error instanceof Error && error.message === "STUDENT_NOT_FOUND") return Response.json({ error: "El alumno no existe." }, { status: 404 });
    if (error instanceof Error && error.message === "SERVICE_NOT_ELIGIBLE") return Response.json({ error: "Las evaluaciones nuevas están disponibles para alumnos personalizados o mixtos." }, { status: 409 });
    if (error instanceof Error && error.message === "CREATION_KEY_CONFLICT") return Response.json({ error: "La clave de creación ya fue utilizada." }, { status: 409 });
    if (error instanceof Error && error.message === "IN_PROGRESS_EXISTS") return Response.json({ error: "Ya existe una evaluación en curso. Completala o eliminá el borrador antes de usar otra como base." }, { status: 409 });
    if (error instanceof Error && error.message === "BASE_EVALUATION_NOT_FOUND") return Response.json({ error: "La evaluación base no existe o no pertenece al alumno indicado." }, { status: 404 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) return Response.json({ error: "La evaluación cambió durante la creación. Volvé a intentarlo." }, { status: 409 });
    console.error("No se pudo crear la evaluación por pasos", error instanceof Error ? error.message : "Error desconocido");
    return Response.json({ error: "No se pudo crear la evaluación." }, { status: 500 });
  }
}
