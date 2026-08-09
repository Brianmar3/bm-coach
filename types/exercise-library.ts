export type BMExerciseSource = "EXERCISES_DATASET";
export type BMExerciseTranslationStatus = "AUTOMATIC" | "EXCEPTION" | "REVIEW";
export type ExerciseLibraryFacet = { value: string; label: string };

export type BMExercise = {
  id: string;
  sourceId: string;
  name: string;
  displayName: string;
  displayNameEs: string;
  aliases: string[];
  translationStatus: BMExerciseTranslationStatus;
  translationPass: 1 | 2;
  bodyPart: string;
  bodyPartLabelEs: string;
  equipment: string;
  equipmentLabelEs: string;
  targetMuscle: string;
  targetMuscleLabelEs: string;
  muscleGroup: string;
  muscleGroupLabelEs: string;
  secondaryMuscles: string[];
  secondaryMusclesEs: string[];
  instructionsEs: string;
  instructionStepsEs: string[];
  thumbnailPath?: string;
  gifPath?: string;
  attribution?: string;
  source: BMExerciseSource;
  searchableText: string;
};

export type BMExerciseSummary = Omit<BMExercise, "instructionsEs" | "instructionStepsEs" | "secondaryMuscles" | "secondaryMusclesEs">;
export type ExerciseLibraryFilters = { query?: string; bodyPart?: string; equipment?: string; targetMuscle?: string };
export type ExerciseLibraryMatch = { name: string; status: "EXACT" | "NORMALIZED" | "AMBIGUOUS" | "NO_MATCH"; exerciseIds: string[] };
