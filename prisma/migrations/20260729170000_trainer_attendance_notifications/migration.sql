CREATE TYPE "TrainerNotificationType" AS ENUM ('CLASS_RESPONSE');

CREATE TABLE "trainer_push_subscriptions" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL DEFAULT 'coach',
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "deviceLabel" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trainer_push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "trainer_notifications" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL DEFAULT 'coach',
    "type" "TrainerNotificationType" NOT NULL,
    "eventKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "studentId" TEXT,
    "occurrenceId" TEXT,
    "response" "ClassResponseStatus" NOT NULL,
    "readAt" TIMESTAMP(3),
    "pushAttemptedAt" TIMESTAMP(3),
    "pushDeliveredAt" TIMESTAMP(3),
    "pushError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trainer_notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "trainer_push_subscriptions_endpoint_key" ON "trainer_push_subscriptions"("endpoint");
CREATE INDEX "trainer_push_subscriptions_ownerKey_active_idx" ON "trainer_push_subscriptions"("ownerKey", "active");
CREATE UNIQUE INDEX "trainer_notifications_eventKey_key" ON "trainer_notifications"("eventKey");
CREATE INDEX "trainer_notifications_ownerKey_readAt_createdAt_idx" ON "trainer_notifications"("ownerKey", "readAt", "createdAt" DESC);
CREATE INDEX "trainer_notifications_studentId_createdAt_idx" ON "trainer_notifications"("studentId", "createdAt" DESC);
CREATE INDEX "trainer_notifications_occurrenceId_createdAt_idx" ON "trainer_notifications"("occurrenceId", "createdAt" DESC);

ALTER TABLE "trainer_notifications"
ADD CONSTRAINT "trainer_notifications_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "students"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "trainer_notifications"
ADD CONSTRAINT "trainer_notifications_occurrenceId_fkey"
FOREIGN KEY ("occurrenceId") REFERENCES "class_occurrences"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
