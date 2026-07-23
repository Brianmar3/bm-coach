ALTER TABLE "training_routine_days"
ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "archivedAt" TIMESTAMP(3);

ALTER TABLE "training_routine_exercises"
ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "training_routine_days_routineId_active_idx"
ON "training_routine_days"("routineId", "active");

CREATE INDEX "training_routine_exercises_dayId_active_idx"
ON "training_routine_exercises"("dayId", "active");
