export type EvaluationStatus = "IN_PROGRESS" | "COMPLETED" | "REASSESSMENT_RECOMMENDED";
export type EvaluationTestCategory = "MOBILITY" | "PHYSICAL";

export type EvaluationMeasurementValue = {
  id?: string;
  measurementType: string;
  side: string | null;
  value: number;
  unit: string;
  notes: string;
};

export type EvaluationBodyIssueValue = {
  id?: string;
  bodyZone: string;
  side: string;
  intensity: number | null;
  hasPain: boolean;
  status: string;
  studentDescription: string;
  trainerObservation: string;
  approximateDate: string;
};

export type EvaluationTestValue = {
  id?: string;
  testKey: string;
  category: EvaluationTestCategory;
  status: string;
  numericValue: number | null;
  unit: string;
  rightValue: number | null;
  leftValue: number | null;
  rightUnit: string;
  leftUnit: string;
  pain: boolean;
  rightPain: boolean;
  leftPain: boolean;
  protocol: string;
  variation: string;
  observations: string;
  compensations: string;
  notPerformedReason: string;
  rawResult: Record<string, string | number | boolean | null>;
};

export type EvaluationWorkflow = {
  id: string;
  studentId: string;
  studentName: string;
  version: number;
  status: EvaluationStatus;
  date: string;
  currentStep: number;
  completionPercentage: number;
  trainerName: string;
  primaryGoal: string;
  secondaryGoals: string[];
  experienceLevel: string;
  weeklyAvailability: string;
  generalData: Record<string, unknown>;
  habits: Record<string, unknown>;
  trainingObservations: Record<string, unknown>;
  trainerNotes: string;
  finalStrengths: string;
  finalPriorities: string;
  finalLimitations: string;
  planningNotes: string;
  finalComment: string;
  reassessmentDate: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  measurements: EvaluationMeasurementValue[];
  bodyIssues: EvaluationBodyIssueValue[];
  testResults: EvaluationTestValue[];
};

export type EvaluationSummary = Pick<EvaluationWorkflow,
  "id" | "studentId" | "studentName" | "version" | "status" | "date" |
  "currentStep" | "completionPercentage" | "trainerName" | "primaryGoal" |
  "reassessmentDate" | "completedAt" | "createdAt" | "updatedAt"
>;

export type EvaluationDraftInput = Omit<EvaluationWorkflow,
  "id" | "studentName" | "version" | "status" | "completionPercentage" |
  "completedAt" | "createdAt" | "updatedAt"
>;
