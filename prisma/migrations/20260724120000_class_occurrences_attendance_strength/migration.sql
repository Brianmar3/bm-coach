CREATE TYPE "ClassOccurrenceStatus" AS ENUM ('SCHEDULED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "ClassResponseStatus" AS ENUM ('GOING', 'NOT_GOING');
CREATE TYPE "ClassActualAttendance" AS ENUM ('UNKNOWN', 'PRESENT', 'ABSENT', 'CANCELLED');
CREATE TYPE "ClassWorkoutLogStatus" AS ENUM ('DRAFT', 'COMPLETED');

CREATE TABLE "class_occurrences" (
  "id" TEXT NOT NULL,
  "scheduleId" TEXT,
  "date" DATE NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "classNameSnapshot" TEXT NOT NULL,
  "categorySnapshot" TEXT NOT NULL,
  "status" "ClassOccurrenceStatus" NOT NULL DEFAULT 'SCHEDULED',
  "capacityOverride" INTEGER,
  "internalNotes" TEXT NOT NULL DEFAULT '',
  "strengthEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "class_occurrences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "class_occurrence_attendances" (
  "id" TEXT NOT NULL,
  "occurrenceId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "response" "ClassResponseStatus",
  "actualAttendance" "ClassActualAttendance" NOT NULL DEFAULT 'UNKNOWN',
  "respondedAt" TIMESTAMP(3),
  "checkedInAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "class_occurrence_attendances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "class_strength_blocks" (
  "id" TEXT NOT NULL,
  "occurrenceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "class_strength_blocks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "class_strength_exercises" (
  "id" TEXT NOT NULL,
  "strengthBlockId" TEXT NOT NULL,
  "exerciseName" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "suggestedSets" INTEGER NOT NULL,
  "suggestedReps" TEXT NOT NULL,
  "instructions" TEXT NOT NULL DEFAULT '',
  CONSTRAINT "class_strength_exercises_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "class_workout_logs" (
  "id" TEXT NOT NULL,
  "occurrenceId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "classNameSnapshot" TEXT NOT NULL,
  "classDateSnapshot" DATE NOT NULL,
  "status" "ClassWorkoutLogStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT NOT NULL DEFAULT '',
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "class_workout_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "class_exercise_logs" (
  "id" TEXT NOT NULL,
  "classWorkoutLogId" TEXT NOT NULL,
  "exerciseNameSnapshot" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '',
  CONSTRAINT "class_exercise_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "class_set_logs" (
  "id" TEXT NOT NULL,
  "classExerciseLogId" TEXT NOT NULL,
  "setNumber" INTEGER NOT NULL,
  "weight" DECIMAL(7,2),
  "repetitions" INTEGER,
  "unit" TEXT NOT NULL DEFAULT 'kg',
  "notes" TEXT NOT NULL DEFAULT '',
  CONSTRAINT "class_set_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "class_occurrences_scheduleId_date_key" ON "class_occurrences"("scheduleId", "date");
CREATE INDEX "class_occurrences_date_startTime_idx" ON "class_occurrences"("date", "startTime");
CREATE INDEX "class_occurrences_status_date_idx" ON "class_occurrences"("status", "date");
CREATE UNIQUE INDEX "class_occurrence_attendances_occurrenceId_studentId_key" ON "class_occurrence_attendances"("occurrenceId", "studentId");
CREATE INDEX "class_occurrence_attendances_studentId_updatedAt_idx" ON "class_occurrence_attendances"("studentId", "updatedAt");
CREATE INDEX "class_occurrence_attendances_occurrenceId_response_idx" ON "class_occurrence_attendances"("occurrenceId", "response");
CREATE UNIQUE INDEX "class_strength_blocks_occurrenceId_key" ON "class_strength_blocks"("occurrenceId");
CREATE UNIQUE INDEX "class_strength_exercises_strengthBlockId_order_key" ON "class_strength_exercises"("strengthBlockId", "order");
CREATE UNIQUE INDEX "class_workout_logs_occurrenceId_studentId_key" ON "class_workout_logs"("occurrenceId", "studentId");
CREATE INDEX "class_workout_logs_studentId_classDateSnapshot_idx" ON "class_workout_logs"("studentId", "classDateSnapshot");
CREATE UNIQUE INDEX "class_exercise_logs_classWorkoutLogId_order_key" ON "class_exercise_logs"("classWorkoutLogId", "order");
CREATE UNIQUE INDEX "class_set_logs_classExerciseLogId_setNumber_key" ON "class_set_logs"("classExerciseLogId", "setNumber");

ALTER TABLE "class_occurrences" ADD CONSTRAINT "class_occurrences_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "weekly_class_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "class_occurrence_attendances" ADD CONSTRAINT "class_occurrence_attendances_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "class_occurrences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "class_occurrence_attendances" ADD CONSTRAINT "class_occurrence_attendances_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "class_strength_blocks" ADD CONSTRAINT "class_strength_blocks_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "class_occurrences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "class_strength_exercises" ADD CONSTRAINT "class_strength_exercises_strengthBlockId_fkey" FOREIGN KEY ("strengthBlockId") REFERENCES "class_strength_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "class_workout_logs" ADD CONSTRAINT "class_workout_logs_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "class_occurrences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "class_workout_logs" ADD CONSTRAINT "class_workout_logs_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "class_exercise_logs" ADD CONSTRAINT "class_exercise_logs_classWorkoutLogId_fkey" FOREIGN KEY ("classWorkoutLogId") REFERENCES "class_workout_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "class_set_logs" ADD CONSTRAINT "class_set_logs_classExerciseLogId_fkey" FOREIGN KEY ("classExerciseLogId") REFERENCES "class_exercise_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
