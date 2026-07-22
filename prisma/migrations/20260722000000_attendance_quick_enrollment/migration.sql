ALTER TABLE "students" ADD COLUMN "phoneNormalized" TEXT;
ALTER TABLE "students" ADD COLUMN "primaryScheduleId" TEXT;

-- Preserve every existing student. Only backfill a normalized phone when it is
-- non-empty and unique; legacy duplicates remain with NULL until corrected.
WITH normalized AS (
  SELECT
    "id",
    REGEXP_REPLACE(COALESCE("data"->>'phone', ''), '[^0-9]', '', 'g') AS phone
  FROM "students"
), unique_phones AS (
  SELECT phone
  FROM normalized
  WHERE phone <> ''
  GROUP BY phone
  HAVING COUNT(*) = 1
)
UPDATE "students" student
SET "phoneNormalized" = normalized.phone
FROM normalized
JOIN unique_phones ON unique_phones.phone = normalized.phone
WHERE student."id" = normalized."id";

CREATE UNIQUE INDEX "students_phoneNormalized_key" ON "students"("phoneNormalized");
CREATE INDEX "students_primaryScheduleId_idx" ON "students"("primaryScheduleId");

-- Use the oldest existing weekly assignment as the initial primary group.
UPDATE "students" student
SET "primaryScheduleId" = (
  SELECT assignment."scheduleId"
  FROM "weekly_class_assignments" assignment
  WHERE assignment."studentId" = student."id"
  ORDER BY assignment."assignedAt" ASC, assignment."scheduleId" ASC
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM "weekly_class_assignments" assignment
  WHERE assignment."studentId" = student."id"
);

ALTER TABLE "students"
  ADD CONSTRAINT "students_primaryScheduleId_fkey"
  FOREIGN KEY ("primaryScheduleId") REFERENCES "weekly_class_schedules"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'JUSTIFIED');

CREATE TABLE "class_attendances" (
  "id" TEXT NOT NULL,
  "scheduleId" TEXT,
  "studentId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "status" "AttendanceStatus" NOT NULL,
  "scheduleLabel" TEXT NOT NULL,
  "scheduleStartTime" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "class_attendances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "class_attendances_scheduleId_studentId_date_key"
  ON "class_attendances"("scheduleId", "studentId", "date");
CREATE INDEX "class_attendances_date_idx" ON "class_attendances"("date");
CREATE INDEX "class_attendances_studentId_date_idx" ON "class_attendances"("studentId", "date");
CREATE INDEX "class_attendances_status_date_idx" ON "class_attendances"("status", "date");

ALTER TABLE "class_attendances"
  ADD CONSTRAINT "class_attendances_scheduleId_fkey"
  FOREIGN KEY ("scheduleId") REFERENCES "weekly_class_schedules"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "class_attendances"
  ADD CONSTRAINT "class_attendances_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
