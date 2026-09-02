CREATE TYPE "CoachEventAudience" AS ENUM ('ALL', 'CLASSES', 'PERSONALIZED', 'MIXED');

ALTER TABLE "coach_events"
  ADD COLUMN "location" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "showToStudents" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "audience" "CoachEventAudience" NOT NULL DEFAULT 'ALL';

DROP INDEX IF EXISTS "coach_events_status_idx";
CREATE INDEX "coach_events_status_showToStudents_date_idx"
  ON "coach_events"("status", "showToStudents", "date");
