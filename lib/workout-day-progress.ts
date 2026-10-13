import type { PortalWorkoutBlock, PortalWorkoutSession } from "../types/portal.ts";

const positive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;
const fraction = (value: unknown, total: number) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(value, total)) / total : 0;

/** One non-strength block is one unit. Only persisted, verifiable results contribute. */
export function workoutBlockProgress(block: PortalWorkoutBlock) {
  if (block.result.completed) return 1;
  // Keep the existing explicit completion checkpoint: reaching a target alone
  // must not silently finish a timed block or permit premature session closure.
  if (block.blockType === "ROUNDS" && positive(block.configuration.rounds)) return fraction(block.result.roundsCompleted, block.configuration.rounds) * block.configuration.rounds / (block.configuration.rounds + 1);
  if (block.blockType === "EMOM" && positive(block.configuration.durationSeconds)) return fraction(block.result.minutesCompleted, Math.ceil(block.configuration.durationSeconds / 60)) * Math.ceil(block.configuration.durationSeconds / 60) / (Math.ceil(block.configuration.durationSeconds / 60) + 1);
  if (["MOBILITY", "FREE", "ROUNDS"].includes(block.blockType)) {
    const ids = new Set(block.exercises.map(exercise => exercise.exerciseId));
    const done = new Set(block.result.completedExerciseIds.filter(id => ids.has(id))).size;
    return done / (ids.size + 1);
  }
  // INTERVAL/AMRAP/FOR_TIME expose no persisted bounded partial completion
  // during execution. Elapsed timer time or open-ended rounds are not progress.
  return 0;
}

export function workoutDayProgress(session: Pick<PortalWorkoutSession, "exercises" | "blocks">) {
  const blocks = (session.blocks ?? []).filter(block => block.blockType !== "STRENGTH");
  const total = session.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0) + blocks.length;
  const complete = session.exercises.reduce((sum, exercise) => sum + exercise.sets.filter(set => set.completed).length, 0) + blocks.reduce((sum, block) => sum + workoutBlockProgress(block), 0);
  // Avoid rounding 99.x to 100 while a real completion checkpoint is pending.
  const percentage = total ? Math.min(100, Math.max(0, complete / total * 100)) : 0;
  return { total, complete, percentage };
}

export function workoutProgressPercentLabel(percentage: number) {
  return percentage >= 100 ? 100 : Math.min(99, Math.max(0, Math.round(percentage)));
}
