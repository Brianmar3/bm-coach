export function normalizeExerciseName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
}
