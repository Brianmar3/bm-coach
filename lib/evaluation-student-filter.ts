import type { EvaluationStudentSummary } from "../types/evaluation-progress.ts";

export type EvaluationStatusFilter = "ALL" | "NONE" | "IN_PROGRESS" | "COMPLETED" | "REASSESSMENT_RECOMMENDED";
export type EvaluationServiceFilter = "ALL" | "PERSONALIZED" | "MIXED";
export type EvaluationValidityFilter = "ALL" | "CURRENT" | "DUE_SOON" | "REASSESSMENT_RECOMMENDED";

export type EvaluationStudentResult = EvaluationStudentSummary & {
  latestDate: string;
  latestStatus: "" | "IN_PROGRESS" | "COMPLETED" | "REASSESSMENT_RECOMMENDED";
  validity: "" | "CURRENT" | "DUE_SOON" | "REASSESSMENT_RECOMMENDED";
};

const normalized = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

export function filterEvaluationStudents(items: EvaluationStudentResult[], filters: { query: string; service: EvaluationServiceFilter; status: EvaluationStatusFilter; validity: EvaluationValidityFilter }) {
  const query = normalized(filters.query);
  return items.filter((item) => {
    if (item.serviceType === "CLASSES") return false;
    if (query && !normalized(`${item.firstName} ${item.lastName}`).includes(query)) return false;
    if (filters.service !== "ALL" && item.serviceType !== filters.service) return false;
    if (filters.status === "NONE" && item.latestStatus) return false;
    if (filters.status !== "ALL" && filters.status !== "NONE" && item.latestStatus !== filters.status) return false;
    if (filters.validity !== "ALL" && item.validity !== filters.validity) return false;
    return true;
  });
}
