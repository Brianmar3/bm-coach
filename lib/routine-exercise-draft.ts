import { libraryExerciseIdFromMediaUrl, libraryExerciseReferenceUrl } from "./routine-exercise-media.ts";
import type { BMExercise } from "../types/exercise-library.ts";
import type { TrainingBlockType, TrainingExercise } from "../types/gestion.ts";

export type RoutineExerciseDraft = Omit<TrainingExercise, "id" | "blockId"> & {
  id?: string;
  clientId: string;
  libraryExerciseId?: string;
};

export function createEmptyRoutineExerciseDraft(
  order: number,
  type: TrainingBlockType = "STRENGTH",
  createId: () => string = () => crypto.randomUUID(),
): RoutineExerciseDraft {
  return {
    clientId: createId(),
    name: "",
    muscleGroup: "",
    sets: type === "STRENGTH" ? 3 : 1,
    repetitions: type === "STRENGTH" ? "10-12" : "-",
    weight: null,
    effortType: "RIR",
    effortValue: type === "STRENGTH" ? 2 : null,
    restSeconds: type === "STRENGTH" ? 90 : null,
    observations: "",
    videoUrl: "",
    tempo: "",
    alternativeExercise: "",
    equipment: "",
    optional: false,
    targetType: type === "INTERVAL" || type === "MOBILITY" ? "TIME" : "REPS",
    targetSeconds: type === "MOBILITY" ? 30 : null,
    targetRepetitions: type === "STRENGTH" || type === "INTERVAL" || type === "MOBILITY" ? "" : "10",
    targetDistance: "",
    targetSide: "",
    order,
  };
}

export function applyLibraryExerciseSelection(
  exercises: RoutineExerciseDraft[],
  targetClientId: string | null,
  item: BMExercise,
) {
  if (!targetClientId) return exercises;
  return exercises.map((exercise) => exercise.clientId === targetClientId ? {
    ...exercise,
    libraryExerciseId: item.id,
    name: item.displayNameEs,
    muscleGroup: item.targetMuscleLabelEs || item.muscleGroupLabelEs,
    equipment: item.equipmentLabelEs,
    videoUrl: libraryExerciseReferenceUrl(item.id),
  } : exercise);
}

export function persistedRoutineExerciseVideoUrl(exercise: RoutineExerciseDraft) {
  const libraryExerciseId = exercise.libraryExerciseId ?? libraryExerciseIdFromMediaUrl(exercise.videoUrl);
  return libraryExerciseId ? libraryExerciseReferenceUrl(libraryExerciseId) : exercise.videoUrl.trim();
}

export function unlinkLibraryExercise(exercise: RoutineExerciseDraft): RoutineExerciseDraft {
  return { ...exercise, libraryExerciseId: undefined, videoUrl: "" };
}

export function removeRoutineExerciseDraft(exercises: RoutineExerciseDraft[], targetClientId: string) {
  return exercises
    .filter((exercise) => exercise.clientId !== targetClientId)
    .map((exercise, index) => ({ ...exercise, order: index + 1 }));
}
