export type DashboardPaymentItem = {
  id: string;
  studentName: string;
  amount: number;
  dueDate: string;
};

export type DashboardData = {
  generatedAt: string;
  metrics: {
    activeStudents: number;
    monthIncome: number;
    overdueCount: number;
    overdueAmount: number;
    dueSoonCount: number;
    dueSoonAmount: number;
  };
  overduePayments: DashboardPaymentItem[];
  dueSoonPayments: DashboardPaymentItem[];
  upcomingEvents: Array<{
    id: string;
    title: string;
    type: string;
    date: string;
    time: string;
    color: string;
  }>;
  latestEvaluations: Array<{
    id: string;
    studentName: string;
    date: string;
    weight: number | null;
    bmi: number | null;
    bodyFatPercentage: number | null;
  }>;
  latestRoutines: Array<{
    id: string;
    name: string;
    objective: string;
    level: string;
    status: string;
    createdAt: string;
    students: string[];
    daysCount: number;
    exercisesCount: number;
  }>;
  evolution: Array<{
    month: string;
    label: string;
    averageWeight: number | null;
    averageBmi: number | null;
    newStudents: number;
  }>;
};
