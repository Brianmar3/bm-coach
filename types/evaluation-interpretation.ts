export type EvaluationPriorityCategory = "movilidad" | "control motor" | "fuerza" | "resistencia" | "zona media" | "equilibrio" | "asimetría" | "molestia" | "técnica";
export type EvaluationPriorityLevel = "informativa" | "atención" | "prioritaria";

export type EvaluationPriority = {
  id: string;
  category: EvaluationPriorityCategory;
  origin: string;
  level: EvaluationPriorityLevel;
  message: string;
  evidence: string;
  recommendation: string;
};

export type EvaluationAlert = {
  id: string;
  level: EvaluationPriorityLevel;
  message: string;
  origin: string;
};

export type EvaluationAsymmetry = {
  testKey: string;
  label: string;
  unit: string;
  rightValue: number;
  leftValue: number;
  absoluteDifference: number;
  percentageDifference: number;
  lowerSide: "RIGHT" | "LEFT";
  relevant: boolean;
};

export type EvaluationValidity = "CURRENT" | "DUE_SOON" | "REASSESSMENT_RECOMMENDED" | "NO_EVALUATION";

export type EvaluationInterpretation = {
  evaluationId: string;
  generatedAt: string;
  validity: EvaluationValidity;
  strengths: string[];
  priorities: EvaluationPriority[];
  limitations: string[];
  asymmetries: EvaluationAsymmetry[];
  alerts: EvaluationAlert[];
  recommendations: string[];
  missingData: string[];
  suggestedReassessmentDate: string;
  sufficientData: boolean;
};
