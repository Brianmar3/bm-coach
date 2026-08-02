import type { CoachEvent, Payment, PhysicalEvaluation, PortalPaymentAccount, StudentServiceType, TrainingRoutine } from "@/types/gestion";
import type { PortalAchievement } from "@/lib/portal-achievements";
import type { StudentPointSummary } from "@/types/points";

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
  serviceType: StudentServiceType;
  dueDate: string;
  scheduleLabels: string[];
  flexibleSchedule: string;
  profileImageUrl: string;
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
  dayName?: string;
  dayEstimatedMinutes?: number | null;
  date: string;
  startTime: string;
  durationMinutes: number | null;
  energyBefore?: number | null;
  difficulty?: number | null;
  energyAfter?: number | null;
  generalFeeling?: "Muy buena" | "Buena" | "Normal" | "Difícil" | "Muy difícil";
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
  paymentAccount: PortalPaymentAccount;
  paymentMethods: string[];
  events: CoachEvent[];
  workoutSessions: PortalWorkoutSession[];
  comments: PortalComment[];
  nextClass: { id: string; label: string; startTime: string } | null;
  weeklyWorkouts: number;
  pendingResponses: number;
  home: {
    mode: "PRESENCIAL" | "RUTINA_PERSONALIZADA" | "ENTRENAMIENTO_EN_CASA" | "MIXTO" | "SIN_DEFINIR";
    hasClassParticipation: boolean;
    classesAttendedThisMonth: number;
    monthlyAttendancePercentage: number | null;
    classesAttendedPreviousMonth: number | null;
    previousMonthAttendancePercentage: number | null;
    coachPhone: string;
    achievements: PortalAchievement[];
    points: StudentPointSummary;
  };
};
