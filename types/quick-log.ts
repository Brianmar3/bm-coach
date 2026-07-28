export type QuickLogType = "WORKOUT" | "NOTE" | "PROGRESS" | "PHOTO";

export type QuickLogPhoto = {
  id: string;
  blobUrl: string;
  blobPathname: string;
  createdAt: string;
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
};
