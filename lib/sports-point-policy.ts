
import { argentinaDateKey } from "./payment-dates.ts";
import { effectivePointDate, type ValidPointEvent } from "./point-event-rules.ts";
import { weekRange } from "./weekly-attendance.ts";
import type { StudentServiceType } from "@/types/gestion";

export const SPORTS_WEEKLY_BONUS = 5;

export function pointPolicyStart(value = process.env.BM_POINTS_POLICY_START) {
  if (!value || !/^\d{4}-\d{2}-01$/.test(value)) return "";
  const date = new Date(value + "T12:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : "";
}

export function activeSportsPointStart(today = argentinaDateKey()) {
  const start = pointPolicyStart();
  return start && start <= today ? start : "";
}

export function contractualFrequency(value: unknown): 2 | 3 | 4 | 5 | null {
  return value === 2 || value === 3 || value === 4 || value === 5 ? value : null;
}

export function validTrainingWeight(value: unknown) {
  const weight = Number(value);
  return Number.isFinite(weight) && weight > 0;
}

export type SportsContract = {
  start: string;
  end: string | null;
  serviceType: StudentServiceType;
  active: boolean;
  frequencyDays: number | null;
};

export type SportsActivity = {
  id: string;
  date: string;
  kind: "class" | "routine";
  hasWeight: boolean;
};

function contractOn(contracts: SportsContract[], day: string) {
  return contracts.find(contract => contract.start <= day && (!contract.end || day < contract.end));
}

export function sportsTrainingDays(
  activities: SportsActivity[],
  contracts: SportsContract[],
  serviceType: StudentServiceType,
) {
  const days = new Map<string, SportsActivity>();
  for (const activity of activities) {
    const contract = contractOn(contracts, activity.date);
    if (contracts.length && !contract?.active) continue;
    const service = contract?.serviceType ?? serviceType;
    if ((service === "CLASSES" && activity.kind !== "class") ||
        (service === "PERSONALIZED" && activity.kind !== "routine")) continue;
    const previous = days.get(activity.date);
    if (!previous || (!previous.hasWeight && activity.hasWeight)) days.set(activity.date, activity);
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function sportsWeeklyGoal(weekStart: string, days: SportsActivity[], contracts: SportsContract[]) {
  const week = weekRange(weekStart);
  if (!week) return null;
  // A midweek plan change does not move the goal. A new enrolment can use its first contract.
  const contract = contractOn(contracts, week.start) ??
    contracts.findLast(item => item.start < week.endExclusive && item.start >= week.start && item.active);
  const target = contract?.active ? contractualFrequency(contract.frequencyDays) : null;
  if (!target) return null;
  const eligible = days.filter(day => day.date >= week.start && day.date < week.endExclusive);
  return { weekStart: week.start, weekEnd: week.end, target, progress: eligible.length, completedAt: eligible[target - 1]?.date ?? null };
}

export function sportsWeeklyBonusKey(weekStart: string) {
  return "sports:weekly:" + weekStart;
}

export function buildSportsPointEvents(input: {
  start: string;
  today: string;
  days: SportsActivity[];
  contracts: SportsContract[];
  achievements: Array<{ id: string; date: string; name: string }>;
}) {
  const { start, today, days, contracts, achievements } = input;
  const valid = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= start && date <= today;
  const events: ValidPointEvent[] = [];
  const weeks = new Set<string>();
  for (const day of days) {
    if (!valid(day.date)) continue;
    const week = weekRange(day.date);
    if (week) weeks.add(week.start);
    const sourceType = day.kind === "class" ? "CLASS_OCCURRENCE_ATTENDANCE" : "WORKOUT_SESSION";
    const occurredAt = effectivePointDate(day.date);
    events.push({ eventKey: "sports:training:" + day.date, eventType: day.kind === "class" ? "ATTENDANCE" : "RECORD",
      sourceType, sourceId: day.id, occurredAt, points: 2, description: day.kind === "class" ? "Asistencia confirmada" : "Rutina completada" });
    if (day.hasWeight) events.push({ eventKey: "sports:load:" + day.date, eventType: "RECORD",
      sourceType, sourceId: day.id, occurredAt, points: 1, description: "Pesos registrados en el entrenamiento" });
  }
  for (const week of weeks) {
    const goal = sportsWeeklyGoal(week, days, contracts);
    if (!goal?.completedAt || !valid(goal.completedAt)) continue;
    events.push({ eventKey: sportsWeeklyBonusKey(week), eventType: "WEEKLY_MISSION", sourceType: "WEEKLY_MISSION",
      sourceId: week, occurredAt: effectivePointDate(goal.completedAt), points: SPORTS_WEEKLY_BONUS, description: "Objetivo semanal completado" });
  }
  const awarded = new Set<string>();
  for (const item of [...achievements].sort((a, b) => a.date.localeCompare(b.date))) {
    if (awarded.has(item.id)) continue;
    awarded.add(item.id);
    if (!valid(item.date)) continue;
    const contract = contractOn(contracts, item.date);
    if (contracts.length && !contract?.active) continue;
    events.push({ eventKey: "achievement:" + item.id, eventType: "ACHIEVEMENT", sourceType: "ACHIEVEMENT",
      sourceId: item.id, occurredAt: effectivePointDate(item.date), points: 3, description: item.name });
  }
  return events;
}

