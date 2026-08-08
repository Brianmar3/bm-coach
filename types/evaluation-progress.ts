import type { EvaluationMetricKey, NormalizedEvaluation, StudentEvaluation } from "@/types/evaluation-read-model";
import type { EvaluationTestCategory } from "@/types/evaluation-workflow";

export type ChangeDirection = "INCREASED" | "DECREASED" | "UNCHANGED";

export type MetricComparison = {
  key: EvaluationMetricKey;
  label: string;
  unit: string;
  previous: number;
  current: number;
  absoluteChange: number;
  percentageChange: number | null;
  direction: ChangeDirection;
};

export type TestResultComparison = {
  testKey: string;
  label: string;
  category: EvaluationTestCategory;
  side: "CENTER" | "RIGHT" | "LEFT";
  previous: number | null;
  current: number | null;
  unit: string;
  absoluteChange: number | null;
  percentageChange: number | null;
  previousStatus: string;
  currentStatus: string;
  protocol: string;
  variation: string;
  compatible: boolean;
  incompatibilityReason: string;
};

export type SymmetryComparison = {
  key: string;
  label: string;
  source: "MEASUREMENT" | "TEST";
  right: number;
  left: number;
  unit: string;
  absoluteDifference: number;
  percentageDifference: number | null;
  lowerSide: "RIGHT" | "LEFT" | "EQUAL";
};

export type BodyIssueEvolution = {
  key: string;
  bodyZone: string;
  side: string;
  state: "NEW" | "PERSISTENT" | "NO_LONGER_REPORTED";
  previous: NormalizedEvaluation["bodyIssues"][number] | null;
  current: NormalizedEvaluation["bodyIssues"][number] | null;
};

export type ProgressComponent = {
  key: "MEASUREMENTS" | "PERFORMANCE" | "MOBILITY" | "PRIORITIES";
  label: string;
  score: number;
  weight: number;
  usedData: string[];
};

export type BMProgressIndex = {
  available: boolean;
  score: number | null;
  reason: string;
  formula: string;
  components: ProgressComponent[];
};

export type AreaEvolution = {
  key: "MEASUREMENTS" | "STRENGTH" | "ENDURANCE" | "CORE" | "MOBILITY" | "BALANCE";
  label: string;
  state: "INSUFFICIENT_DATA" | "STABLE" | "EVOLUTION" | "FOLLOW_UP";
  evidence: string[];
};

export type EvaluationComparison = {
  previous: NormalizedEvaluation | StudentEvaluation;
  current: NormalizedEvaluation | StudentEvaluation;
  elapsedDays: number | null;
  measurements: MetricComparison[];
  tests: TestResultComparison[];
  symmetry: SymmetryComparison[];
  bodyIssues: BodyIssueEvolution[];
  progress: BMProgressIndex;
  areas: AreaEvolution[];
};

export type EvaluationStudentSummary = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  goal: string;
  serviceType: "CLASSES" | "PERSONALIZED" | "MIXED";
};

export type AttentionItem = {
  studentId: string;
  studentName: string;
  reason: "OVERDUE" | "INCOMPLETE" | "NO_EVALUATION" | "HIGH_PRIORITIES";
  label: string;
};

export type EvaluationGlobalStats = {
  eligibleStudents: number;
  studentsWithEvaluation: number;
  studentsWithoutEvaluation: number;
  inProgress: number;
  completed: number;
  reassessmentRecommended: number;
  evaluationsThisMonth: number;
  evaluatedPercentage: number;
  averageDaysSinceLastEvaluation: number | null;
  totalEvaluations: number;
  averagePerStudent: number;
  completionPercentage: number;
  reassessmentsPerformed: number;
  attention: AttentionItem[];
};
