ALTER TABLE "workout_exercise_logs"
ADD COLUMN "snapshotVersion" INTEGER,
ADD COLUMN "exerciseName" TEXT,
ADD COLUMN "targetSets" INTEGER,
ADD COLUMN "targetRepetitions" TEXT,
ADD COLUMN "suggestedWeight" DECIMAL(7, 2),
ADD COLUMN "targetEffortType" "TrainingEffortType",
ADD COLUMN "targetEffortValue" DECIMAL(4, 1),
ADD COLUMN "targetRestSeconds" INTEGER,
ADD COLUMN "coachInstructions" TEXT,
ADD COLUMN "exerciseOrder" INTEGER,
ADD COLUMN "routineName" TEXT,
ADD COLUMN "routineDayNumber" INTEGER;

COMMENT ON COLUMN "workout_exercise_logs"."snapshotVersion" IS
'NULL indicates a legacy log created before workout programming snapshots were introduced.';
