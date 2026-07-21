CREATE TYPE "TrainingRoutineLevel" AS ENUM ('PRINCIPIANTE', 'INTERMEDIO', 'AVANZADO');
CREATE TYPE "TrainingRoutineStatus" AS ENUM ('ACTIVA', 'ARCHIVADA');
CREATE TYPE "TrainingEffortType" AS ENUM ('RPE', 'RIR');

CREATE TABLE "training_routines" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "level" "TrainingRoutineLevel" NOT NULL,
    "status" "TrainingRoutineStatus" NOT NULL DEFAULT 'ACTIVA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "training_routines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "training_routine_days" (
    "id" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    CONSTRAINT "training_routine_days_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "training_routine_exercises" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "muscleGroup" TEXT NOT NULL,
    "sets" INTEGER NOT NULL,
    "repetitions" TEXT NOT NULL,
    "weight" DECIMAL(7,2),
    "effortType" "TrainingEffortType" NOT NULL,
    "effortValue" DECIMAL(4,1),
    "restSeconds" INTEGER,
    "observations" TEXT NOT NULL DEFAULT '',
    "videoUrl" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "training_routine_exercises_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "training_routine_assignments" (
    "routineId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "training_routine_assignments_pkey" PRIMARY KEY ("routineId", "studentId")
);

CREATE INDEX "training_routines_objective_idx" ON "training_routines"("objective");
CREATE INDEX "training_routines_status_idx" ON "training_routines"("status");
CREATE UNIQUE INDEX "training_routine_days_routineId_dayNumber_key" ON "training_routine_days"("routineId", "dayNumber");
CREATE INDEX "training_routine_exercises_dayId_order_idx" ON "training_routine_exercises"("dayId", "order");
CREATE INDEX "training_routine_assignments_studentId_idx" ON "training_routine_assignments"("studentId");

ALTER TABLE "training_routine_days" ADD CONSTRAINT "training_routine_days_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "training_routines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_routine_exercises" ADD CONSTRAINT "training_routine_exercises_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "training_routine_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_routine_assignments" ADD CONSTRAINT "training_routine_assignments_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "training_routines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_routine_assignments" ADD CONSTRAINT "training_routine_assignments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
