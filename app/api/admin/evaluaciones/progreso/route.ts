import { coachedStudentsWhere } from "@/lib/coached-students";
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
import { requireTrainerWorkspace } from "@/lib/trainer-workspace";
import { weeklyScheduleLabel } from "@/lib/student-enrollment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StudentSummaryRecord = { id: string; serviceType: "CLASSES" | "PERSONALIZED" | "MIXED"; data: unknown; primarySchedule: { id: string; workspaceId: string; dayOfWeek: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY"; startTime: string; endTime: string; classType: string } | null; weeklyClasses: Array<{ schedule: { id: string; workspaceId: string; dayOfWeek: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY"; startTime: string; endTime: string; classType: string } }> };

function studentSummary(record: StudentSummaryRecord, workspaceId: string): EvaluationStudentSummary {
  const data = record.data && typeof record.data === "object" && !Array.isArray(record.data) ? record.data as Record<string, unknown> : {};
  const schedules = [record.primarySchedule, ...record.weeklyClasses.map((assignment) => assignment.schedule)]
    .filter((schedule): schedule is NonNullable<typeof record.primarySchedule> => Boolean(schedule && schedule.workspaceId === workspaceId));
  return { id: record.id, firstName: typeof data.firstName === "string" ? data.firstName : "", lastName: typeof data.lastName === "string" ? data.lastName : "", birthDate: typeof data.birthDate === "string" ? data.birthDate : "", goal: typeof data.goal === "string" ? data.goal : "", serviceType: record.serviceType, accountType: data.accountType === "SELF_SERVICE" ? "SELF_SERVICE" : "COACHED", studentStatus: data.status === "inactivo" || data.lifecycleStatus === "inactivo" || data.lifecycleStatus === "suspendido" ? "INACTIVE" : "ACTIVE", schedules: [...new Map(schedules.map((schedule) => [schedule.id, { id: schedule.id, label: weeklyScheduleLabel(schedule) }])).values()] };
}

const studentSummarySelect = (workspaceId: string) => ({ id: true, serviceType: true, data: true, primarySchedule: { select: { id: true, workspaceId: true, dayOfWeek: true, startTime: true, endTime: true, classType: true } }, weeklyClasses: { where: { active: true, schedule: { workspaceId } }, select: { schedule: { select: { id: true, workspaceId: true, dayOfWeek: true, startTime: true, endTime: true, classType: true } } } } }) as const;

export async function GET(request: Request) {
  const unauthorized = await requireAdminApiResponse();
  if (unauthorized) return unauthorized;
  const { workspaceId } = await requireTrainerWorkspace();
  try {
    const url = new URL(request.url);
    const view = url.searchParams.get("view");
    const studentId = url.searchParams.get("studentId")?.trim() ?? "";
    if (view === "summary") {
      const [studentRecords, physicalRecords, legacyRecords] = await Promise.all([
        prisma.studentRecord.findMany({ where: { workspaceId, AND: [coachedStudentsWhere] }, select: studentSummarySelect(workspaceId), orderBy: { updatedAt: "desc" } }),
        prisma.physicalEvaluation.findMany({
          where: { student: { workspaceId } },
          select: { id: true, studentId: true, date: true, version: true, status: true, completionPercentage: true, primaryGoal: true, reassessmentDate: true, weight: true },
          orderBy: [{ date: "desc" }, { version: "desc" }],
        }),
        prisma.evaluationRecord.findMany({ where: { workspaceId }, select: { id: true, data: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
      ]);
      const students = studentRecords.map((record) => studentSummary(record, workspaceId));
      const physical: EvaluationListItem[] = physicalRecords.map((record) => ({ id: record.id, studentId: record.studentId, date: record.date.toISOString().slice(0, 10), version: record.version, status: record.status, completionPercentage: record.completionPercentage, primaryGoal: record.primaryGoal, reassessmentDate: record.reassessmentDate?.toISOString().slice(0, 10) ?? "", weight: record.weight === null ? null : Number(record.weight), source: "PHYSICAL" }));
      const physicalDates = new Set(physical.map((item) => `${item.studentId}:${item.date}`));
      const legacy: EvaluationListItem[] = legacyRecords.map(normalizeLegacyEvaluationRecord).filter((record) => !physicalDates.has(`${record.studentId}:${record.date}`)).map((record) => ({ id: record.id, studentId: record.studentId, date: record.date, version: record.version, status: record.status, completionPercentage: record.completionPercentage, primaryGoal: record.primaryGoal, reassessmentDate: record.reassessmentDate, weight: record.weight, source: "LEGACY_JSON" }));
      const evaluations = [...physical, ...legacy];
      const visibleStudents = visibleStudentsInEvaluations(students, evaluations);
      const visibleIds = new Set(visibleStudents.map((student) => student.id));
      return Response.json({ students: visibleStudents, evaluations: evaluations.filter((evaluation) => visibleIds.has(evaluation.studentId)) });
    }
    const [studentRecords, physicalRecords, legacyRecords] = await Promise.all([
      prisma.studentRecord.findMany({ where: { workspaceId, AND: [coachedStudentsWhere, studentId ? { id: studentId } : {}] }, select: studentSummarySelect(workspaceId), orderBy: { updatedAt: "desc" } }),
      prisma.physicalEvaluation.findMany({ where: { student: { workspaceId }, ...(studentId ? { studentId } : {}) }, include: evaluationInclude, orderBy: [{ date: "desc" }, { version: "desc" }] }),
      prisma.evaluationRecord.findMany({ where: { workspaceId }, select: { id: true, data: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
    ]);
    if (studentId && !studentRecords.length) return Response.json({ error: "El alumno no existe." }, { status: 404 });
    const students = studentRecords.map((record) => studentSummary(record, workspaceId));
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
