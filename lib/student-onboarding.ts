import type { Student } from "@/types/gestion";

export const ONBOARDING_GOALS = ["Ganar masa muscular", "Bajar grasa", "Mejorar salud", "Ganar fuerza", "Mejorar rendimiento", "Otro"] as const;
export const EXPERIENCE_LEVELS = ["Principiante", "Intermedio", "Avanzado"] as const;
export const TRAINING_EXPERIENCE = ["Nunca entrené", "Menos de 6 meses", "6 a 12 meses", "1 a 3 años", "Más de 3 años"] as const;

export type StudentOnboardingData = {
  birthDate: string;
  height: number;
  weight: number;
  goal: string;
  experienceLevel: string;
  trainingExperience: string;
  hasLimitations: boolean;
  limitations: string;
  onboardingCompleted: boolean;
  onboardingUpdatedAt: string;
};

export function onboardingData(student: Student): StudentOnboardingData {
  return {
    birthDate: student.birthDate ?? "",
    height: Number(student.height) || 0,
    weight: Number(student.weight) || 0,
    goal: student.goal ?? "",
    experienceLevel: student.experienceLevel ?? "",
    trainingExperience: student.trainingExperience ?? "",
    hasLimitations: student.hasLimitations === true,
    limitations: student.limitations ?? "",
    onboardingCompleted: student.onboardingCompleted === true,
    onboardingUpdatedAt: student.onboardingUpdatedAt ?? "",
  };
}

export function onboardingIsComplete(student: Student) {
  return onboardingData(student).onboardingCompleted;
}

export function onboardingValidation(value: StudentOnboardingData, step: 1 | 2 | 3 | 4) {
  if (step === 1 || step === 4) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value.birthDate) || value.birthDate >= new Date().toISOString().slice(0, 10)) return "Ingresá una fecha de nacimiento válida.";
    if (value.height < 80 || value.height > 250) return "Ingresá una altura válida entre 80 y 250 cm.";
    if (value.weight < 25 || value.weight > 350) return "Ingresá un peso válido entre 25 y 350 kg.";
  }
  if ((step === 2 || step === 4) && !ONBOARDING_GOALS.includes(value.goal as (typeof ONBOARDING_GOALS)[number])) return "Elegí tu objetivo principal.";
  if (step === 3 || step === 4) {
    if (!EXPERIENCE_LEVELS.includes(value.experienceLevel as (typeof EXPERIENCE_LEVELS)[number])) return "Elegí tu nivel de experiencia.";
    if (!TRAINING_EXPERIENCE.includes(value.trainingExperience as (typeof TRAINING_EXPERIENCE)[number])) return "Indicá hace cuánto entrenás.";
    if (value.hasLimitations && value.limitations.trim().length < 3) return "Describí brevemente la molestia o limitación.";
  }
  return "";
}
