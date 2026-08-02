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

export type WorkoutArea = "lower" | "chest" | "back" | "shoulders" | "arms" | "core" | "general";

export function workoutAreaFromText(value: string): WorkoutArea {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
  if (/glute|pierna|cuadriceps|femoral|isqui|pantorrilla|tren inferior/.test(normalized)) return "lower";
  if (/pecho|pectoral/.test(normalized)) return "chest";
  if (/espalda|dorsal|lumbar/.test(normalized)) return "back";
  if (/hombro|deltoid/.test(normalized)) return "shoulders";
  if (/brazo|biceps|triceps|antebrazo/.test(normalized)) return "arms";
  if (/core|abdomen|abdominal/.test(normalized)) return "core";
  return "general";
}
