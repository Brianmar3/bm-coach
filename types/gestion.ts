export type PaymentStatus = "pagado" | "pendiente" | "vencido" | "proximo_a_vencer" | "anulado";
export type PaymentAccountStatus = "VENCIDA" | "VENCE_PRONTO" | "AL_DIA" | "SIN_PAGOS" | "SIN_CONFIGURAR";

export type StudentStatus = "activo" | "inactivo" | "suspendido";
export type StudentServiceType = "CLASSES" | "PERSONALIZED" | "MIXED";
export const STUDENT_TYPES = ["Adulto", "Kids"] as const;
export type StudentType = (typeof STUDENT_TYPES)[number];

export function isStudentType(value: unknown): value is StudentType {
  return typeof value === "string" && STUDENT_TYPES.includes(value as StudentType);
}

export type Student = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  birthDate: string;
  weight: number;
  height: number;
  goal: string;
  plan: string;
  planId?: string;
  monthlyFee: number;
  joinedAt: string;
  dueDate: string;
  status: StudentStatus;
  lifecycleStatus?: StudentStatus;
  serviceType: StudentServiceType;
  notes: string;
  studentType: StudentType;
  responsibleName?: string;
  responsiblePhone?: string;
  responsibleRelation?: string;
  scheduleId?: string;
  scheduleLabel?: string;
  scheduleIds?: string[];
  scheduleLabels?: string[];
  flexibleSchedule?: string;
  profileImageUrl?: string;
  onboardingCompleted?: boolean;
  onboardingCompletedAt?: string;
  trainingExperience?: "Principiante" | "Intermedio" | "Avanzado";
  hasLimitations?: boolean;
  limitations?: string;
  onboardingObservations?: string;
};

export type StudentPlanOption = {
  /** Stable selector identity; it is never persisted as Student.planId. */
  id: string;
  /** Real identity stored in configuration, or empty for legacy plans. */
  persistentId: string;
  /** Client-only selector identity. Never persist this as planId. */
  selectionKey: string;
  /** Alias estable conservado para consumidores existentes. */
  days: string;
  name: string;
  price: number;
  configured: true;
};

export type CoachPlan = {
  id?: string;
  name: string;
  price: number;
};

export type WeeklyClassDay = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY";

export type WeeklyClassStudent = {
  id: string;
  name: string;
  status: StudentStatus;
};

export type WeeklyClassSchedule = {
  id: string;
  dayOfWeek: WeeklyClassDay;
  startTime: string;
  endTime: string;
  classType: string;
  capacity: number | null;
  active: boolean;
  studentIds: string[];
  students: WeeklyClassStudent[];
  createdAt: string;
  updatedAt: string;
};

export type WeeklyClassInput = Omit<WeeklyClassSchedule, "id" | "students" | "createdAt" | "updatedAt">;

export type AttendanceStatus = "presente" | "ausente" | "justificado";

export type AttendanceEntry = {
  id: string;
  date: string;
  status: AttendanceStatus;
  studentId: string;
  studentName: string;
  scheduleId: string;
  scheduleLabel: string;
  scheduleStartTime: string;
  exceptional: boolean;
};

export type AttendanceRosterStudent = {
  id: string;
  name: string;
  phone: string;
  assigned: boolean;
  confirmation: "GOING" | "NOT_GOING" | null;
  status: AttendanceStatus | null;
  attendanceId: string | null;
};

export type AttendanceRoster = {
  date: string;
  schedule: { id: string; label: string; startTime: string; endTime: string };
  students: AttendanceRosterStudent[];
};

export type StudentAttendanceSummary = {
  month: string;
  attended: number;
  absent: number;
  justified: number;
  percentage: number;
  lastAttendanceDate: string | null;
  history: AttendanceEntry[];
};

export type AttendanceGeneralSummary = {
  date: string;
  month: string;
  today: { present: number; absent: number; justified: number; total: number };
  monthlyPercentage: number;
  recentAbsences: Array<{ studentId: string; studentName: string; count: number }>;
};

export type CoachSettings = {
  id?: string;
  systemName: string;
  coachName: string;
  phone: string;
  email: string;
  address: string;
  currency: string;
  dueDay: number;
  paymentMethods: string[];
  transferDetails?: TransferPaymentDetails;
  plans: CoachPlan[];
  primaryColor: string;
  accentColor: string;
  compactMode: boolean;
};

export type TransferPaymentDetails = {
  holder: string;
  alias: string;
  accountNumber: string;
  institution: string;
};

export type Payment = {
  id: string;
  studentId: string;
  student: string;
  amount: number;
  concept: string;
  billingPeriod: string;
  dueDate: string;
  paidDate: string;
  method: string;
  status: PaymentStatus;
  notes: string;
  voidedAt: string;
  voidReason: string;
  createdAt: string;
};

export type PaymentStudentAccount = {
  studentId: string;
  student: string;
  plan: string;
  monthlyFee: number;
  phone: string;
  paymentCount: number;
  paidThisMonth: boolean;
  lastPaymentDate: string;
  lastPaymentAmount: number | null;
  nextDueDate: string;
  status: PaymentAccountStatus;
};

export type PortalPaymentAccount = {
  configured: boolean;
  status: PaymentAccountStatus;
  monthlyFee: number;
  nextDueDate: string;
  plan: string;
  lastPaymentDate: string;
  lastPaymentAmount: number | null;
};

export type PaymentDashboardSummary = {
  collectedThisMonth: number;
  overdueCount: number;
  dueSoonCount: number;
  currentCount: number;
  noPaymentCount: number;
  unconfiguredCount: number;
  estimatedOutstanding: number;
};

export type PaymentDashboard = {
  asOf: string;
  summary: PaymentDashboardSummary;
  students: PaymentStudentAccount[];
};

export type EventStatus = "pendiente" | "completado";
export type EventType = "evaluacion" | "reunion" | "competencia" | "recordatorio";
export type EventAudience = "todos" | StudentServiceType;

export type CoachEvent = {
  id: string;
  title: string;
  type: EventType;
  date: string;
  time: string;
  color: string;
  description: string;
  location: string;
  status: EventStatus;
  showToStudents: boolean;
  audience: EventAudience;
  createdAt: string;
  updatedAt: string;
};

export type PhysicalEvaluation = {
  id: string;
  studentId: string;
  studentName: string;
  date: string;
  weight: number | null;
  height: number | null;
  bmi: number | null;
  bodyFatPercentage: number | null;
  muscleMass: number | null;
  visceralFat: number | null;
  waist: number | null;
  hip: number | null;
  chest: number | null;
  rightArm: number | null;
  leftArm: number | null;
  rightThigh: number | null;
  leftThigh: number | null;
  rightCalf: number | null;
  leftCalf: number | null;
  notes: string;
  frontPhotoUrl: string;
  sidePhotoUrl: string;
  backPhotoUrl: string;
  createdAt: string;
  version?: number;
  status?: "IN_PROGRESS" | "COMPLETED" | "REASSESSMENT_RECOMMENDED";
  completionPercentage?: number;
  primaryGoal?: string;
  weeklyAvailability?: string;
  reassessmentDate?: string;
  ageSnapshot?: number | null;
};

export type TrainingRoutineLevel = "principiante" | "intermedio" | "avanzado";
export type TrainingRoutineStatus = "borrador" | "activa" | "finalizada" | "archivada";
export type TrainingRoutineKind = "assigned" | "template";
export type TrainingEffortType = "RPE" | "RIR";
export type TrainingBlockType = "STRENGTH" | "ROUNDS" | "INTERVAL" | "EMOM" | "AMRAP" | "FOR_TIME" | "FREE" | "MOBILITY";
export type TrainingExerciseTargetType = "TIME" | "REPS" | "DISTANCE" | "REST" | "FREE";

export type TrainingExercise = {
  id: string;
  name: string;
  muscleGroup: string;
  sets: number;
  repetitions: string;
  weight: number | null;
  effortType: TrainingEffortType;
  effortValue: number | null;
  restSeconds: number | null;
  observations: string;
  videoUrl: string;
  tempo: string;
  alternativeExercise: string;
  equipment: string;
  optional: boolean;
  blockId: string;
  targetType: TrainingExerciseTargetType;
  targetSeconds: number | null;
  targetRepetitions: string;
  targetDistance: string;
  targetSide: string;
  order: number;
};

export type TrainingRoutineBlock = {
  id: string;
  type: TrainingBlockType;
  name: string;
  order: number;
  rounds: number | null;
  durationSeconds: number | null;
  workSeconds: number | null;
  restSeconds: number | null;
  restBetweenRoundsSeconds: number | null;
  targetRounds: number | null;
  instructions: string;
  exercises: TrainingExercise[];
};

export type TrainingRoutineDay = {
  id: string;
  dayNumber: number;
  name: string;
  objective: string;
  warmup: string;
  observations: string;
  estimatedMinutes: number | null;
  blocks: TrainingRoutineBlock[];
  exercises: TrainingExercise[];
};

export type TrainingRoutine = {
  id: string;
  name: string;
  objective: string;
  level: TrainingRoutineLevel;
  status: TrainingRoutineStatus;
  kind: TrainingRoutineKind;
  description: string;
  location: string;
  equipment: string[];
  tags: string[];
  startDate: string;
  durationWeeks: number | null;
  priorityMuscles: string[];
  createdAt: string;
  updatedAt: string;
  archivedAt: string;
  studentIds: string[];
  students: Array<{ id: string; name: string }>;
  historicalStudents: Array<{ id: string; name: string }>;
  days: TrainingRoutineDay[];
  managementSummary?: {
    completedSessions: number;
    latestSessionDate: string;
    averageDurationMinutes: number | null;
    recentWeeklySessions: number[];
    latestPainReport: { date: string; details: string } | null;
    progressPercentage: number | null;
  };
};
