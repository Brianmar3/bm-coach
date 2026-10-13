import type { PortalWorkoutSession } from "../types/portal.ts";
export { workoutDayProgress as focusProgress } from "./workout-day-progress.ts";

export function currentFocusSet(exercise: PortalWorkoutSession["exercises"][number]) {
  return exercise.sets.findIndex(set => !set.completed);
}

/** Individual fields remain optional, matching the existing workout contract. */
export function focusSetValidation(set: Pick<PortalWorkoutSession["exercises"][number]["sets"][number], "weight" | "repetitions" | "effort">) {
  if (set.weight === null && set.repetitions === null && set.effort === null) return "Completá la serie para continuar: ingresá al menos un dato.";
  if (set.weight !== null && (!Number.isFinite(set.weight) || set.weight < 0 || set.weight > 1000)) return "El peso debe estar entre 0 y 1000 kg.";
  if (set.repetitions !== null && (!Number.isInteger(set.repetitions) || set.repetitions < 0 || set.repetitions > 1000)) return "Las repeticiones deben ser un entero entre 0 y 1000.";
  if (set.effort !== null && (!Number.isFinite(set.effort) || set.effort < 0 || set.effort > 10)) return "El esfuerzo debe estar entre 0 y 10.";
  return null;
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
