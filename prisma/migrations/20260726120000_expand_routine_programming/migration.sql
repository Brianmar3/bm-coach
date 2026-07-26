ALTER TYPE "TrainingRoutineStatus" ADD VALUE IF NOT EXISTS 'BORRADOR' BEFORE 'ACTIVA';
ALTER TYPE "TrainingRoutineStatus" ADD VALUE IF NOT EXISTS 'FINALIZADA' AFTER 'ACTIVA';

ALTER TABLE "training_routines"
ADD COLUMN "startDate" DATE,
ADD COLUMN "durationWeeks" INTEGER,
ADD COLUMN "priorityMuscles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "training_routine_days"
ADD COLUMN "name" TEXT NOT NULL DEFAULT '',
ADD COLUMN "estimatedMinutes" INTEGER;

ALTER TABLE "workout_sessions"
ADD COLUMN "routineDayNameSnapshot" TEXT NOT NULL DEFAULT '',
ADD COLUMN "routineDayEstimatedMinutesSnapshot" INTEGER;

UPDATE "training_routine_days"
SET "name" = 'Día ' || "dayNumber"::TEXT
WHERE BTRIM("name") = '';

UPDATE "workout_sessions" AS session
SET
  "routineDayNameSnapshot" = COALESCE(NULLIF(BTRIM(day."name"), ''), 'Día ' || session."routineDayNumberSnapshot"::TEXT),
  "routineDayEstimatedMinutesSnapshot" = day."estimatedMinutes"
FROM "training_routine_days" AS day
WHERE session."dayId" = day."id";

UPDATE "workout_sessions"
SET "routineDayNameSnapshot" = 'Día ' || "routineDayNumberSnapshot"::TEXT
WHERE BTRIM("routineDayNameSnapshot") = '';

DROP INDEX IF EXISTS "training_routine_days_routineId_dayNumber_key";

CREATE INDEX "training_routine_days_routineId_dayNumber_idx"
ON "training_routine_days"("routineId", "dayNumber");

CREATE UNIQUE INDEX "training_routine_days_active_order_key"
ON "training_routine_days"("routineId", "dayNumber")
WHERE "active" = true;

ALTER TABLE "training_routines"
ADD CONSTRAINT "training_routines_durationWeeks_check"
CHECK ("durationWeeks" IS NULL OR ("durationWeeks" >= 1 AND "durationWeeks" <= 104));

ALTER TABLE "training_routine_days"
ADD CONSTRAINT "training_routine_days_estimatedMinutes_check"
CHECK ("estimatedMinutes" IS NULL OR ("estimatedMinutes" >= 1 AND "estimatedMinutes" <= 1440));
