export const BM_TRAINING_START_DATE = "2026-02-09";

export function bmTrainingActivityStart(joinedAt?: string) {
  const value = typeof joinedAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(joinedAt) ? joinedAt : "";
  return value && value > BM_TRAINING_START_DATE ? value : BM_TRAINING_START_DATE;
}
