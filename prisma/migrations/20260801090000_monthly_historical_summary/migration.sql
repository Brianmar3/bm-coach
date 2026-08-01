CREATE TYPE "MembershipHistoryStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE "StudentStatusEventType" AS ENUM ('ENROLLMENT', 'DEACTIVATION', 'SUSPENSION', 'REACTIVATION');
CREATE TYPE "MonthlyObligationStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID');
CREATE TYPE "MonthlySummaryStatus" AS ENUM ('DRAFT', 'CLOSED');

CREATE TABLE "student_membership_history" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE,
  "planName" TEXT NOT NULL,
  "frequencyDays" INTEGER,
  "serviceType" "StudentServiceType" NOT NULL,
  "monthlyAmount" DECIMAL(12,2),
  "status" "MembershipHistoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "endReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_membership_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "monthly_student_obligations" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "period" DATE NOT NULL,
  "expectedAmount" DECIMAL(12,2) NOT NULL,
  "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "balance" DECIMAL(12,2) NOT NULL,
  "studentNameSnapshot" TEXT NOT NULL,
  "planNameSnapshot" TEXT NOT NULL,
  "serviceSnapshot" "StudentServiceType" NOT NULL,
  "frequencySnapshot" INTEGER,
  "dueDate" DATE NOT NULL,
  "status" "MonthlyObligationStatus" NOT NULL DEFAULT 'PENDING',
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "monthly_student_obligations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "student_status_events" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "type" "StudentStatusEventType" NOT NULL,
  "eventDate" DATE NOT NULL,
  "reason" TEXT,
  "actor" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_status_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "monthly_summaries" (
  "id" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "status" "MonthlySummaryStatus" NOT NULL DEFAULT 'DRAFT',
  "historicalPartial" BOOLEAN NOT NULL DEFAULT false,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "closedAt" TIMESTAMP(3),
  "closedBy" TEXT,
  "expectedTotal" DECIMAL(14,2),
  "collectedTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "pendingTotal" DECIMAL(14,2),
  "collectionPercentage" DECIMAL(6,2),
  "activeStudentCount" INTEGER,
  "enrollmentCount" INTEGER NOT NULL DEFAULT 0,
  "deactivationCount" INTEGER,
  "attendancePercentage" DECIMAL(6,2),
  "warnings" JSONB NOT NULL DEFAULT '[]',
  "snapshot" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "monthly_summaries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "monthly_student_obligations_studentId_period_key" ON "monthly_student_obligations"("studentId", "period");
CREATE INDEX "monthly_student_obligations_period_status_idx" ON "monthly_student_obligations"("period", "status");
CREATE INDEX "student_membership_history_studentId_startDate_endDate_idx" ON "student_membership_history"("studentId", "startDate", "endDate");
CREATE INDEX "student_membership_history_startDate_endDate_idx" ON "student_membership_history"("startDate", "endDate");
CREATE INDEX "student_status_events_studentId_eventDate_idx" ON "student_status_events"("studentId", "eventDate");
CREATE INDEX "student_status_events_type_eventDate_idx" ON "student_status_events"("type", "eventDate");
CREATE UNIQUE INDEX "monthly_summaries_year_month_key" ON "monthly_summaries"("year", "month");
CREATE INDEX "monthly_summaries_status_year_month_idx" ON "monthly_summaries"("status", "year", "month");

ALTER TABLE "student_membership_history" ADD CONSTRAINT "student_membership_history_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "monthly_student_obligations" ADD CONSTRAINT "monthly_student_obligations_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_status_events" ADD CONSTRAINT "student_status_events_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Establish a truthful baseline from the deployment date. It deliberately does
-- not claim that the current plan or price existed before this migration.
INSERT INTO "student_membership_history" (
  "id", "studentId", "startDate", "planName", "frequencyDays", "serviceType",
  "monthlyAmount", "status", "endReason", "createdAt"
)
SELECT
  md5('membership-baseline:' || s."id"),
  s."id",
  CURRENT_DATE,
  COALESCE(s."data"->>'plan', ''),
  CASE WHEN COALESCE(s."data"->>'plan', '') ~ '(^|[^0-9])[2-5]([^0-9]|$)'
    THEN substring(s."data"->>'plan' from '([2-5])')::INTEGER ELSE NULL END,
  s."serviceType",
  CASE WHEN COALESCE(s."data"->>'monthlyFee', '') ~ '^\d+(\.\d+)?$'
    AND (s."data"->>'monthlyFee')::DECIMAL > 0
    THEN (s."data"->>'monthlyFee')::DECIMAL(12,2) ELSE NULL END,
  CASE WHEN s."data"->>'lifecycleStatus' = 'suspendido' THEN 'SUSPENDED'::"MembershipHistoryStatus"
    WHEN s."data"->>'status' = 'inactivo' THEN 'INACTIVE'::"MembershipHistoryStatus"
    ELSE 'ACTIVE'::"MembershipHistoryStatus" END,
  'Línea de base creada al habilitar el historial',
  CURRENT_TIMESTAMP
FROM "students" s;

-- joinedAt is an existing dated fact, so it can seed enrollment history safely.
INSERT INTO "student_status_events" ("id", "studentId", "type", "eventDate", "reason", "actor", "createdAt")
SELECT
  md5('enrollment-baseline:' || s."id"),
  s."id",
  'ENROLLMENT'::"StudentStatusEventType",
  CASE WHEN COALESCE(s."data"->>'joinedAt', '') ~ '^\d{4}-\d{2}-\d{2}$'
    THEN (s."data"->>'joinedAt')::DATE ELSE s."createdAt"::DATE END,
  'Alta importada desde la fecha registrada del alumno',
  'migration',
  CURRENT_TIMESTAMP
FROM "students" s;
