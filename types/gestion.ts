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
