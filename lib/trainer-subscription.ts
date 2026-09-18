export const TRAINER_SUBSCRIPTION_PLANS = ["STARTER", "PRO", "PREMIUM"] as const;
export const TRAINER_SUBSCRIPTION_STATUSES = ["ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED"] as const;
export const TRAINER_SUBSCRIPTION_PERIODS = [1, 3, 6, 12] as const;

export type TrainerSubscriptionPlanValue = typeof TRAINER_SUBSCRIPTION_PLANS[number];
export type TrainerSubscriptionStatusValue = typeof TRAINER_SUBSCRIPTION_STATUSES[number];

type SubscriptionStatusInput = { status: TrainerSubscriptionStatusValue; nextDueAt: Date | string | null };

export function effectiveTrainerSubscriptionStatus(subscription: SubscriptionStatusInput, now = new Date()): TrainerSubscriptionStatusValue {
  if (subscription.status === "ACTIVE" && subscription.nextDueAt && new Date(subscription.nextDueAt) < now) return "PAST_DUE";
  return subscription.status;
}

export function addUtcMonths(value: Date, months: number) {
  const result = new Date(value);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export function parseDateInput(value: unknown) {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : undefined;
}

export function validSubscriptionTimeline(input: { startedAt: Date; lastPaidAt: Date | null; currentPeriodEnd: Date | null; nextDueAt: Date | null }) {
  return [input.lastPaidAt, input.currentPeriodEnd, input.nextDueAt].every((date) => !date || date >= input.startedAt);
}

export function isSubscriptionPlan(value: unknown): value is TrainerSubscriptionPlanValue {
  return typeof value === "string" && TRAINER_SUBSCRIPTION_PLANS.includes(value as TrainerSubscriptionPlanValue);
}

export function isSubscriptionStatus(value: unknown): value is TrainerSubscriptionStatusValue {
  return typeof value === "string" && TRAINER_SUBSCRIPTION_STATUSES.includes(value as TrainerSubscriptionStatusValue);
}

export function isSubscriptionPeriod(value: unknown): value is typeof TRAINER_SUBSCRIPTION_PERIODS[number] {
  return typeof value === "number" && TRAINER_SUBSCRIPTION_PERIODS.includes(value as typeof TRAINER_SUBSCRIPTION_PERIODS[number]);
}
