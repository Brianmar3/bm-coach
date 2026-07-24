CREATE TABLE "training_routine_versions" (
  "id" TEXT NOT NULL,
  "routineId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "summary" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "training_routine_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "training_routine_versions_routineId_version_key"
ON "training_routine_versions"("routineId", "version");

CREATE INDEX "training_routine_versions_routineId_createdAt_idx"
ON "training_routine_versions"("routineId", "createdAt");

ALTER TABLE "training_routine_versions"
ADD CONSTRAINT "training_routine_versions_routineId_fkey"
FOREIGN KEY ("routineId") REFERENCES "training_routines"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workout_sessions"
ADD COLUMN "routineNameSnapshot" TEXT,
ADD COLUMN "routineDayNumberSnapshot" INTEGER;

ALTER TABLE "workout_exercise_logs"
ADD COLUMN "exerciseReferenceId" TEXT;

UPDATE "workout_sessions" AS session
SET "routineNameSnapshot" = routine."name",
    "routineDayNumberSnapshot" = day."dayNumber"
FROM "training_routines" AS routine, "training_routine_days" AS day
WHERE session."routineId" = routine."id"
  AND session."dayId" = day."id";

UPDATE "workout_exercise_logs" AS log
SET "exerciseReferenceId" = log."exerciseId"
WHERE log."exerciseReferenceId" IS NULL;

UPDATE "workout_exercise_logs" AS log
SET "snapshotVersion" = 0,
    "exerciseName" = exercise."name",
    "targetSets" = exercise."sets",
    "targetRepetitions" = exercise."repetitions",
    "suggestedWeight" = exercise."weight",
    "targetEffortType" = exercise."effortType",
    "targetEffortValue" = exercise."effortValue",
    "targetRestSeconds" = exercise."restSeconds",
    "coachInstructions" = exercise."observations",
    "exerciseOrder" = exercise."order",
    "routineName" = routine."name",
    "routineDayNumber" = day."dayNumber"
FROM "training_routine_exercises" AS exercise,
     "training_routine_days" AS day,
     "training_routines" AS routine
WHERE log."exerciseId" = exercise."id"
  AND exercise."dayId" = day."id"
  AND day."routineId" = routine."id"
  AND log."snapshotVersion" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "workout_sessions"
    WHERE "routineNameSnapshot" IS NULL
       OR "routineDayNumberSnapshot" IS NULL
  ) THEN
    RAISE EXCEPTION 'No se pudo crear el snapshot de rutina para todas las sesiones.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "workout_exercise_logs"
    WHERE "exerciseReferenceId" IS NULL
       OR "snapshotVersion" IS NULL
       OR "exerciseName" IS NULL
       OR "targetSets" IS NULL
       OR "targetRepetitions" IS NULL
       OR "targetEffortType" IS NULL
       OR "coachInstructions" IS NULL
       OR "exerciseOrder" IS NULL
       OR "routineName" IS NULL
       OR "routineDayNumber" IS NULL
  ) THEN
    RAISE EXCEPTION 'No se pudo crear el snapshot de ejercicio para todos los registros.';
  END IF;
END $$;

ALTER TABLE "workout_sessions"
ALTER COLUMN "routineNameSnapshot" SET NOT NULL,
ALTER COLUMN "routineDayNumberSnapshot" SET NOT NULL;

ALTER TABLE "workout_exercise_logs"
ALTER COLUMN "exerciseReferenceId" SET NOT NULL;

ALTER TABLE "workout_sessions" DROP CONSTRAINT "workout_sessions_routineId_fkey";
ALTER TABLE "workout_sessions" DROP CONSTRAINT "workout_sessions_dayId_fkey";
ALTER TABLE "workout_sessions" DROP CONSTRAINT "workout_sessions_studentId_fkey";
ALTER TABLE "workout_exercise_logs" DROP CONSTRAINT "workout_exercise_logs_exerciseId_fkey";

ALTER TABLE "workout_sessions" ALTER COLUMN "routineId" DROP NOT NULL;
ALTER TABLE "workout_sessions" ALTER COLUMN "dayId" DROP NOT NULL;
ALTER TABLE "workout_exercise_logs" ALTER COLUMN "exerciseId" DROP NOT NULL;

ALTER TABLE "workout_sessions"
ADD CONSTRAINT "workout_sessions_routineId_fkey"
FOREIGN KEY ("routineId") REFERENCES "training_routines"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "workout_sessions"
ADD CONSTRAINT "workout_sessions_dayId_fkey"
FOREIGN KEY ("dayId") REFERENCES "training_routine_days"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "workout_sessions"
ADD CONSTRAINT "workout_sessions_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "students"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "workout_exercise_logs"
ADD CONSTRAINT "workout_exercise_logs_exerciseId_fkey"
FOREIGN KEY ("exerciseId") REFERENCES "training_routine_exercises"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "workout_exercise_logs_exerciseReferenceId_updatedAt_idx"
ON "workout_exercise_logs"("exerciseReferenceId", "updatedAt");
