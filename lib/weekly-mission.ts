import { addDateDays, assignmentCoversDateKeys, studentIsActiveOnDate, weekRange, type WeeklyStudentStatusEvent } from "./weekly-attendance.ts";

export const WEEKLY_MISSION_REWARD = 15;

export type WeeklyMissionState = "ACTIVE" | "COMPLETED" | "EXPIRED";
export type WeeklyMissionView = {
  id: string;
  weekStart: string;
  weekEnd: string;
  type: "ATTENDANCE";
  title: string;
  target: number;
  progress: number;
  remaining: number;
  percentage: number;
  state: WeeklyMissionState;
  rewardPoints: number;
  completedAt: string | null;
  pointsAwardedAt: string | null;
  message: string;
};

export type WeeklyMissionAssignment = {
  scheduleId: string;
  assignedAt: string;
  endedAt: string | null;
  active: boolean;
  scheduleActive: boolean;
  dayOfWeek: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY";
};

const WEEKDAY = { MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5 } as const;

export function weeklyMissionTitle(target: number) {
  return target === 1 ? "Completá tu clase programada" : `Completá tus ${target} clases programadas`;
}

export function weeklyMissionMessage(progress: number, target: number, state: WeeklyMissionState) {
  if (state === "COMPLETED") return "¡Misión completada!";
  const remaining = Math.max(0, target - progress);
  if (progress === 0) return "Tu semana recién empieza.";
  if (remaining === 1) return "Te falta 1 clase para completar la misión.";
  return `Buen comienzo. Te quedan ${remaining} clases.`;
}

export function getWeeklyMissionProgress(input: {
  id: string;
  weekStart: string;
  weekEnd: string;
  target: number;
  title?: string;
  progress: number;
  state: WeeklyMissionState;
  rewardPoints?: number;
  completedAt?: Date | string | null;
  pointsAwardedAt?: Date | string | null;
}): WeeklyMissionView {
  const progress = Math.max(0, input.progress);
  const target = Math.max(1, input.target);
  const iso = (value: Date | string | null | undefined) => value ? (value instanceof Date ? value : new Date(value)).toISOString() : null;
  return {
    id: input.id,
    weekStart: input.weekStart,
    weekEnd: input.weekEnd,
    type: "ATTENDANCE",
    title: input.title?.trim() || weeklyMissionTitle(target),
    target,
    progress,
    remaining: Math.max(0, target - progress),
    percentage: Math.min(100, Math.round(progress / target * 100)),
    state: input.state,
    rewardPoints: input.rewardPoints ?? WEEKLY_MISSION_REWARD,
    completedAt: iso(input.completedAt),
    pointsAwardedAt: iso(input.pointsAwardedAt),
    message: weeklyMissionMessage(progress, target, input.state),
  };
}

export function weeklyMissionAttendanceProgress(records: Array<{ status: string }>) {
  return records.filter((record) => record.status === "PRESENT").length;
}

export function scheduledWeeklyMissionClasses(input: {
  referenceDate: string;
  joinedAt: string | null;
  statusEvents: WeeklyStudentStatusEvent[];
  assignments: WeeklyMissionAssignment[];
  cancelled: Array<{ scheduleId: string; date: string }>;
}) {
  const range = weekRange(input.referenceDate);
  if (!range) return [];
  const cancelled = new Set(input.cancelled.map((item) => `${item.scheduleId}|${item.date}`));
  const scheduled: Array<{ scheduleId: string; date: string }> = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDateDays(range.start, offset);
    const weekday = new Date(`${date}T12:00:00.000Z`).getUTCDay();
    if (!studentIsActiveOnDate(input.joinedAt, input.statusEvents, date)) continue;
    for (const assignment of input.assignments) {
      if (!assignment.scheduleActive || (!assignment.active && !assignment.endedAt)) continue;
      if (WEEKDAY[assignment.dayOfWeek] !== weekday) continue;
      if (!assignmentCoversDateKeys(assignment.assignedAt, assignment.endedAt, date)) continue;
      if (cancelled.has(`${assignment.scheduleId}|${date}`)) continue;
      scheduled.push({ scheduleId: assignment.scheduleId, date });
    }
  }
  return scheduled;
}
