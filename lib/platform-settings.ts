import { isSubscriptionPlan, type TrainerSubscriptionPlanValue } from "./trainer-subscription.ts";

export const PLATFORM_SETTINGS_ID = "main";
export const PLATFORM_INVITATION_DAY_OPTIONS = [1, 3, 7, 14, 30] as const;
export const PLATFORM_INITIAL_PERIOD_OPTIONS = [1, 3, 6, 12] as const;

export type PlatformSettingsValue = {
  platformName: string;
  supportEmail: string;
  invitationDays: number;
  defaultTrainerPlan: TrainerSubscriptionPlanValue;
  initialPeriodMonths: number;
};

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettingsValue = {
  platformName: "BM Training",
  supportEmail: "",
  invitationDays: 7,
  defaultTrainerPlan: "STARTER",
  initialPeriodMonths: 1,
};

export function parsePlatformSettings(value: unknown): PlatformSettingsValue | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const allowed = ["platformName", "supportEmail", "invitationDays", "defaultTrainerPlan", "initialPeriodMonths"];
  if (Object.keys(body).some((key) => !allowed.includes(key))) return null;
  const platformName = typeof body.platformName === "string" ? body.platformName.trim() : "";
  const supportEmail = typeof body.supportEmail === "string" ? body.supportEmail.trim().toLowerCase() : "";
  if (!platformName || platformName.length > 100 || supportEmail.length > 254 || supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) return null;
  if (!PLATFORM_INVITATION_DAY_OPTIONS.includes(body.invitationDays as typeof PLATFORM_INVITATION_DAY_OPTIONS[number])) return null;
  if (!PLATFORM_INITIAL_PERIOD_OPTIONS.includes(body.initialPeriodMonths as typeof PLATFORM_INITIAL_PERIOD_OPTIONS[number])) return null;
  if (!isSubscriptionPlan(body.defaultTrainerPlan)) return null;
  return { platformName, supportEmail, invitationDays: body.invitationDays as number, defaultTrainerPlan: body.defaultTrainerPlan, initialPeriodMonths: body.initialPeriodMonths as number };
}
