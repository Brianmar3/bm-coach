CREATE TYPE "AchievementNotificationStatus" AS ENUM ('BASELINE', 'PENDING', 'SENT', 'FAILED');

CREATE TABLE "student_push_subscriptions" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "deviceLabel" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    CONSTRAINT "student_push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "achievement_notifications" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "achievementKey" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "status" "AchievementNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "achievement_notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_push_subscriptions_endpoint_key" ON "student_push_subscriptions"("endpoint");
CREATE INDEX "student_push_subscriptions_studentId_active_idx" ON "student_push_subscriptions"("studentId", "active");
CREATE UNIQUE INDEX "achievement_notifications_studentId_achievementKey_key" ON "achievement_notifications"("studentId", "achievementKey");
CREATE INDEX "achievement_notifications_studentId_status_idx" ON "achievement_notifications"("studentId", "status");
CREATE INDEX "achievement_notifications_status_createdAt_idx" ON "achievement_notifications"("status", "createdAt");

ALTER TABLE "student_push_subscriptions"
ADD CONSTRAINT "student_push_subscriptions_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "achievement_notifications"
ADD CONSTRAINT "achievement_notifications_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
