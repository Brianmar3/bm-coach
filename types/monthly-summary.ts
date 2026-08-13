export type AvailableNumber = number | null;

export type MonthlyPaymentMovement = {
  id: string;
  studentId: string;
  studentName: string;
  amount: number;
  status: string;
  billingPeriod: string | null;
  paidDate: string | null;
  createdAt: string;
  method: string;
};

export type MonthlyCollectionWeek = {
  key: string;
  label: string;
  startDate: string | null;
  endDate: string | null;
  total: number;
  paymentCount: number;
  payments: MonthlyPaymentMovement[];
  kind: "CALENDAR" | "OUTSIDE_PERIOD" | "MISSING_DATE";
};

export type MonthlyReviewCause = "NO_MEMBERSHIP" | "INVALID_MEMBERSHIP_AMOUNT" | "MEMBERSHIP_NOT_ACTIVE" | "OBLIGATION_NOT_GENERATED";

export type MonthlyMembershipReview = {
  membershipId: string;
  studentId: string;
  studentName: string;
  serviceType: "CLASSES" | "PERSONALIZED" | "MIXED";
  planName: string;
  frequencyDays: number | null;
  startDate: string;
  endDate: string | null;
  amount: number | null;
  reason: string;
};

export type MonthlyMissingObligationReview = {
  studentId: string;
  studentName: string;
  serviceType: "CLASSES" | "PERSONALIZED" | "MIXED" | null;
  studentStatus: string | null;
  membershipStatus: string | null;
  membershipAmount: number | null;
  membershipStartDate: string | null;
  membershipEndDate: string | null;
  activity: string[];
  cause: MonthlyReviewCause;
  reason: string;
};

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
  today: {
    dateKey: string;
    isCurrentPeriod: boolean;
    registeredTotal: number;
    registeredCount: number;
    selectedPeriodImpactTotal: number;
    selectedPeriodImpactCount: number;
    totalBeforeToday: number;
    currentTotal: number;
    movements: MonthlyPaymentMovement[];
  };
  weeklyCollections: MonthlyCollectionWeek[];
  reconciliation: {
    expectedTotal: number;
    collectedTotal: number;
    appliedToObligations: number;
    paymentsWithoutObligation: number;
    overpaymentsOnObligations: number;
    pendingTotal: number;
    simpleDifference: number;
    unreconciledCollected: number;
  } | null;
  dataReview: {
    membershipsWithoutAmount: MonthlyMembershipReview[];
    activityWithoutObligation: MonthlyMissingObligationReview[];
    missingObligationCauses: Array<{ cause: MonthlyReviewCause; label: string; count: number }>;
  };
  warnings: string[];
  detailRows: MonthlyDetailRow[];
};
