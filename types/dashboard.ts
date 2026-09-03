import type { PaymentAccountStatus } from "@/types/gestion";

export type DashboardPriority = {
  id: string;
  label: string;
  count: number;
  href: string;
  tone: "danger" | "warning" | "gold" | "info" | "neutral";
};

export type DashboardLowActivityStudent = {
  studentId: string;
  studentName: string;
  serviceType: "CLASSES" | "MIXED";
  phoneNormalized: string;
  phoneState: "missing" | "invalid" | "valid";
  lastAttendanceDate: string | null;
  daysSinceLastAttendance: number | null;
  weeklyFrequency: number;
};

export type DashboardData = {
  generatedAt: string;
  today: string;
  metrics: {
    activeStudents: number;
    activeStudentsMonthChange: number;
    monthIncome: number;
    monthPaymentCount: number;
    incomeChangePercent: number | null;
    pendingCount: number;
    pendingAmount: number;
    overdueCount: number;
    dueSoonThreeDaysCount: number;
    estimatedPendingBalance: number | null;
    classesToday: number;
    attendanceToday: number;
    newStudents: number;
  };
  income: Array<{ date: string; label: string; amount: number }>;
  priorities: DashboardPriority[];
  attentionToday: {
    attentionCount: number;
    overdueCount: number;
    dueSoonCount: number;
    lowActivityStudentCount: number;
    lowActivityStudents: DashboardLowActivityStudent[];
    completedWorkoutCount: number;
    registeredPaymentTotal: number;
    registeredPaymentCount: number;
  };
  ranking: Array<{
    studentId: string;
    studentName: string;
    points: number;
  }>;
  todayClasses: Array<{
    id: string;
    startTime: string;
    endTime: string;
    name: string;
    enrolled: number;
    attendance: number;
    confirmed: number;
    confirmedStudents: string[];
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
