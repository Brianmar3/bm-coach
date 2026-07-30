ALTER TYPE "StudentNotificationType" ADD VALUE IF NOT EXISTS 'POINTS';
ALTER TYPE "TrainerNotificationType" ADD VALUE IF NOT EXISTS 'POINTS';

ALTER TABLE "trainer_notifications"
ALTER COLUMN "response" DROP NOT NULL;

CREATE TYPE "StudentPointEventType" AS ENUM (
    'ATTENDANCE',
    'RECORD',
    'PERSONAL_RECORD',
    'ACHIEVEMENT',
    'MILESTONE'
);

CREATE TYPE "StudentPointSourceType" AS ENUM (
    'CLASS_OCCURRENCE_ATTENDANCE',
    'LEGACY_ATTENDANCE',
    'QUICK_LOG',
    'CLASS_WORKOUT_LOG',
    'WORKOUT_SESSION',
    'ACHIEVEMENT'
);

CREATE TABLE "student_point_transactions" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "eventType" "StudentPointEventType" NOT NULL,
    "sourceType" "StudentPointSourceType" NOT NULL,
    "sourceId" TEXT,
    "points" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "invalidatedAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_point_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_point_transactions_studentId_eventKey_key"
ON "student_point_transactions"("studentId", "eventKey");

CREATE INDEX "student_point_transactions_studentId_active_occurredAt_idx"
ON "student_point_transactions"("studentId", "active", "occurredAt" DESC);

CREATE INDEX "student_point_transactions_active_occurredAt_idx"
ON "student_point_transactions"("active", "occurredAt" DESC);

ALTER TABLE "student_point_transactions"
ADD CONSTRAINT "student_point_transactions_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "students"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
