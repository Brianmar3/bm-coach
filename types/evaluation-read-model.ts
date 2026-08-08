import type { EvaluationBodyIssueValue, EvaluationStatus, EvaluationTestValue } from "@/types/evaluation-workflow";

export type EvaluationMetricKey = "weight" | "height" | "age" | "bmi" | "bodyFatPercentage" | "muscleMass" | "visceralFat" | "waist" | "hip" | "chest" | "rightArm" | "leftArm" | "rightThigh" | "leftThigh" | "rightCalf" | "leftCalf";

export type NormalizedEvaluation = {
  id: string;
  studentId: string;
  studentName: string;
  date: string;
  version: number;
  status: EvaluationStatus;
  completionPercentage: number;
  trainerName: string;
  primaryGoal: string;
  secondaryGoals: string[];
  experienceLevel: string;
  weeklyAvailability: string;
  reassessmentDate: string;
  weight: number | null;
  height: number | null;
  age: number | null;
  bmi: number | null;
  bodyFatPercentage: number | null;
  muscleMass: number | null;
  visceralFat: number | null;
  waist: number | null;
  hip: number | null;
  chest: number | null;
  rightArm: number | null;
  leftArm: number | null;
  rightThigh: number | null;
  leftThigh: number | null;
  rightCalf: number | null;
  leftCalf: number | null;
  activities: string;
  habits: Record<string, unknown>;
  bodyIssues: EvaluationBodyIssueValue[];
  testResults: EvaluationTestValue[];
  finalStrengths: string;
  finalPriorities: string;
  finalLimitations: string;
  planningNotes: string;
  finalComment: string;
  createdAt: string;
  source: "PHYSICAL" | "LEGACY_JSON";
};

export type StudentEvaluation = Omit<NormalizedEvaluation,
  "trainerName" | "habits" | "finalStrengths" | "finalPriorities" | "finalLimitations" | "planningNotes" | "finalComment"
> & { notes?: string; frontPhotoUrl?: string; sidePhotoUrl?: string; backPhotoUrl?: string };
