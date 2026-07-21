export type PaymentStatus = "pagado" | "pendiente" | "vencido" | "proximo_a_vencer";

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
};

export type CoachSettings = {
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
  studentIds: string[];
  students: Array<{ id: string; name: string }>;
  days: TrainingRoutineDay[];
};
