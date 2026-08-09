import { evaluationValidity } from "./evaluation-interpretation.ts";
import type { EvaluationStudentResult } from "./evaluation-student-filter.ts";
import type { EvaluationStatus } from "../types/evaluation-workflow.ts";
import type { EvaluationStudentSummary } from "../types/evaluation-progress.ts";

export type EvaluationListItem = {
  id: string;
  studentId: string;
  date: string;
  version: number;
  status: EvaluationStatus;
  completionPercentage: number;
  primaryGoal: string;
  reassessmentDate: string;
  weight: number | null;
  source: "PHYSICAL" | "LEGACY_JSON";
};

export type EvaluationWorkspaceStudent = EvaluationStudentSummary & EvaluationStudentResult & {
  evaluationCount: number;
  latestGoal: string;
  latestReassessmentDate: string;
};

export function sortEvaluationList<T extends Pick<EvaluationListItem, "date" | "version">>(items: T[]) {
  return [...items].sort((left, right) => right.date.localeCompare(left.date) || right.version - left.version);
}

export function buildEvaluationWorkspaceStudents(
  students: EvaluationStudentSummary[],
  evaluations: EvaluationListItem[],
  today: string,
): EvaluationWorkspaceStudent[] {
  const byStudent = new Map<string, EvaluationListItem[]>();
  for (const evaluation of evaluations) {
    const history = byStudent.get(evaluation.studentId) ?? [];
    history.push(evaluation);
    byStudent.set(evaluation.studentId, history);
  }

  return students.map((student) => {
    const history = sortEvaluationList(byStudent.get(student.id) ?? []);
    const latest = history[0];
    const validity = latest ? evaluationValidity(latest, today) : "";
    return {
      ...student,
      latestDate: latest?.date ?? "",
      latestStatus: latest?.status ?? "",
      validity: validity === "NO_EVALUATION" ? "" : validity,
      evaluationCount: history.length,
      latestGoal: latest?.primaryGoal || student.goal,
      latestReassessmentDate: latest?.reassessmentDate ?? "",
    };
  });
}

export function evaluationSequenceLabel<T extends Pick<EvaluationListItem, "id" | "date" | "version">>(history: T[], evaluationId: string) {
  const chronological = [...history].sort((left, right) => left.date.localeCompare(right.date) || left.version - right.version);
  const index = chronological.findIndex((item) => item.id === evaluationId);
  if (index < 0) return "Evaluación";
  return index === 0 ? "Evaluación inicial" : `Evaluación #${index + 1}`;
}
