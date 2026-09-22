import type { TrainerSubscriptionPlanValue } from "./trainer-subscription.ts";

const PLAN_STUDENT_LIMITS: Record<TrainerSubscriptionPlanValue, number | null> = {
  FREE: 5,
  STARTER: 20,
  PRO: 50,
  PREMIUM: null,
};

export function getTrainerPlanLimits(plan: TrainerSubscriptionPlanValue) {
  return { studentLimit: PLAN_STUDENT_LIMITS[plan] } as const;
}

export function isActiveManagedStudentData(value: unknown) {
  if (!value || typeof value !== "object") return true;
  const data = value as Record<string, unknown>;
  if (data.accountType === "SELF_SERVICE") return false;
  const status = String(data.lifecycleStatus ?? data.status ?? "activo").toLocaleLowerCase("es");
  return !["inactivo", "suspendido", "archivado", "inactive", "suspended", "archived"].includes(status);
}

export function countActiveManagedStudents(records: Array<{ data: unknown }>) {
  return records.filter((record) => isActiveManagedStudentData(record.data)).length;
}

export function trainerStudentCapacity(plan: TrainerSubscriptionPlanValue, used: number) {
  const limit = getTrainerPlanLimits(plan).studentLimit;
  return { plan, used, limit, reached: limit !== null && used >= limit, nearLimit: limit !== null && used >= Math.ceil(limit * 0.8) };
}

export function trainerStudentLimitMessage(limit: number) {
  return `Alcanzaste el límite de ${limit} alumnos de tu plan.`;
}
