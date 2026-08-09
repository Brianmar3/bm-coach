import { requireAdminApiResponse } from "@/lib/admin-api-auth";
import { databaseUnavailable } from "@/lib/evaluaciones";
import { calculateGlobalEvaluationStats } from "@/lib/evaluation-progress";
import { deduplicateEvaluations } from "@/lib/evaluation-read-model";
import { evaluationInclude, normalizeLegacyEvaluationRecord, normalizePhysicalEvaluation } from "@/lib/evaluation-persistence";
import { argentinaDateKey } from "@/lib/payment-dates";
import { prisma } from "@/lib/prisma";
import { visibleStudentsInEvaluations } from "@/lib/evaluation-student-filter";
import type { EvaluationListItem } from "@/lib/evaluation-workspace";
import type { EvaluationStudentSummary } from "@/types/evaluation-progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function studentSummary(record: { id: string; serviceType: "CLASSES" | "PERSONALIZED" | "MIXED"; data: unknown }): EvaluationStudentSummary {
  const data = record.data && typeof record.data === "object" && !Array.isArray(record.data) ? record.data as Record<string, unknown> : {};
  return { id: record.id, firstName: typeof data.firstName === "string" ? data.firstName : "", lastName: typeof data.lastName === "string" ? data.lastName : "", birthDate: typeof data.birthDate === "string" ? data.birthDate : "", goal: typeof data.goal === "string" ? data.goal : "", serviceType: record.serviceType };
}

export async function GET(request: Request) {
  const unauthorized = await requireAdminApiResponse();
  if (unauthorized) return unauthorized;
  try {
    const url = new URL(request.url);
    const view = url.searchParams.get("view");
    const studentId = url.searchParams.get("studentId")?.trim() ?? "";
    if (view === "summary") {
      const [studentRecords, physicalRecords, legacyRecords] = await Promise.all([
        prisma.studentRecord.findMany({ select: { id: true, serviceType: true, data: true }, orderBy: { updatedAt: "desc" } }),
        prisma.physicalEvaluation.findMany({
          select: { id: true, studentId: true, date: true, version: true, status: true, completionPercentage: true, primaryGoal: true, reassessmentDate: true, weight: true },
          orderBy: [{ date: "desc" }, { version: "desc" }],
        }),
        prisma.evaluationRecord.findMany({ select: { id: true, data: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
      ]);
      const students = studentRecords.map(studentSummary);
      const physical: EvaluationListItem[] = physicalRecords.map((record) => ({ id: record.id, studentId: record.studentId, date: record.date.toISOString().slice(0, 10), version: record.version, status: record.status, completionPercentage: record.completionPercentage, primaryGoal: record.primaryGoal, reassessmentDate: record.reassessmentDate?.toISOString().slice(0, 10) ?? "", weight: record.weight === null ? null : Number(record.weight), source: "PHYSICAL" }));
      const physicalDates = new Set(physical.map((item) => `${item.studentId}:${item.date}`));
      const legacy: EvaluationListItem[] = legacyRecords.map(normalizeLegacyEvaluationRecord).filter((record) => !physicalDates.has(`${record.studentId}:${record.date}`)).map((record) => ({ id: record.id, studentId: record.studentId, date: record.date, version: record.version, status: record.status, completionPercentage: record.completionPercentage, primaryGoal: record.primaryGoal, reassessmentDate: record.reassessmentDate, weight: record.weight, source: "LEGACY_JSON" }));
      const evaluations = [...physical, ...legacy];
      const visibleStudents = visibleStudentsInEvaluations(students, evaluations);
      const visibleIds = new Set(visibleStudents.map((student) => student.id));
      return Response.json({ students: visibleStudents, evaluations: evaluations.filter((evaluation) => visibleIds.has(evaluation.studentId)) });
    }
    const [studentRecords, physicalRecords, legacyRecords] = await Promise.all([
      prisma.studentRecord.findMany({ where: studentId ? { id: studentId } : undefined, select: { id: true, serviceType: true, data: true }, orderBy: { updatedAt: "desc" } }),
      prisma.physicalEvaluation.findMany({ where: studentId ? { studentId } : undefined, include: evaluationInclude, orderBy: [{ date: "desc" }, { version: "desc" }] }),
      prisma.evaluationRecord.findMany({ select: { id: true, data: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
    ]);
    const students = studentRecords.map(studentSummary);
    const evaluations = deduplicateEvaluations([...physicalRecords.map(normalizePhysicalEvaluation), ...legacyRecords.map(normalizeLegacyEvaluationRecord).filter((record) => !studentId || record.studentId === studentId)]);
    const visibleStudents = visibleStudentsInEvaluations(students, evaluations);
    const visibleStudentIds = new Set(visibleStudents.map((student) => student.id));
    const visibleEvaluations = evaluations.filter((evaluation) => visibleStudentIds.has(evaluation.studentId));
    return Response.json({ students: visibleStudents, evaluations: visibleEvaluations, stats: calculateGlobalEvaluationStats(visibleStudents, visibleEvaluations, argentinaDateKey()) });
  } catch (error) {
    console.error("No se pudo cargar el progreso global de evaluaciones", error instanceof Error ? error.message : "Error desconocido");
    const unavailable = databaseUnavailable(error);
    return Response.json({ error: unavailable ? "La base de datos no está disponible temporalmente." : "No se pudo cargar el progreso de evaluaciones." }, { status: unavailable ? 503 : 500 });
  }
}
