import type { PaymentAccountStatus } from "@/types/gestion";

export type DashboardActivity = {
  id: string;
  type: "payment" | "evaluation" | "routine" | "attendance";
  title: string;
  detail: string;
  date: string;
  href: string;
};

export type DashboardData = {
  generatedAt: string;
  today: string;
  metrics: {
    activeStudents: number;
    classesToday: number;
    attendanceToday: number;
    monthIncome: number;
    overdueCount: number;
    dueSoonCount: number;
  };
  todayClasses: Array<{
    id: string;
    scheduleId: string | null;
    startTime: string;
    endTime: string;
    name: string;
    enrolled: number;
    attendance: number;
    status: "programada" | "en_curso" | "finalizada" | "cancelada";
  }>;
  paymentAlerts: Array<{
    studentId: string;
    studentName: string;
    dueDate: string;
    amount: number;
    status: PaymentAccountStatus;
  }>;
  absenceAlerts: Array<{
    studentId: string;
    studentName: string;
    count: number;
  }>;
  evaluationAlerts: Array<{
    id: string;
    title: string;
    date: string;
    time: string;
  }>;
  recentActivity: DashboardActivity[];
};
