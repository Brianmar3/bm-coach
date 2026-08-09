import type { EvaluationStudentSummary } from "../types/evaluation-progress.ts";
import type { NormalizedEvaluation } from "../types/evaluation-read-model.ts";

export type EvaluationStatusFilter = "ALL" | "NONE" | "IN_PROGRESS" | "COMPLETED" | "REASSESSMENT_RECOMMENDED";
export type EvaluationServiceFilter = "ALL" | "CLASSES" | "PERSONALIZED" | "MIXED";
export type EvaluationValidityFilter = "ALL" | "CURRENT" | "DUE_SOON" | "REASSESSMENT_RECOMMENDED";

export type EvaluationStudentResult = EvaluationStudentSummary & {
  latestDate: string;
  latestStatus: "" | "IN_PROGRESS" | "COMPLETED" | "REASSESSMENT_RECOMMENDED";
  validity: "" | "CURRENT" | "DUE_SOON" | "REASSESSMENT_RECOMMENDED";
};

const normalized = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

export function isStudentVisibleInEvaluations(
  student: Pick<EvaluationStudentSummary, "id" | "serviceType">,
  evaluations: Pick<NormalizedEvaluation, "studentId">[],
) {
  return student.serviceType === "PERSONALIZED"
    || student.serviceType === "MIXED"
    || evaluations.some((evaluation) => evaluation.studentId === student.id);
}

export function visibleStudentsInEvaluations(
  students: EvaluationStudentSummary[],
  evaluations: Pick<NormalizedEvaluation, "studentId">[],
) {
  return students.filter((student) => isStudentVisibleInEvaluations(student, evaluations));
}

export function filterEvaluationStudents<T extends EvaluationStudentResult>(items: T[], filters: { query: string; service: EvaluationServiceFilter; status: EvaluationStatusFilter; validity: EvaluationValidityFilter }): T[] {
  const query = normalized(filters.query);
  return items.filter((item) => {
    if (query && !normalized(`${item.firstName} ${item.lastName}`).includes(query)) return false;
    if (filters.service !== "ALL" && item.serviceType !== filters.service) return false;
    if (filters.status === "NONE" && item.latestStatus) return false;
    if (filters.status === "REASSESSMENT_RECOMMENDED" && item.latestStatus !== "REASSESSMENT_RECOMMENDED" && item.validity !== "REASSESSMENT_RECOMMENDED") return false;
    if (filters.status !== "ALL" && filters.status !== "NONE" && filters.status !== "REASSESSMENT_RECOMMENDED" && item.latestStatus !== filters.status) return false;
    if (filters.validity !== "ALL" && item.validity !== filters.validity) return false;
    return true;
  });
}
