export type PaymentStatus = "pagado" | "pendiente" | "vencido";

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
