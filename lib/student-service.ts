import type { StudentServiceType } from "@/types/gestion";

export const STUDENT_SERVICE_OPTIONS: Array<{
  value: StudentServiceType;
  label: string;
  description: string;
}> = [
  {
    value: "CLASSES",
    label: "Clases",
    description: "Participa en clases grupales y utiliza asistencia, horarios y confirmaciones.",
  },
  {
    value: "PERSONALIZED",
    label: "Personalizado",
    description: "Recibe rutinas y seguimiento individual, sin clases grupales.",
  },
  {
    value: "MIXED",
    label: "Mixto",
    description: "Combina clases grupales con seguimiento y rutinas personalizadas.",
  },
];

export function isStudentServiceType(value: unknown): value is StudentServiceType {
  return value === "CLASSES" || value === "PERSONALIZED" || value === "MIXED";
}

export function studentServiceLabel(value: StudentServiceType) {
  return STUDENT_SERVICE_OPTIONS.find((option) => option.value === value)?.label ?? "Clases";
}

export function hasGroupClasses(value: StudentServiceType) {
  return value === "CLASSES" || value === "MIXED";
}

export function hasPersonalizedService(value: StudentServiceType) {
  return value === "PERSONALIZED" || value === "MIXED";
}

export function isCompetitiveGamificationEligible(value: StudentServiceType) {
  return value === "CLASSES" || value === "MIXED";
}

export function isAchievementEligibleForService(
  value: StudentServiceType,
  achievement: { category?: string; source?: string },
) {
  if (isCompetitiveGamificationEligible(value)) return true;
  return achievement.source !== "CLASS" && achievement.category !== "ASISTENCIA" && achievement.category !== "CLASES";
}

export function wasCompetitiveDuringMembership(
  occurredAt: Date,
  periods: Array<{ startDate: Date; endDate: Date | null; serviceType: StudentServiceType }>,
) {
  if (!periods.length) return true;
  return periods.some((period) => isCompetitiveGamificationEligible(period.serviceType) && occurredAt >= period.startDate && (!period.endDate || occurredAt < period.endDate));
}
