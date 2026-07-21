export type PaymentStatus = "pagado" | "pendiente" | "vencido";

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
  student: string;
  amount: number;
  concept: string;
  dueDate: string;
  paidDate: string;
  method: string;
  status: PaymentStatus;
  notes: string;
};

export type EventStatus = "programado" | "confirmado" | "cancelado" | "finalizado";

export type CoachEvent = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
  type: string;
  status: EventStatus;
  students: string[];
};
