CREATE TYPE "StudentNotificationType" AS ENUM (
    'MESSAGE',
    'FEEDBACK',
    'ANNOUNCEMENT',
    'EVENT',
    'NEWS',
    'REMINDER',
    'ACHIEVEMENT'
);

CREATE TABLE "student_notifications" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "StudentNotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "url" TEXT NOT NULL DEFAULT '/portal',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "student_notifications_studentId_readAt_createdAt_idx"
ON "student_notifications"("studentId", "readAt", "createdAt" DESC);

ALTER TABLE "student_notifications"
ADD CONSTRAINT "student_notifications_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "students"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
