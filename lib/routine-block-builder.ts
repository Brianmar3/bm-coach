import { canonicalTrainingLibraryBlock } from "./training-library-block-draft.ts";
import type { TrainingRoutineDay } from "../types/gestion.ts";
import type { TrainingLibraryBlock } from "../types/training-library.ts";

export type RoutineAssemblyDayDetails = Pick<TrainingRoutineDay, "name" | "objective" | "warmup" | "observations" | "estimatedMinutes">;

export function routineDayAsBlocks(day: TrainingRoutineDay): TrainingLibraryBlock[] {
  const sources = day.blocks.length ? day.blocks : [{ type: "STRENGTH" as const, name: day.name,
    order: 1, rounds: null, durationSeconds: null, workSeconds: null, restSeconds: null,
    restBetweenRoundsSeconds: null, targetRounds: null, instructions: "", exercises: day.exercises }];
  return sources.map((block, index) => ({
    id: `copied:${day.id}:${index}`, name: block.name, type: block.type,
    content: canonicalTrainingLibraryBlock({ ...block, id: undefined,
      exercises: block.exercises.map(exercise => ({ ...exercise, id: undefined, blockId: undefined,
        weight: null, effortValue: null })) }),
    folder: null, tags: [], status: "active", isFavorite: false,
    lastUsedAt: "", archivedAt: "", createdAt: "", updatedAt: "",
  }));
}
