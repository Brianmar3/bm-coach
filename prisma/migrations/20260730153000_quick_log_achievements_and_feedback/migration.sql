-- Keep a stable, normalized identity for exercise records and an optional
-- client request key for safe retries.
ALTER TABLE "quick_logs"
ADD COLUMN "exerciseKey" TEXT NOT NULL DEFAULT '',
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "previousSets" INTEGER,
ADD COLUMN "previousRepetitions" INTEGER;

UPDATE "quick_logs"
SET "exerciseKey" = LOWER(REGEXP_REPLACE(BTRIM("exerciseName"), '[[:space:]]+', ' ', 'g'))
WHERE "exerciseName" <> '';

CREATE UNIQUE INDEX "quick_logs_idempotencyKey_key"
ON "quick_logs"("idempotencyKey");

CREATE INDEX "quick_logs_studentId_exerciseKey_createdAt_idx"
ON "quick_logs"("studentId", "exerciseKey", "createdAt" DESC);

CREATE TYPE "QuickLogAchievementType" AS ENUM (
    'FIRST_MARK',
    'MAX_LOAD',
    'REPETITION_PR',
    'RECORD_MILESTONE'
);

CREATE TABLE "quick_log_achievements" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "quickLogId" TEXT NOT NULL,
    "achievementKey" TEXT NOT NULL,
    "type" "QuickLogAchievementType" NOT NULL,
    "exerciseName" TEXT NOT NULL,
    "exerciseKey" TEXT NOT NULL,
    "sets" INTEGER,
    "repetitions" INTEGER,
    "unit" TEXT NOT NULL DEFAULT '',
    "currentLoad" DECIMAL(10,2),
    "previousLoad" DECIMAL(10,2),
    "difference" DECIMAL(10,2),
    "recordCount" INTEGER,
    "unlockedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quick_log_achievements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "quick_log_achievements_studentId_achievementKey_key"
ON "quick_log_achievements"("studentId", "achievementKey");

CREATE INDEX "quick_log_achievements_studentId_unlockedAt_idx"
ON "quick_log_achievements"("studentId", "unlockedAt" DESC);

CREATE INDEX "quick_log_achievements_quickLogId_idx"
ON "quick_log_achievements"("quickLogId");

CREATE TABLE "quick_log_feedback" (
    "id" TEXT NOT NULL,
    "quickLogId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "trainerName" TEXT NOT NULL,
    "preset" TEXT NOT NULL DEFAULT '',
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quick_log_feedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "quick_log_feedback_quickLogId_key"
ON "quick_log_feedback"("quickLogId");

CREATE INDEX "quick_log_feedback_studentId_createdAt_idx"
ON "quick_log_feedback"("studentId", "createdAt" DESC);

ALTER TABLE "quick_log_achievements"
ADD CONSTRAINT "quick_log_achievements_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "students"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "quick_log_achievements"
ADD CONSTRAINT "quick_log_achievements_quickLogId_fkey"
FOREIGN KEY ("quickLogId") REFERENCES "quick_logs"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "quick_log_feedback"
ADD CONSTRAINT "quick_log_feedback_quickLogId_fkey"
FOREIGN KEY ("quickLogId") REFERENCES "quick_logs"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "quick_log_feedback"
ADD CONSTRAINT "quick_log_feedback_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "students"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
