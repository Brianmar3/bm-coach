export type QuickLogType = "WORKOUT" | "NOTE" | "PROGRESS" | "PHOTO";

export type QuickLogPhoto = {
  id: string;
  blobUrl: string;
  blobPathname: string;
  createdAt: string;
};

export type QuickLogAchievement = {
  id: string;
  achievementKey: string;
  type: "FIRST_MARK" | "MAX_LOAD" | "REPETITION_PR" | "RECORD_MILESTONE";
  exerciseName: string;
  sets: number | null;
  repetitions: number | null;
  unit: string;
  currentLoad: number | null;
  previousLoad: number | null;
  difference: number | null;
  recordCount: number | null;
  unlockedAt: string;
};

export type QuickLogFeedback = {
  id: string;
  trainerName: string;
  preset: string;
  text: string;
  createdAt: string;
  updatedAt: string;
};

export type QuickLog = {
  id: string;
  type: QuickLogType;
  title: string;
  content: string;
  category: string;
  date: string;
  durationMinutes: number | null;
  exerciseName: string;
  exerciseKey: string;
  sets: number | null;
  repetitions: number | null;
  previousSets: number | null;
  previousRepetitions: number | null;
  metricType: string;
  previousValue: number | null;
  currentValue: number | null;
  unit: string;
  mood: string;
  hasPain: boolean;
  painDetails: string;
  createdAt: string;
  updatedAt: string;
  photos: QuickLogPhoto[];
  achievements: QuickLogAchievement[];
  feedback: QuickLogFeedback | null;
};
