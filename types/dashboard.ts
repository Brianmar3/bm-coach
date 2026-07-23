import type { PaymentAccountStatus } from "@/types/gestion";

export type DashboardData = {
  generatedAt: string;
  today: string;
  metrics: {
    activeStudents: number;
    activeStudentsMonthChange: number;
    monthIncome: number;
    incomeChangePercent: number | null;
    pendingCount: number;
    pendingAmount: number;
    overdueCount: number;
    classesToday: number;
    attendanceToday: number;
    newStudents: number;
  };
  income: Array<{ date: string; label: string; amount: number }>;
  todayClasses: Array<{
    id: string;
    startTime: string;
    endTime: string;
    name: string;
    enrolled: number;
    attendance: number;
  }>;
  upcomingPayments: Array<{
    studentId: string;
    studentName: string;
    plan: string;
    dueDate: string;
    amount: number;
    status: PaymentAccountStatus;
  }>;
  recentStudents: Array<{
    id: string;
    studentName: string;
    plan: string;
    days: number | null;
    dueDate: string;
    status: PaymentAccountStatus;
  }>;
  weeklyAttendance: Array<{
    date: string;
    label: string;
    present: number;
    total: number;
    percentage: number;
  }>;
  attendanceSummary: {
    weeklyAverage: number;
    bestDay: string;
    totalAttendance: number;
  };
  upcomingEvents: Array<{
    id: string;
    title: string;
    type: string;
    date: string;
    time: string;
    color: string;
    status: string;
  }>;
};
