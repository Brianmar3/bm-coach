CREATE TYPE "ClassWorkoutLogAuthor" AS ENUM (
    'UNKNOWN',
    'STUDENT',
    'TRAINER'
);

ALTER TABLE "class_workout_logs"
ADD COLUMN "createdBy" "ClassWorkoutLogAuthor" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "lastEditedBy" "ClassWorkoutLogAuthor" NOT NULL DEFAULT 'UNKNOWN';

CREATE TABLE "class_exercise_log_feedback" (
    "id" TEXT NOT NULL,
    "classExerciseLogId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "trainerName" TEXT NOT NULL,
    "preset" TEXT NOT NULL DEFAULT '',
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_exercise_log_feedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "class_exercise_log_feedback_classExerciseLogId_key"
ON "class_exercise_log_feedback"("classExerciseLogId");

CREATE INDEX "class_exercise_log_feedback_studentId_createdAt_idx"
ON "class_exercise_log_feedback"("studentId", "createdAt" DESC);

ALTER TABLE "class_exercise_log_feedback"
ADD CONSTRAINT "class_exercise_log_feedback_classExerciseLogId_fkey"
FOREIGN KEY ("classExerciseLogId") REFERENCES "class_exercise_logs"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "class_exercise_log_feedback"
ADD CONSTRAINT "class_exercise_log_feedback_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "students"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
