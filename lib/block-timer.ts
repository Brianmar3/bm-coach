import type { TrainingBlockType } from "../types/gestion.ts";

export type TimedTrainingBlockType = Extract<TrainingBlockType, "INTERVAL" | "EMOM" | "AMRAP" | "FOR_TIME">;
export type BlockTimerStatus = "idle" | "running" | "paused" | "finished";
export type BlockTimerAction = "START" | "PAUSE" | "RESUME" | "RESET" | "FINISH";

export type BlockTimerState = {
  version: 1;
  blockId: string;
  blockType: TimedTrainingBlockType;
  status: BlockTimerStatus;
  elapsedSeconds: number;
  anchorTimeMs: number | null;
  lastAction: BlockTimerAction | null;
  lastActionAt: number;
};

export type BlockTimerExercise = { exerciseId: string; name: string; order: number };
export type BlockTimerConfiguration = {
  rounds: number | null;
  durationSeconds: number | null;
  workSeconds: number | null;
  restSeconds: number | null;
  restBetweenRoundsSeconds: number | null;
  exercises: BlockTimerExercise[];
};

export type IntervalSegment = {
  kind: "WORK" | "REST" | "ROUND_REST";
  durationSeconds: number;
  round: number;
  exerciseIndex: number;
};

const doubleActionWindowMs = 350;
export const timedBlockTypes: TimedTrainingBlockType[] = ["INTERVAL", "EMOM", "AMRAP", "FOR_TIME"];

export function isTimedBlockType(type: TrainingBlockType): type is TimedTrainingBlockType {
  return timedBlockTypes.includes(type as TimedTrainingBlockType);
}

export function initialBlockTimer(blockId: string, blockType: TimedTrainingBlockType): BlockTimerState {
  return { version: 1, blockId, blockType, status: "idle", elapsedSeconds: 0, anchorTimeMs: null, lastAction: null, lastActionAt: 0 };
}

export function elapsedBlockSeconds(state: BlockTimerState, nowMs: number) {
  if (state.status !== "running" || state.anchorTimeMs === null) return state.elapsedSeconds;
  return state.elapsedSeconds + Math.max(0, Math.floor((nowMs - state.anchorTimeMs) / 1000));
}

export function reduceBlockTimer(state: BlockTimerState, action: BlockTimerAction, nowMs: number): BlockTimerState {
  if (state.lastAction === action && nowMs - state.lastActionAt < doubleActionWindowMs) return state;
  const elapsedSeconds = elapsedBlockSeconds(state, nowMs);
  if (action === "START" && state.status === "idle") return { ...state, status: "running", anchorTimeMs: nowMs, lastAction: action, lastActionAt: nowMs };
  if (action === "PAUSE" && state.status === "running") return { ...state, status: "paused", elapsedSeconds, anchorTimeMs: null, lastAction: action, lastActionAt: nowMs };
  if (action === "RESUME" && state.status === "paused") return { ...state, status: "running", anchorTimeMs: nowMs, lastAction: action, lastActionAt: nowMs };
  if (action === "RESET") return { ...initialBlockTimer(state.blockId, state.blockType), lastAction: action, lastActionAt: nowMs };
  if (action === "FINISH" && state.status !== "finished") return { ...state, status: "finished", elapsedSeconds, anchorTimeMs: null, lastAction: action, lastActionAt: nowMs };
  return state;
}

export function intervalSegments(configuration: BlockTimerConfiguration): IntervalSegment[] {
  const rounds = Math.max(1, configuration.rounds ?? 1);
  const exercises = configuration.exercises.length ? configuration.exercises : [{ exerciseId: "interval", name: "Trabajo", order: 1 }];
  const work = Math.max(1, configuration.workSeconds ?? 1);
  const rest = Math.max(0, configuration.restSeconds ?? 0);
  const roundRest = Math.max(0, configuration.restBetweenRoundsSeconds ?? rest);
  const segments: IntervalSegment[] = [];
  for (let round = 1; round <= rounds; round += 1) {
    exercises.forEach((_, exerciseIndex) => {
      segments.push({ kind: "WORK", durationSeconds: work, round, exerciseIndex });
      const lastExercise = exerciseIndex === exercises.length - 1;
      const finalWork = lastExercise && round === rounds;
      const pause = lastExercise ? roundRest : rest;
      if (!finalWork && pause > 0) segments.push({ kind: lastExercise ? "ROUND_REST" : "REST", durationSeconds: pause, round, exerciseIndex });
    });
  }
  return segments;
}

function intervalPosition(configuration: BlockTimerConfiguration, elapsedSeconds: number) {
  const segments = intervalSegments(configuration);
  let consumed = 0;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (elapsedSeconds < consumed + segment.durationSeconds) {
      const nextWork = segments.slice(index + 1).find((candidate) => candidate.kind === "WORK");
      return { segment, segmentIndex: index, segmentRemaining: consumed + segment.durationSeconds - elapsedSeconds, nextExerciseIndex: nextWork?.exerciseIndex ?? null };
    }
    consumed += segment.durationSeconds;
  }
  const last = segments.at(-1) ?? { kind: "WORK" as const, durationSeconds: 1, round: 1, exerciseIndex: 0 };
  return { segment: last, segmentIndex: Math.max(0, segments.length - 1), segmentRemaining: 0, nextExerciseIndex: null };
}

export function blockTimerView(state: BlockTimerState, configuration: BlockTimerConfiguration, nowMs: number) {
  const elapsedSeconds = elapsedBlockSeconds(state, nowMs);
  if (state.blockType === "INTERVAL") {
    const segments = intervalSegments(configuration);
    const totalSeconds = segments.reduce((sum, segment) => sum + segment.durationSeconds, 0);
    const position = intervalPosition(configuration, Math.min(elapsedSeconds, totalSeconds));
    return { elapsedSeconds, totalSeconds, remainingSeconds: Math.max(0, totalSeconds - elapsedSeconds), finished: elapsedSeconds >= totalSeconds, ...position };
  }
  const totalSeconds = state.blockType === "FOR_TIME" ? null : Math.max(1, configuration.durationSeconds ?? 1);
  const finished = totalSeconds !== null && elapsedSeconds >= totalSeconds;
  return {
    elapsedSeconds,
    totalSeconds,
    remainingSeconds: totalSeconds === null ? null : Math.max(0, totalSeconds - elapsedSeconds),
    finished,
    minute: state.blockType === "EMOM" ? Math.min(Math.ceil((totalSeconds ?? 1) / 60), Math.floor(elapsedSeconds / 60) + 1) : null,
    minuteRemaining: state.blockType === "EMOM" ? Math.min(Math.max(0, (totalSeconds ?? 0) - elapsedSeconds), 60 - elapsedSeconds % 60) : null,
    exerciseIndex: state.blockType === "EMOM" && configuration.exercises.length ? Math.floor(elapsedSeconds / 60) % configuration.exercises.length : 0,
  };
}

export function formatTimerClock(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60).toString().padStart(2, "0");
  return `${minutes}:${(safe % 60).toString().padStart(2, "0")}`;
}

export function serializeBlockTimer(state: BlockTimerState) {
  return JSON.stringify(state);
}

export function parseBlockTimer(value: string | null, blockId: string, blockType: TimedTrainingBlockType): BlockTimerState | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<BlockTimerState>;
    if (parsed.version !== 1 || parsed.blockId !== blockId || parsed.blockType !== blockType || !["idle", "running", "paused", "finished"].includes(parsed.status ?? "")) return null;
    if (!Number.isInteger(parsed.elapsedSeconds) || (parsed.elapsedSeconds ?? -1) < 0 || (parsed.anchorTimeMs !== null && !Number.isFinite(parsed.anchorTimeMs))) return null;
    return parsed as BlockTimerState;
  } catch {
    return null;
  }
}
