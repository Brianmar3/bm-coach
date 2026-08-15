export type RoutineFollowUpState = "on_track" | "attention" | "no_data";

const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

export function expectedRoutineSessions(input: {
  assignedAt: Date | string;
  startDate?: Date | string | null;
  durationWeeks?: number | null;
  plannedDays: number;
  today?: Date;
}) {
  if (input.plannedDays <= 0) return 0;
  const assigned = startOfDay(new Date(input.assignedAt));
  const routineStart = input.startDate ? startOfDay(new Date(input.startDate)) : assigned;
  const effectiveStart = routineStart > assigned ? routineStart : assigned;
  const today = startOfDay(input.today ?? new Date());
  if (effectiveStart > today) return 0;
  const elapsedWeeks = Math.floor((today.getTime() - effectiveStart.getTime()) / 604_800_000);
  const completedWeeks = input.durationWeeks ? Math.min(elapsedWeeks, input.durationWeeks) : elapsedWeeks;
  return Math.max(0, completedWeeks) * input.plannedDays;
}

export function routineCompliance(completedSessions: number, expectedSessions: number) {
  if (expectedSessions <= 0) return null;
  return Math.min(100, Math.round((completedSessions / expectedSessions) * 100));
}

export function routineFollowUpState(input: {
  completedSessions: number;
  expectedSessions: number;
  hasActivePain: boolean;
}) : { state: RoutineFollowUpState; attentionReason: string } {
  if (input.hasActivePain) return { state: "attention", attentionReason: "Molestia activa reportada" };
  if (input.expectedSessions > input.completedSessions) {
    const missing = input.expectedSessions - input.completedSessions;
    return { state: "attention", attentionReason: `${missing} ${missing === 1 ? "sesión pendiente" : "sesiones pendientes"} del plan` };
  }
  if (input.completedSessions > 0) return { state: "on_track", attentionReason: "" };
  return { state: "no_data", attentionReason: "" };
}

export function followUpSummary(students: Array<{ state: RoutineFollowUpState; sessionCount: number }>) {
  const trackedStudents = students.length;
  const onTrack = students.filter((student) => student.state === "on_track").length;
  const attention = students.filter((student) => student.state === "attention").length;
  const percent = (value: number) => trackedStudents ? Math.round((value / trackedStudents) * 100) : 0;
  return {
    trackedStudents,
    onTrack,
    onTrackPercentage: percent(onTrack),
    attention,
    attentionPercentage: percent(attention),
    averageSessions: trackedStudents
      ? Number((students.reduce((sum, student) => sum + student.sessionCount, 0) / trackedStudents).toFixed(1))
      : 0,
  };
}

export function bodyMetricDelta(values: Array<number | null>) {
  const present = values.filter((value): value is number => value !== null);
  return present.length > 1 ? Number((present.at(-1)! - present[0]).toFixed(1)) : null;
}
