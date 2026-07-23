CREATE TYPE "WorkoutSessionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "FollowUpAuthor" AS ENUM ('STUDENT', 'COACH');
CREATE TYPE "FollowUpContext" AS ENUM ('SESSION', 'EXERCISE', 'EVALUATION', 'GENERAL');
CREATE TYPE "FollowUpCategory" AS ENUM ('QUESTION', 'DIFFICULTY', 'PAIN', 'FEEDBACK');
CREATE TYPE "FollowUpStatus" AS ENUM ('PENDING', 'REVIEWED');

CREATE TABLE "workout_sessions" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "routineId" TEXT NOT NULL,
  "dayId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "startTime" TEXT NOT NULL,
  "durationMinutes" INTEGER,
  "energyBefore" INTEGER,
  "difficulty" INTEGER,
  "energyAfter" INTEGER,
  "finalComment" TEXT NOT NULL DEFAULT '',
  "hasPain" BOOLEAN NOT NULL DEFAULT false,
  "painDetails" TEXT NOT NULL DEFAULT '',
  "status" "WorkoutSessionStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workout_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workout_exercise_logs" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "exerciseId" TEXT NOT NULL,
  "observation" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workout_exercise_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workout_set_logs" (
  "id" TEXT NOT NULL,
  "exerciseLogId" TEXT NOT NULL,
  "setNumber" INTEGER NOT NULL,
  "weight" DECIMAL(7,2),
  "repetitions" INTEGER,
  "effort" DECIMAL(4,1),
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "observation" TEXT NOT NULL DEFAULT '',
  CONSTRAINT "workout_set_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "follow_up_comments" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "author" "FollowUpAuthor" NOT NULL,
  "context" "FollowUpContext" NOT NULL,
  "category" "FollowUpCategory" NOT NULL,
  "status" "FollowUpStatus" NOT NULL DEFAULT 'PENDING',
  "body" TEXT NOT NULL,
  "private" BOOLEAN NOT NULL DEFAULT false,
  "sessionId" TEXT,
  "exerciseId" TEXT,
  "evaluationId" TEXT,
  "parentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "follow_up_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "workout_sessions_studentId_date_idx" ON "workout_sessions"("studentId", "date");
CREATE INDEX "workout_sessions_status_updatedAt_idx" ON "workout_sessions"("status", "updatedAt");
CREATE UNIQUE INDEX "workout_exercise_logs_sessionId_exerciseId_key" ON "workout_exercise_logs"("sessionId", "exerciseId");
CREATE INDEX "workout_exercise_logs_exerciseId_updatedAt_idx" ON "workout_exercise_logs"("exerciseId", "updatedAt");
CREATE UNIQUE INDEX "workout_set_logs_exerciseLogId_setNumber_key" ON "workout_set_logs"("exerciseLogId", "setNumber");
CREATE INDEX "follow_up_comments_studentId_createdAt_idx" ON "follow_up_comments"("studentId", "createdAt");
CREATE INDEX "follow_up_comments_status_category_idx" ON "follow_up_comments"("status", "category");
CREATE INDEX "follow_up_comments_parentId_idx" ON "follow_up_comments"("parentId");

ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "training_routines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "training_routine_days"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workout_exercise_logs" ADD CONSTRAINT "workout_exercise_logs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "workout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workout_exercise_logs" ADD CONSTRAINT "workout_exercise_logs_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "training_routine_exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workout_set_logs" ADD CONSTRAINT "workout_set_logs_exerciseLogId_fkey" FOREIGN KEY ("exerciseLogId") REFERENCES "workout_exercise_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "follow_up_comments" ADD CONSTRAINT "follow_up_comments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "follow_up_comments" ADD CONSTRAINT "follow_up_comments_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "workout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "follow_up_comments" ADD CONSTRAINT "follow_up_comments_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "training_routine_exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "follow_up_comments" ADD CONSTRAINT "follow_up_comments_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "physical_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "follow_up_comments" ADD CONSTRAINT "follow_up_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "follow_up_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
