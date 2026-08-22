export type StudentPointMovement = {
  id: string;
  eventType:
    | "ATTENDANCE"
    | "RECORD"
    | "PERSONAL_RECORD"
    | "ACHIEVEMENT"
    | "MILESTONE"
    | "WEEKLY_MISSION"
    | "PAYMENT";
  points: number;
  description: string;
  occurredAt: string;
};

export type StudentPointSummary = {
  total: number;
  monthlyTotal: number;
  latest: StudentPointMovement | null;
  recent: StudentPointMovement[];
  nextTarget: number;
  pointsToNextTarget: number;
};

export type StudentRankingEntry = {
  studentId: string;
  studentName: string;
  profileImageUrl: string;
  total: number;
  historicalTotal: number;
  level: string;
  serviceType: "CLASSES" | "PERSONALIZED" | "MIXED";
  achievementCount: number;
  attendanceThisMonth: number;
  recordCount: number;
  movements: StudentPointMovement[];
};
