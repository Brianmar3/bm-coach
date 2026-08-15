import type { BlockInput, ExerciseInput } from "./rutinas.ts";
import { persistedRoutineExerciseVideoUrl } from "./routine-exercise-draft.ts";
import { libraryExerciseIdFromMediaUrl } from "./routine-exercise-media.ts";
import type { RoutineExerciseDraft } from "./routine-exercise-draft.ts";

export type EditableTrainingBlockDraft = Omit<BlockInput, "id" | "exercises"> & {
  id?: string;
  clientId: string;
  exercises: RoutineExerciseDraft[];
};

function canonicalExercise(exercise: ExerciseInput, order: number): ExerciseInput {
  return {
    name: exercise.name.trim(),
    muscleGroup: exercise.muscleGroup.trim(),
    sets: exercise.sets,
    repetitions: exercise.repetitions.trim(),
    weight: exercise.weight,
    effortType: exercise.effortType,
    effortValue: exercise.effortValue,
    restSeconds: exercise.restSeconds,
    observations: exercise.observations?.trim() ?? "",
    videoUrl: exercise.videoUrl?.trim() ?? "",
    tempo: exercise.tempo?.trim() ?? "",
    alternativeExercise: exercise.alternativeExercise?.trim() ?? "",
    equipment: exercise.equipment?.trim() ?? "",
    optional: Boolean(exercise.optional),
    targetType: exercise.targetType,
    targetSeconds: exercise.targetSeconds,
    targetRepetitions: exercise.targetRepetitions?.trim() ?? "",
    targetDistance: exercise.targetDistance?.trim() ?? "",
    targetSide: exercise.targetSide?.trim() ?? "",
    order,
  };
}

export function canonicalTrainingLibraryBlock(block: BlockInput, name = block.name): BlockInput {
  return {
    type: block.type,
    name: name.trim(),
    order: 1,
    rounds: block.rounds,
    durationSeconds: block.durationSeconds,
    workSeconds: block.workSeconds,
    restSeconds: block.restSeconds,
    restBetweenRoundsSeconds: block.restBetweenRoundsSeconds,
    targetRounds: block.targetRounds,
    instructions: block.instructions?.trim() ?? "",
    exercises: block.exercises.map((exercise, index) => canonicalExercise(exercise, index + 1)),
  };
}

export function editableBlockToLibrarySnapshot(block: EditableTrainingBlockDraft, name = block.name): BlockInput {
  return canonicalTrainingLibraryBlock({
    ...block,
    id: undefined,
    exercises: block.exercises.map((exercise) => ({
      ...exercise,
      id: undefined,
      blockId: undefined,
      videoUrl: persistedRoutineExerciseVideoUrl(exercise),
    })),
  }, name);
}

export function librarySnapshotToEditableBlock(
  snapshot: BlockInput,
  order: number,
  createId: () => string = () => crypto.randomUUID(),
): EditableTrainingBlockDraft {
  const canonical = canonicalTrainingLibraryBlock(snapshot);
  return {
    ...canonical,
    id: undefined,
    clientId: createId(),
    order,
    exercises: canonical.exercises.map((exercise, index) => ({
      ...exercise,
      id: undefined,
      blockId: undefined,
      clientId: createId(),
      libraryExerciseId: libraryExerciseIdFromMediaUrl(exercise.videoUrl) ?? undefined,
      order: index + 1,
    })),
  };
}
