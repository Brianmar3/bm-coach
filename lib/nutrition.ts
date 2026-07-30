import type {
  NutritionCheckin,
  NutritionEvaluationReference,
  NutritionHabitKey,
  NutritionSummary,
  NutritionTrainerNote,
} from "@/types/nutrition";
import { databaseDateKey, dateKeyToDatabase } from "@/lib/payment-dates";

export const NUTRITION_HABITS: Array<{
  key: NutritionHabitKey;
  label: string;
}> = [
  { key: "hydration", label: "Hidratación" },
  { key: "protein", label: "Proteína" },
  { key: "fruitsVegetables", label: "Frutas y verduras" },
  { key: "mealOrganization", label: "Organización de comidas" },
  { key: "energy", label: "Energía durante el día" },
];

export function addDateKeyDays(dateKey: string, days: number) {
  const date = dateKeyToDatabase(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return databaseDateKey(date);
}

export function serializeNutritionCheckin(record: {
  id: string;
  dateKey: string;
  hydration: boolean;
  protein: boolean;
  fruitsVegetables: boolean;
  mealOrganization: boolean;
  energy: boolean;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
}): NutritionCheckin {
  return {
    id: record.id,
    dateKey: record.dateKey,
    hydration: record.hydration,
    protein: record.protein,
    fruitsVegetables: record.fruitsVegetables,
    mealOrganization: record.mealOrganization,
    energy: record.energy,
    comment: record.comment,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function nutritionSummary(
  checkins: NutritionCheckin[],
): NutritionSummary {
  const totals = new Map<NutritionHabitKey, number>(
    NUTRITION_HABITS.map(({ key }) => [key, 0]),
  );
  let completed = 0;
  for (const checkin of checkins) {
    for (const { key } of NUTRITION_HABITS) {
      if (!checkin[key]) continue;
      completed += 1;
      totals.set(key, (totals.get(key) ?? 0) + 1);
    }
  }
  const sorted = [...NUTRITION_HABITS].sort(
    (left, right) =>
      (totals.get(right.key) ?? 0) - (totals.get(left.key) ?? 0),
  );
  const weakestKey = sorted[sorted.length - 1]?.key;
  const compliancePercentage = checkins.length
    ? Math.round((completed / (checkins.length * NUTRITION_HABITS.length)) * 100)
    : 0;
  const automaticMessage =
    compliancePercentage >= 80
      ? "Buen trabajo. La constancia semanal es más importante que buscar la perfección."
      : weakestKey === "hydration"
        ? "Esta semana podés enfocarte en llevar agua y beber durante el día."
        : weakestKey === "protein"
          ? "Intentá incluir una fuente de proteína en tus comidas principales."
          : weakestKey === "mealOrganization"
            ? "Preparar algunas comidas con anticipación puede ayudarte a sostener tus hábitos."
            : weakestKey === "fruitsVegetables"
              ? "Sumar frutas o verduras a comidas que ya hacés puede ayudarte a sostener este hábito."
              : weakestKey === "energy"
                ? "Observá tus horarios de comida y cómo llegás de energía al entrenamiento."
                : "Empezá por uno o dos hábitos simples y sostenelos durante la semana.";
  return {
    daysRegistered: checkins.length,
    compliancePercentage,
    strongestHabit:
      checkins.length && (totals.get(sorted[0].key) ?? 0) > 0
        ? sorted[0].label
        : null,
    habitToImprove:
      checkins.length
        ? sorted[sorted.length - 1].label
        : null,
    automaticMessage,
  };
}

export function serializeNutritionEvaluation(record: {
  id: string;
  date: Date;
  weight: unknown;
  height: unknown;
  bodyFatPercentage: unknown;
  muscleMass: unknown;
} | null): NutritionEvaluationReference | null {
  if (!record) return null;
  const value = (input: unknown) =>
    input === null || input === undefined ? null : Number(input);
  return {
    id: record.id,
    date: databaseDateKey(record.date),
    weight: value(record.weight),
    height: value(record.height),
    bodyFatPercentage: value(record.bodyFatPercentage),
    muscleMass: value(record.muscleMass),
  };
}

export function serializeNutritionNote(record: {
  id: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
} | null): NutritionTrainerNote | null {
  return record
      ? {
        id: record.id,
        text: record.text,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      }
    : null;
}
