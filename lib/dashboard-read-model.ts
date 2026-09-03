import type { EvaluationStatus } from "@prisma/client";
import type { DashboardPriority } from "@/types/dashboard";
import type { PaymentAccountStatus } from "@/types/gestion";
import type { StudentServiceType } from "@/types/gestion";

export type EvaluationPriorityRecord = {
  studentId: string;
  status: EvaluationStatus;
  reassessmentDate: Date | null;
};

export function latestEvaluationPriorityCounts(
  evaluations: EvaluationPriorityRecord[],
  activeStudentIds: Set<string>,
  today: string,
) {
  const seen = new Set<string>();
  let inProgress = 0;
  let reassessments = 0;

  for (const evaluation of evaluations) {
    if (seen.has(evaluation.studentId) || !activeStudentIds.has(evaluation.studentId)) continue;
    seen.add(evaluation.studentId);
    if (evaluation.status === "IN_PROGRESS") {
      inProgress += 1;
      continue;
    }
    const reassessmentKey = evaluation.reassessmentDate?.toISOString().slice(0, 10) ?? "";
    if (evaluation.status === "REASSESSMENT_RECOMMENDED" || (reassessmentKey && reassessmentKey <= today)) {
      reassessments += 1;
    }
  }

  return { inProgress, reassessments };
}

export function buildDashboardPriorities(input: {
  overdue: number;
  dueSoon: number;
  unconfigured: number;
  reassessments: number;
  evaluationsInProgress: number;
}): DashboardPriority[] {
  const priorities: DashboardPriority[] = [
    { id: "overdue", label: "Cuotas vencidas", count: input.overdue, href: "/pagos?estado=VENCIDA", tone: "danger" },
    { id: "due-soon", label: "Vencen en 3 días", count: input.dueSoon, href: "/pagos?estado=VENCE_PRONTO", tone: "warning" },
    { id: "unconfigured", label: "Alumnos sin configurar", count: input.unconfigured, href: "/alumnos", tone: "gold" },
    { id: "reassessments", label: "Reevaluaciones pendientes", count: input.reassessments, href: "/evaluaciones", tone: "info" },
    { id: "evaluations-in-progress", label: "Evaluaciones en curso", count: input.evaluationsInProgress, href: "/evaluaciones", tone: "neutral" },
  ];
  return priorities.filter((priority) => priority.count > 0);
}

export function compactRanking(
  totals: Array<{ studentId: string; points: number }>,
  names: Map<string, string>,
  activeStudentIds: Set<string>,
  limit = 3,
) {
  return totals
    .filter((entry) => activeStudentIds.has(entry.studentId) && entry.points > 0)
    .map((entry) => ({ ...entry, studentName: names.get(entry.studentId) ?? "Alumno sin nombre" }))
    .sort((left, right) => right.points - left.points || left.studentName.localeCompare(right.studentName, "es"))
    .slice(0, limit);
}

export function countPaymentStatuses(statuses: PaymentAccountStatus[]) {
  return {
    overdue: statuses.filter((status) => status === "VENCIDA").length,
    dueSoon: statuses.filter((status) => status === "VENCE_PRONTO").length,
    unconfigured: statuses.filter((status) => status === "SIN_CONFIGURAR").length,
  };
}

export type DashboardActivityCandidate = {
  studentId: string;
  status: string;
  serviceType: StudentServiceType;
  hasEstablishedRoutine: boolean;
  hasEstablishedClasses: boolean;
  hasRecentWorkout: boolean;
  hasRecentAttendance: boolean;
};

export function lowActivityStudentIds(candidates: DashboardActivityCandidate[]) {
  return [...new Set(candidates.filter((student) => {
    if (student.status !== "activo") return false;
    if (student.serviceType === "PERSONALIZED") return false;
    return student.hasEstablishedClasses && !student.hasRecentAttendance;
  }).map((student) => student.studentId))];
}
