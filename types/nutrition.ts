export type NutritionHabitKey =
  | "hydration"
  | "protein"
  | "fruitsVegetables"
  | "mealOrganization"
  | "energy";

export type NutritionCheckin = Record<NutritionHabitKey, boolean> & {
  id: string;
  dateKey: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
};

export type NutritionEvaluationReference = {
  id: string;
  date: string;
  weight: number | null;
  height: number | null;
  bodyFatPercentage: number | null;
  muscleMass: number | null;
};

export type NutritionSummary = {
  daysRegistered: number;
  compliancePercentage: number;
  strongestHabit: string | null;
  habitToImprove: string | null;
  automaticMessage: string;
};

export type NutritionTrainerNote = {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
};

export type NutritionPortalData = {
  today: string;
  objective: string;
  age: number | null;
  serviceType: "CLASSES" | "PERSONALIZED" | "MIXED";
  evaluation: NutritionEvaluationReference | null;
  todayCheckin: NutritionCheckin | null;
  weekCheckins: NutritionCheckin[];
  summary: NutritionSummary;
  trainerNote: NutritionTrainerNote | null;
};
