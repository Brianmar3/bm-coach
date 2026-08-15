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

export type AdminFollowUpState = "on_track" | "attention" | "no_data";

export type AdminStudentFollowUp = {
  studentId: string;
  studentName: string;
  profileImageUrl: string;
  activeRoutine: {
    id: string;
    name: string;
    location: string;
    status: string;
    startDate: string;
    assignedAt: string;
    durationWeeks: number | null;
    plannedDays: number;
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
  expectedSessionCount: number;
  compliancePercentage: number | null;
  state: AdminFollowUpState;
  attentionReason: string;
};

export type AdminBodyEvaluationPoint = {
  id: string;
  date: string;
  weight: number | null;
  bodyFatPercentage: number | null;
  muscleMass: number | null;
};

export type AdminExerciseProgress = {
  exerciseId: string;
  name: string;
  points: Array<{ date: string; weight: number | null; repetitions: number; completedSets: number; effort: number | null }>;
};

export type AdminFollowUpDetail = {
  studentId: string;
  sessions: AdminWorkoutSession[];
  evaluations: AdminBodyEvaluationPoint[];
  blockDistribution: Array<{ type: string; label: string; count: number }>;
  exerciseProgress: AdminExerciseProgress[];
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
    exercises: Array<{ id: string; name: string; order: number; notes: string; sets: Array<{ setNumber: number; weight: number | null; repetitions: number | null; effort: number | null; unit: string; notes: string }> }>;
  }>;
  routines: Array<{ id: string; name: string }>;
  studentsWithoutTraining: Array<{ id: string; name: string }>;
  summary?: {
    trackedStudents: number;
    onTrack: number;
    onTrackPercentage: number;
    attention: number;
    attentionPercentage: number;
    averageSessions: number;
  };
  detail?: AdminFollowUpDetail | null;
};
