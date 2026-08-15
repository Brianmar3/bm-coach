export type PortalProgressMetricKey = "weight" | "bodyFatPercentage" | "muscleMass" | "waist" | "hip" | "chest";

export type PortalProgressMetric = {
  key: PortalProgressMetricKey;
  label: string;
  unit: string;
  points: Array<{ date: string; value: number }>;
  change: number | null;
};

export type PortalExerciseRecord = {
  exerciseId: string;
  exerciseName: string;
  maximumWeight: number | null;
  maximumRepetitions: number | null;
  lastRecordedAt: string;
};

export type PortalProgressSession = {
  id: string;
  date: string;
  routineName: string;
  dayNumber: number;
  dayName: string;
  durationMinutes: number | null;
};

export type PortalProgressData = {
  plan: {
    id: string;
    name: string;
    assignedAt: string;
    startDate: string | null;
    durationWeeks: number | null;
    plannedDays: number;
  };
  summary: {
    completedSessions: number;
    expectedSessions: number;
    adherencePercentage: number | null;
    totalDurationMinutes: number | null;
    lastSessionDate: string | null;
    completedBlocks: number;
    registeredExercises: number;
    completedSets: number;
    evaluationCount: number;
  };
  bodyProgress: PortalProgressMetric[];
  exerciseProgress: PortalExerciseRecord[];
  recentSessions: PortalProgressSession[];
};
