export type ExerciseRestTimerStatus = "ready" | "running" | "paused" | "finished";

export type ExerciseRestTimerState = {
  exerciseId: string;
  durationSeconds: number;
  remainingSeconds: number;
  endTimestamp: number | null;
  status: ExerciseRestTimerStatus;
};

export type ExerciseRestTimerAction = "START" | "PAUSE" | "RESUME" | "RESET";

export function initialExerciseRestTimer(exerciseId: string, durationSeconds: number): ExerciseRestTimerState {
  return { exerciseId, durationSeconds, remainingSeconds: durationSeconds, endTimestamp: null, status: "ready" };
}

export function exerciseRestSeconds(state: ExerciseRestTimerState, nowMs: number) {
  if (state.status !== "running" || state.endTimestamp === null) return state.remainingSeconds;
  return Math.max(0, Math.ceil((state.endTimestamp - nowMs) / 1_000));
}

export function reduceExerciseRestTimer(state: ExerciseRestTimerState, action: ExerciseRestTimerAction, nowMs: number): ExerciseRestTimerState {
  if (action === "START" && (state.status === "ready" || state.status === "finished")) {
    return { ...state, remainingSeconds: state.durationSeconds, endTimestamp: nowMs + state.durationSeconds * 1_000, status: "running" };
  }
  if (action === "PAUSE" && state.status === "running") {
    return { ...state, remainingSeconds: exerciseRestSeconds(state, nowMs), endTimestamp: null, status: "paused" };
  }
  if (action === "RESUME" && state.status === "paused") {
    return { ...state, endTimestamp: nowMs + state.remainingSeconds * 1_000, status: "running" };
  }
  if (action === "RESET") return initialExerciseRestTimer(state.exerciseId, state.durationSeconds);
  return state;
}

export function finishExerciseRestTimer(state: ExerciseRestTimerState): ExerciseRestTimerState {
  return { ...state, remainingSeconds: 0, endTimestamp: null, status: "finished" };
}

export function formatExerciseRestTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

export function exerciseRestDurationLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return [minutes ? `${minutes} ${minutes === 1 ? "minuto" : "minutos"}` : "", remainder ? `${remainder} ${remainder === 1 ? "segundo" : "segundos"}` : ""].filter(Boolean).join(" ");
}
