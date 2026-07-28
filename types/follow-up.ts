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

export type AdminStudentFollowUp = {
  studentId: string;
  studentName: string;
  profileImageUrl: string;
  activeRoutine: {
    id: string;
    name: string;
    status: string;
    startDate: string;
  } | null;
  latestSession: AdminWorkoutSession | null;
  sessionCount: number;
  averageDuration: number | null;
  exerciseCount: number;
  completedSets: number;
  recentSessionCount: number;
  latestPainReport: {
    date: string;
    details: string;
  } | null;
  recentProgress: string;
  hasClassStrength: boolean;
};

export type AdminFollowUpData = {
  sessions: AdminWorkoutSession[];
  students: AdminStudentFollowUp[];
  classSessions: Array<{
    id: string;
    studentId: string;
    studentName: string;
    className: string;
    occurrenceId: string;
    date: string;
    status: "DRAFT" | "COMPLETED";
    notes: string;
    createdAt: string;
    updatedAt: string;
    exercises: Array<{ name: string; order: number; notes: string; sets: Array<{ setNumber: number; weight: number | null; repetitions: number | null; effort: number | null; unit: string; notes: string }> }>;
  }>;
  routines: Array<{ id: string; name: string }>;
  studentsWithoutTraining: Array<{ id: string; name: string }>;
};
