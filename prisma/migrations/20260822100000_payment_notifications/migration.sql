-- Additive support for idempotent payment notifications and payment point events.
ALTER TYPE "StudentNotificationType" ADD VALUE IF NOT EXISTS 'PAYMENT';
ALTER TYPE "StudentPointEventType" ADD VALUE IF NOT EXISTS 'PAYMENT';
ALTER TYPE "StudentPointSourceType" ADD VALUE IF NOT EXISTS 'PAYMENT';

ALTER TABLE "student_notifications"
ADD COLUMN "eventKey" TEXT;

CREATE UNIQUE INDEX "student_notifications_eventKey_key"
ON "student_notifications"("eventKey");
