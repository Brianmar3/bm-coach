CREATE TYPE "TrainingBlockType" AS ENUM ('STRENGTH', 'ROUNDS', 'INTERVAL', 'EMOM', 'AMRAP', 'FOR_TIME', 'FREE');
CREATE TYPE "TrainingExerciseTargetType" AS ENUM ('TIME', 'REPS', 'DISTANCE', 'REST', 'FREE');

CREATE TABLE "training_routine_blocks" (
  "id" TEXT NOT NULL,
  "routineDayId" TEXT NOT NULL,
  "type" "TrainingBlockType" NOT NULL,
  "name" TEXT NOT NULL DEFAULT '',
  "order" INTEGER NOT NULL,
  "rounds" INTEGER,
  "durationSeconds" INTEGER,
  "workSeconds" INTEGER,
  "restSeconds" INTEGER,
  "restBetweenRoundsSeconds" INTEGER,
  "targetRounds" INTEGER,
  "instructions" TEXT NOT NULL DEFAULT '',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "training_routine_blocks_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "training_routine_exercises"
  ADD COLUMN "blockId" TEXT,
  ADD COLUMN "targetType" "TrainingExerciseTargetType" NOT NULL DEFAULT 'REPS',
  ADD COLUMN "targetSeconds" INTEGER,
  ADD COLUMN "targetRepetitions" TEXT,
  ADD COLUMN "targetDistance" TEXT,
  ADD COLUMN "targetSide" TEXT;

INSERT INTO "training_routine_blocks" ("id", "routineDayId", "type", "name", "order", "createdAt", "updatedAt")
SELECT 'legacy-strength-' || day."id", day."id", 'STRENGTH', 'Bloque de fuerza', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "training_routine_days" day
WHERE NOT EXISTS (
  SELECT 1 FROM "training_routine_blocks" block WHERE block."routineDayId" = day."id"
);

UPDATE "training_routine_exercises" exercise
SET "blockId" = 'legacy-strength-' || exercise."dayId"
WHERE exercise."blockId" IS NULL;

ALTER TABLE "training_routine_exercises" ALTER COLUMN "blockId" SET NOT NULL;

CREATE TABLE "workout_block_logs" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "blockId" TEXT,
  "blockReferenceId" TEXT NOT NULL,
  "snapshotVersion" INTEGER NOT NULL DEFAULT 1,
  "blockName" TEXT NOT NULL,
  "blockType" "TrainingBlockType" NOT NULL,
  "blockOrder" INTEGER NOT NULL,
  "blockConfiguration" JSONB NOT NULL,
  "exercisesSnapshot" JSONB NOT NULL,
  "result" JSONB NOT NULL,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workout_block_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "training_routine_blocks_routineDayId_order_idx" ON "training_routine_blocks"("routineDayId", "order");
CREATE INDEX "training_routine_blocks_routineDayId_active_idx" ON "training_routine_blocks"("routineDayId", "active");
CREATE INDEX "training_routine_exercises_blockId_order_idx" ON "training_routine_exercises"("blockId", "order");
CREATE UNIQUE INDEX "workout_block_logs_sessionId_blockReferenceId_key" ON "workout_block_logs"("sessionId", "blockReferenceId");
CREATE INDEX "workout_block_logs_blockReferenceId_updatedAt_idx" ON "workout_block_logs"("blockReferenceId", "updatedAt");

ALTER TABLE "training_routine_blocks" ADD CONSTRAINT "training_routine_blocks_routineDayId_fkey" FOREIGN KEY ("routineDayId") REFERENCES "training_routine_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_routine_exercises" ADD CONSTRAINT "training_routine_exercises_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "training_routine_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workout_block_logs" ADD CONSTRAINT "workout_block_logs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "workout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workout_block_logs" ADD CONSTRAINT "workout_block_logs_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "training_routine_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
