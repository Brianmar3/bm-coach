import type { CoachEvent, Payment, PhysicalEvaluation, TrainingRoutine } from "@/types/gestion";

export type PortalProfile = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  birthDate: string;
  goal: string;
  plan: string;
  joinedAt: string;
  status: string;
  dueDate: string;
};

export type PortalWorkoutSet = {
  id?: string;
  setNumber: number;
  weight: number | null;
  repetitions: number | null;
  effort: number | null;
  completed: boolean;
  observation: string;
};

export type PortalWorkoutExercise = {
  id?: string;
  exerciseId: string;
  exerciseName: string;
  observation: string;
  sets: PortalWorkoutSet[];
  previous: { date: string; weight: number | null; repetitions: number | null; effort: number | null } | null;
  history: Array<{ date: string; weight: number | null; repetitions: number | null; effort: number | null }>;
};

export type PortalWorkoutSession = {
  id?: string;
  routineId: string;
  routineName: string;
  routineNameSnapshot?: string;
  routineDayNumberSnapshot?: number;
  dayId: string;
  dayNumber: number;
  date: string;
  startTime: string;
  durationMinutes: number | null;
  energyBefore: number | null;
  difficulty: number | null;
  energyAfter: number | null;
  finalComment: string;
  hasPain: boolean;
  painDetails: string;
  status: "pendiente" | "en_progreso" | "finalizado";
  exercises: PortalWorkoutExercise[];
};

export type PortalComment = {
  id: string;
  author: "alumno" | "entrenador";
  context: "sesion" | "ejercicio" | "evaluacion" | "general";
  category: "consulta" | "dificultad" | "dolor" | "devolucion";
  status: "pendiente" | "revisado";
  body: string;
  contextLabel: string;
  parentId: string | null;
  createdAt: string;
};

export type PortalData = {
  profile: PortalProfile;
  routine: TrainingRoutine | null;
  evaluations: PhysicalEvaluation[];
  payments: Payment[];
  events: CoachEvent[];
  workoutSessions: PortalWorkoutSession[];
  comments: PortalComment[];
  nextClass: { id: string; label: string; startTime: string } | null;
  weeklyWorkouts: number;
  pendingResponses: number;
};
