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

export function exerciseCompletesWithSetChange(exercise: WorkoutExerciseProgress, setIndex: number, completed: boolean) {
  return completed
    && exercise.sets[setIndex]?.completed === false
    && exercise.sets.every((set, index) => index === setIndex || set.completed);
}

export function nextIncompleteExerciseId(exercises: WorkoutExerciseProgress[], currentExerciseId: string) {
  const currentIndex = exercises.findIndex((exercise) => exercise.exerciseId === currentExerciseId);
  if (currentIndex < 0) return null;
  return exercises.slice(currentIndex + 1).find((exercise) => !exercise.sets.length || exercise.sets.some((set) => !set.completed))?.exerciseId ?? null;
}
