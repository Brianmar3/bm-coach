import type { PortalWorkoutSession } from "../types/portal.ts";

export function currentFocusSet(exercise: PortalWorkoutSession["exercises"][number]) {
  return exercise.sets.findIndex(set => !set.completed);
}

export function focusProgress(session: PortalWorkoutSession) {
  const total = session.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0) + (session.blocks ?? []).filter(block => block.blockType !== "STRENGTH").length;
  const complete = session.exercises.reduce((sum, exercise) => sum + exercise.sets.filter(set => set.completed).length, 0) + (session.blocks ?? []).filter(block => block.blockType !== "STRENGTH" && block.result.completed).length;
  return { total, complete, percentage: total ? complete / total * 100 : 0 };
}

// Existing session dates/times are Argentina wall time, with minute precision.
export function workoutElapsedSeconds(session: Pick<PortalWorkoutSession, "date" | "startTime">, now: number, localStartedAt?: number | null) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(session.date) || !/^\d{2}:\d{2}$/.test(session.startTime)) return 0;
  const start = Date.parse(`${session.date.slice(0, 10)}T${session.startTime}:00-03:00`);
  const preciseStart = localStartedAt && Number.isFinite(localStartedAt) && localStartedAt >= start && localStartedAt < start + 60000 ? localStartedAt : start;
  return Number.isFinite(preciseStart) ? Math.max(0, Math.floor((now - preciseStart) / 1000)) : 0;
}

export function focusCompletionTarget(session: PortalWorkoutSession, exerciseId: string) {
  const exercise = session.exercises.find(item => item.exerciseId === exerciseId);
  if (!exercise?.sets.length || exercise.sets.some(set => !set.completed)) return undefined;
  const index = session.exercises.indexOf(exercise);
  return [...session.exercises.slice(index + 1), ...session.exercises.slice(0, index)].find(item => item.sets.some(set => !set.completed))?.exerciseId ?? null;
}
