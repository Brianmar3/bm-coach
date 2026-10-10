import type { EvaluationMetricKey, StudentEvaluation } from "../types/evaluation-read-model.ts";

export const portalEvaluationMetrics: { key: EvaluationMetricKey; label: string; unit: string }[] = [
  { key: "weight", label: "Peso", unit: "kg" },
  { key: "waist", label: "Cintura", unit: "cm" },
  { key: "hip", label: "Cadera", unit: "cm" },
  { key: "chest", label: "Pecho", unit: "cm" },
  { key: "bodyFatPercentage", label: "Grasa corporal", unit: "%" },
  { key: "rightArm", label: "Brazo derecho", unit: "cm" },
  { key: "leftArm", label: "Brazo izquierdo", unit: "cm" },
  { key: "rightThigh", label: "Muslo derecho", unit: "cm" },
  { key: "leftThigh", label: "Muslo izquierdo", unit: "cm" },
  { key: "rightCalf", label: "Pantorrilla derecha", unit: "cm" },
  { key: "leftCalf", label: "Pantorrilla izquierda", unit: "cm" },
];

export function comparablePortalMetrics(evaluations: StudentEvaluation[]) {
  return portalEvaluationMetrics.filter(({ key }) => evaluations.filter(item => typeof item[key] === "number" && Number.isFinite(item[key])).length >= 2);
}

export function portalEvaluationHistory(evaluations: StudentEvaluation[]) {
  return [...evaluations].sort((a, b) => b.date.localeCompare(a.date) || b.version - a.version);
}

export function portalEvaluationAreas(current: StudentEvaluation, previous?: StudentEvaluation) {
  return {
    comparison: Boolean(previous && comparablePortalMetrics([previous, current]).length),
    body: current.bodyIssues.length > 0,
    mobility: current.testResults.some(test => test.category === "MOBILITY"),
    physical: current.testResults.some(test => test.category === "PHYSICAL"),
    summary: current.testResults.length > 0 || Boolean(current.notes?.trim()),
  };
}
