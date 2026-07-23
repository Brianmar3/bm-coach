export type AdminWorkoutSet = {
  id: string;
  setNumber: number;
  weight: number | null;
  repetitions: number | null;
  effort: number | null;
  completed: boolean;
  observation: string;
};

export type AdminWorkoutExercise = {
  id: string;
  exerciseId: string;
  name: string;
  targetSets: number;
  targetRepetitions: string;
  suggestedWeight: number | null;
  effortType: string;
  targetEffort: number | null;
  restSeconds: number | null;
  coachInstructions: string;
  legacySnapshot: boolean;
  studentObservation: string;
  sets: AdminWorkoutSet[];
  previous: { date: string; weight: number | null; repetitions: number | null; effort: number | null } | null;
};

export type AdminWorkoutSession = {
  id: string;
  studentId: string;
  studentName: string;
  routineId: string;
  routine: string;
  dayNumber: number;
  date: string;
  startTime: string;
  durationMinutes: number | null;
  status: "pending" | "in_progress" | "completed";
  energyBefore: number | null;
  difficulty: number | null;
  energyAfter: number | null;
  finalComment: string;
  hasPain: boolean;
  painDetails: string;
  updatedAt: string;
  exerciseCount: number;
  completedSets: number;
  pendingComments: number;
  exercises: AdminWorkoutExercise[];
};

export type AdminFollowUpData = {
  sessions: AdminWorkoutSession[];
  routines: Array<{ id: string; name: string }>;
  studentsWithoutTraining: Array<{ id: string; name: string }>;
};
