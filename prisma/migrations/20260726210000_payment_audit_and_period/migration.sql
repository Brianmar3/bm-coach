ALTER TYPE "StudentPaymentStatus"
ADD VALUE IF NOT EXISTS 'ANULADO';

ALTER TABLE "student_payments"
ADD COLUMN "billingPeriod" DATE,
ADD COLUMN "nextDueDateSnapshot" DATE,
ADD COLUMN "requestKey" TEXT,
ADD COLUMN "voidedAt" TIMESTAMP(3),
ADD COLUMN "voidReason" TEXT;

UPDATE "student_payments"
SET "billingPeriod" = DATE_TRUNC('month', COALESCE("paidDate", "dueDate"))::DATE
WHERE "billingPeriod" IS NULL;

CREATE UNIQUE INDEX "student_payments_requestKey_key"
ON "student_payments"("requestKey");

CREATE INDEX "student_payments_studentId_paidDate_idx"
ON "student_payments"("studentId", "paidDate");

CREATE INDEX "student_payments_studentId_billingPeriod_idx"
ON "student_payments"("studentId", "billingPeriod");
