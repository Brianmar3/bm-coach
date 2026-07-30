export type ExerciseRecordSource = "QUICK_LOG" | "CLASS" | "ROUTINE";

export type ExerciseRecordFeedback = {
  id: string;
  trainerName: string;
  preset: string;
  text: string;
  createdAt: string;
  updatedAt: string;
};

export type UnifiedExerciseRecord = {
  id: string;
  source: ExerciseRecordSource;
  sourceId: string;
  sessionId: string;
  exerciseName: string;
  exerciseKey: string;
  date: string;
  createdAt: string;
  sets: number;
  repetitions: number;
  load: number;
  unit: string;
  setDetails: Array<{
    setNumber: number;
    weight: number;
    repetitions: number;
    unit: string;
  }>;
  context: string;
  originLabel: string;
  recordedByLabel: string;
  previous: {
    id: string;
    date: string;
    load: number;
    sets: number;
    repetitions: number;
    unit: string;
    source: ExerciseRecordSource;
  } | null;
  difference: number | null;
  marks: Array<"FIRST_MARK" | "MAX_LOAD" | "REPETITION_PR">;
  feedback: ExerciseRecordFeedback | null;
};
