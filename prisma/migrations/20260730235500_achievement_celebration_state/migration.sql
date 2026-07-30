-- Separate the in-app celebration state from Web Push delivery.
ALTER TABLE "achievement_notifications"
ADD COLUMN "celebratedAt" TIMESTAMP(3);

-- Existing notifications predate the celebration flow. Mark them as already
-- handled so deployment does not replay historical achievements to students.
UPDATE "achievement_notifications"
SET "celebratedAt" = COALESCE("notifiedAt", "createdAt");

CREATE INDEX "achievement_notifications_studentId_celebratedAt_createdAt_idx"
ON "achievement_notifications"("studentId", "celebratedAt", "createdAt");
