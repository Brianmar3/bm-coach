CREATE TYPE "StudentPaymentStatus" AS ENUM ('PAGADO', 'PENDIENTE', 'VENCIDO', 'PROXIMO_A_VENCER');

CREATE TABLE "student_payments" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "concept" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "paidDate" TIMESTAMP(3),
  "method" TEXT NOT NULL,
  "status" "StudentPaymentStatus" NOT NULL DEFAULT 'PENDIENTE',
  "notes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "student_payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "student_payments_studentId_idx" ON "student_payments"("studentId");
CREATE INDEX "student_payments_status_dueDate_idx" ON "student_payments"("status", "dueDate");

ALTER TABLE "student_payments"
ADD CONSTRAINT "student_payments_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "students"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
