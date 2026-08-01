export type AvailableNumber = number | null;

export type MonthlyDetailRow = {
  studentId: string;
  studentName: string;
  collectedAmount: number;
  expectedAmount: AvailableNumber;
  balance: AvailableNumber;
  paymentStatus: "Pagado" | "Parcial" | "Pendiente" | "Vencido" | "Sin obligación" | "Anulado";
  paymentDates: string[];
  paymentMethods: string[];
  attendancePresent: number;
  attendanceAbsent: number;
  attendanceJustified: number;
  planName: string | null;
  serviceType: "CLASSES" | "PERSONALIZED" | "MIXED" | null;
  frequencyDays: number | null;
  joinedAt: string | null;
  deactivatedAt: string | null;
  warnings: string[];
};

export type MonthlySummaryData = {
  metadata: {
    year: number;
    month: number;
    monthKey: string;
    label: string;
    timeZone: "America/Argentina/Buenos_Aires";
    generatedAt: string;
    status: "UNGENERATED" | "DRAFT" | "CLOSED";
    historicalPartial: boolean;
    closedAt: string | null;
  };
  summary: {
    collectedTotal: number;
    paymentCount: number;
    expectedTotal: AvailableNumber;
    pendingTotal: AvailableNumber;
    collectionPercentage: AvailableNumber;
    studentsWithActivity: number;
    enrollments: number;
    deactivations: AvailableNumber;
    attendancePercentage: AvailableNumber;
  };
  finances: {
    paidObligations: AvailableNumber;
    partialObligations: AvailableNumber;
    pendingObligations: AvailableNumber;
    voidedPaymentCount: number;
  };
  attendance: {
    present: number;
    absent: number;
    justified: number;
    totalRecords: number;
    percentageFormula: string;
  };
  activity: {
    evaluations: number;
    completedWorkoutSessions: number;
    registeredWorkoutSessions: number;
  };
  expenses: {
    operatingResult: null;
    message: string;
  };
  warnings: string[];
  detailRows: MonthlyDetailRow[];
};
