import type { TrainingBlockType, TrainingExerciseTargetType } from "@/types/gestion";

export type RoutineAIContext = {
  studentId: string;
  serviceType: "PERSONALIZED" | "MIXED";
  objective: string;
  secondaryGoals: string[];
  level: string;
  weeklyAvailability: number | null;
  activities: string;
  evaluation: null | {
    id: string;
    date: string;
    validity: string;
    measures: Record<string, number>;
    evolution: { bmIndex: number | null; changes: Array<{ metric: string; change: number; unit: string }> };
    tests: Array<{ key: string; category: string; status: string; value: number | null; unit: string; right: number | null; left: number | null }>;
    asymmetries: Array<{ testKey: string; difference: number; unit: string; lowerSide: string }>;
    bodyIssues: Array<{ zone: string; side: string; intensity: number | null; status: string }>;
    priorities: Array<{ id: string; category: string; level: string; observed: string; interpretation: string; planningImpact: string; suggestion: string }>;
    alerts: Array<{ id: string; message: string }>;
    recommendations: string[];
  };
};

export type RoutineAIConstraints = {
  requestedDays: number;
  sessionMinutes: number | null;
  location: "SALON_BM" | "FULL_GYM" | "HOME" | "CUSTOM";
  equipment: string[];
  trainerInstructions: string;
};

export type RoutineAIExercise = {
  id: string;
  name: string;
  muscleGroup: string;
  sets: number;
  repetitions: string;
  restSeconds: number | null;
  effortType: "RIR" | "RPE";
  effortValue: number | null;
  targetType: TrainingExerciseTargetType;
  targetSeconds: number | null;
  targetRepetitions: string;
  targetDistance: string;
  targetSide: string;
  equipment: string;
  alternativeExercise: string;
  observations: string;
  rationale: string;
  evidenceIds: string[];
  resolved: boolean;
  resolutionSource: "CATALOG" | "KNOWN_NAME" | "UNRESOLVED";
};

export type RoutineAIBlock = {
  id: string;
  type: Extract<TrainingBlockType, "STRENGTH" | "INTERVAL" | "EMOM" | "AMRAP" | "FOR_TIME">;
  name: string;
  rounds: number | null;
  durationSeconds: number | null;
  workSeconds: number | null;
  restSeconds: number | null;
  restBetweenRoundsSeconds: number | null;
  targetRounds: number | null;
  instructions: string;
  exercises: RoutineAIExercise[];
};

export type RoutineAIDay = { id: string; name: string; focus: string; estimatedMinutes: number | null; warmup: string; notes: string; blocks: RoutineAIBlock[] };

export type RoutineAIProposal = {
  summary: string;
  weeklyFrequency: number;
  weeklyStructure: string[];
  days: RoutineAIDay[];
  rationale: Array<{ statement: string; evidenceIds: string[] }>;
  prioritiesCovered: string[];
  prioritiesPending: string[];
  warningsConsidered: string[];
  notes: string[];
  validationWarnings: string[];
  generatedAt: string;
};

export type RoutineExerciseCatalogEntry = { name: string; aliases: string[] };

