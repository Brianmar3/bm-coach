export type QuickLogPointFacts = {
  type: string;
  metricType?: string;
  exerciseName?: string;
  durationMinutes?: number | null;
  sets?: number | null;
  repetitions?: number | null;
  currentValue?: number | null;
  previousValue?: number | null;
};

const positive = (value: number | null | undefined) => typeof value === "number" && Number.isFinite(value) && value > 0;
const nonnegative = (value: number | null | undefined) => typeof value === "number" && Number.isFinite(value) && value >= 0;

/** Only existing measurable progress/activity formats earn the existing record reward. */
export function isPointEligibleQuickLog(log: QuickLogPointFacts): boolean {
  if (log.type === "PROGRESS") {
    if (!log.exerciseName?.trim()) return false;
    if (log.metricType === "carga") return positive(log.sets) && positive(log.repetitions);
    return ["peso", "repeticiones", "series", "tiempo", "distancia", "técnica", "percepción personal"].includes(log.metricType ?? "") && nonnegative(log.currentValue);
  }
  if (log.type !== "WORKOUT") return false;
  switch (log.metricType) {
    case "for_time": return positive(log.currentValue);
    case "rounds": return positive(log.sets);
    case "amrap": case "emom": return positive(log.sets) && positive(log.durationMinutes);
    case "cardio": return positive(log.durationMinutes);
    case "intervals": return positive(log.sets) && positive(log.currentValue) && positive(log.previousValue);
    // The original manual workout form records activity through duration.
    case "": case undefined: case "peso": return positive(log.durationMinutes);
    default: return false;
  }
}
