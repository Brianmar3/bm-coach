import { requireAdminApiResponse } from "@/lib/admin-api-auth";
import { databaseUnavailable } from "@/lib/evaluaciones";
import { calculateGlobalEvaluationStats } from "@/lib/evaluation-progress";
import { deduplicateEvaluations } from "@/lib/evaluation-read-model";
import { evaluationInclude, normalizeLegacyEvaluationRecord, normalizePhysicalEvaluation } from "@/lib/evaluation-persistence";
import { argentinaDateKey } from "@/lib/payment-dates";
import { prisma } from "@/lib/prisma";
import type { EvaluationStudentSummary } from "@/types/evaluation-progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const unauthorized = await requireAdminApiResponse();
  if (unauthorized) return unauthorized;
  try {
    const [studentRecords, physicalRecords, legacyRecords] = await Promise.all([
      prisma.studentRecord.findMany({ select: { id: true, serviceType: true, data: true }, orderBy: { updatedAt: "desc" } }),
      prisma.physicalEvaluation.findMany({ include: evaluationInclude, orderBy: [{ date: "desc" }, { version: "desc" }] }),
      prisma.evaluationRecord.findMany({ select: { id: true, data: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
    ]);
    const students: EvaluationStudentSummary[] = studentRecords.map((record) => {
      const data = record.data && typeof record.data === "object" && !Array.isArray(record.data) ? record.data as Record<string, unknown> : {};
      return { id: record.id, firstName: typeof data.firstName === "string" ? data.firstName : "", lastName: typeof data.lastName === "string" ? data.lastName : "", birthDate: typeof data.birthDate === "string" ? data.birthDate : "", goal: typeof data.goal === "string" ? data.goal : "", serviceType: record.serviceType };
    });
    const evaluations = deduplicateEvaluations([...physicalRecords.map(normalizePhysicalEvaluation), ...legacyRecords.map(normalizeLegacyEvaluationRecord)]);
    return Response.json({ students, evaluations, stats: calculateGlobalEvaluationStats(students, evaluations, argentinaDateKey()) });
  } catch (error) {
    console.error("No se pudo cargar el progreso global de evaluaciones", error instanceof Error ? error.message : "Error desconocido");
    const unavailable = databaseUnavailable(error);
    return Response.json({ error: unavailable ? "La base de datos no está disponible temporalmente." : "No se pudo cargar el progreso de evaluaciones." }, { status: unavailable ? 503 : 500 });
  }
}
