export type ClassResponse = "GOING" | "NOT_GOING" | null;
export type ActualClassAttendance = "UNKNOWN" | "PRESENT" | "ABSENT" | "CANCELLED";
export type ClassOccurrenceState = "SCHEDULED" | "CANCELLED" | "COMPLETED";

export type ClassStrengthSet = {
  setNumber: number;
  weight: number | null;
  repetitions: number | null;
  unit: string;
  notes: string;
};

export type ClassStrengthExerciseLog = {
  exerciseName: string;
  order: number;
  notes: string;
  sets: ClassStrengthSet[];
};

export type PortalClassOccurrence = {
  id: string;
  scheduleId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  name: string;
  category: string;
  status: ClassOccurrenceState;
  statusLabel: string;
  capacity: number | null;
  confirmedCount: number;
  response: ClassResponse;
  canRespond: boolean;
  strengthAvailable: boolean;
  strengthBlock: null | {
    name: string;
    notes: string;
    exercises: Array<{
      id: string;
      exerciseName: string;
      order: number;
      suggestedSets: number;
      suggestedReps: string;
      instructions: string;
    }>;
  };
  workoutLog: null | {
    id: string;
    status: "DRAFT" | "COMPLETED";
    notes: string;
    exercises: ClassStrengthExerciseLog[];
  };
};

export type AdminClassStudent = {
  id: string;
  name: string;
  response: ClassResponse;
  actualAttendance: ActualClassAttendance;
};

export type AdminClassOccurrence = PortalClassOccurrence & {
  internalNotes: string;
  strengthEnabled: boolean;
  students: AdminClassStudent[];
  noResponse: AdminClassStudent[];
};
