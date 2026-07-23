export type PaymentStatus = "pagado" | "pendiente" | "vencido" | "proximo_a_vencer";
export type PaymentAccountStatus = "VENCIDA" | "VENCE_PRONTO" | "AL_DIA" | "SIN_CONFIGURAR";

export type StudentStatus = "activo" | "inactivo";

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
  monthlyFee: number;
  joinedAt: string;
  dueDate: string;
  status: StudentStatus;
  notes: string;
  studentType?: "Adulto" | "Kids";
  responsibleName?: string;
  responsiblePhone?: string;
  responsibleRelation?: string;
  scheduleId?: string;
  scheduleLabel?: string;
};

export type StudentPlanOption = {
  days: 2 | 3 | 4 | 5;
  name: string;
  price: number;
  configured: boolean;
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
  plans: { name: string; price: number }[];
  primaryColor: string;
  accentColor: string;
  compactMode: boolean;
};

export type Payment = {
  id: string;
  studentId: string;
  student: string;
  amount: number;
  concept: string;
  dueDate: string;
  paidDate: string;
  method: string;
  status: PaymentStatus;
  notes: string;
  createdAt: string;
};

export type PaymentStudentAccount = {
  studentId: string;
  student: string;
  plan: string;
  monthlyFee: number;
  phone: string;
  lastPaymentDate: string;
  lastPaymentAmount: number | null;
  nextDueDate: string;
  status: PaymentAccountStatus;
};

export type PaymentDashboardSummary = {
  collectedThisMonth: number;
  overdueCount: number;
  dueSoonCount: number;
  currentCount: number;
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

export type CoachEvent = {
  id: string;
  title: string;
  type: EventType;
  date: string;
  time: string;
  color: string;
  description: string;
  status: EventStatus;
  createdAt: string;
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
};

export type TrainingRoutineLevel = "principiante" | "intermedio" | "avanzado";
export type TrainingRoutineStatus = "activa" | "archivada";
export type TrainingEffortType = "RPE" | "RIR";

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
  order: number;
};

export type TrainingRoutineDay = {
  id: string;
  dayNumber: number;
  exercises: TrainingExercise[];
};

export type TrainingRoutine = {
  id: string;
  name: string;
  objective: string;
  level: TrainingRoutineLevel;
  status: TrainingRoutineStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt: string;
  studentIds: string[];
  students: Array<{ id: string; name: string }>;
  days: TrainingRoutineDay[];
};
