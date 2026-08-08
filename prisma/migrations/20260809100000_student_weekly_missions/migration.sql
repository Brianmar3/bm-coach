ALTER TYPE "StudentPointEventType" ADD VALUE 'WEEKLY_MISSION';
ALTER TYPE "StudentPointSourceType" ADD VALUE 'WEEKLY_MISSION';

CREATE TYPE "WeeklyMissionType" AS ENUM ('ATTENDANCE');
CREATE TYPE "WeeklyMissionState" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED');

CREATE TABLE "student_weekly_missions" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "weekEnd" DATE NOT NULL,
    "type" "WeeklyMissionType" NOT NULL DEFAULT 'ATTENDANCE',
    "title" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "scheduledClassKeys" TEXT[] NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "state" "WeeklyMissionState" NOT NULL DEFAULT 'ACTIVE',
    "rewardPoints" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3),
    "pointsAwardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_weekly_missions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_weekly_missions_studentId_weekStart_key"
ON "student_weekly_missions"("studentId", "weekStart");

CREATE INDEX "student_weekly_missions_studentId_state_weekStart_idx"
ON "student_weekly_missions"("studentId", "state", "weekStart" DESC);

ALTER TABLE "student_weekly_missions"
ADD CONSTRAINT "student_weekly_missions_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
