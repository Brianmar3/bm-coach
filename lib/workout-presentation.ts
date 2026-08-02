type WorkoutExerciseProgress = {
  exerciseId: string;
  sets: Array<{ completed: boolean }>;
};

export function cleanRoutineDisplayName(value: string) {
  return value
    .replace(/(?:\s*\(\s*copia\s*\)|\s+-\s+copia)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function usefulDayName(dayNumber: number, value: string) {
  const name = value.replace(/\s+/g, " ").trim();
  if (!name) return "";
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
  return normalized === `dia ${dayNumber}` ? "" : name;
}

export function completedExerciseCount(exercises: WorkoutExerciseProgress[]) {
  return exercises.filter((exercise) => exercise.sets.length > 0 && exercise.sets.every((set) => set.completed)).length;
}

export function initialOpenExerciseId(exercises: WorkoutExerciseProgress[]) {
  return exercises.find((exercise) => !exercise.sets.length || exercise.sets.some((set) => !set.completed))?.exerciseId
    ?? exercises[0]?.exerciseId
    ?? null;
}

function normalizeMuscleGroupName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function getMuscleGroupEmoji(groupName: string) {
  const normalized = normalizeMuscleGroupName(groupName);
  if (/glute/.test(normalized)) return "🍑";
  if (/pierna|cuadriceps|isquio|femoral|gemelo|pantorrilla|aductor|abductor|tren inferior/.test(normalized)) return "🦵🏽";
  if (/pecho|pectoral|full body|cuerpo completo/.test(normalized)) return "🏋🏽";
  if (/espalda|dorsal|lumbar/.test(normalized)) return "💪🏽";
  if (/hombro|deltoid|brazo|biceps|triceps|antebrazo|tren superior/.test(normalized)) return "💪🏽";
  if (/core|abdomen|abdominal/.test(normalized)) return "🔥";
  if (/cardio|condicionamiento|resistencia/.test(normalized)) return "⚡";
  if (/movilidad|movility|flexibilidad/.test(normalized)) return "🤸🏽";
  return "🏋🏽";
}
