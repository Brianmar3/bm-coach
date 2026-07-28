-- CreateEnum
CREATE TYPE "QuickLogType" AS ENUM ('WORKOUT', 'NOTE', 'PROGRESS', 'PHOTO');

-- CreateTable
CREATE TABLE "quick_logs" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "QuickLogType" NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "date" DATE NOT NULL,
    "durationMinutes" INTEGER,
    "exerciseName" TEXT NOT NULL DEFAULT '',
    "metricType" TEXT NOT NULL DEFAULT '',
    "previousValue" DECIMAL(10,2),
    "currentValue" DECIMAL(10,2),
    "unit" TEXT NOT NULL DEFAULT '',
    "mood" TEXT NOT NULL DEFAULT '',
    "hasPain" BOOLEAN NOT NULL DEFAULT false,
    "painDetails" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "quick_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quick_log_photos" (
    "id" TEXT NOT NULL,
    "quickLogId" TEXT NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "blobPathname" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quick_log_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quick_logs_studentId_date_idx" ON "quick_logs"("studentId", "date" DESC);
CREATE INDEX "quick_logs_studentId_type_date_idx" ON "quick_logs"("studentId", "type", "date" DESC);
CREATE INDEX "quick_log_photos_quickLogId_idx" ON "quick_log_photos"("quickLogId");

-- AddForeignKey
ALTER TABLE "quick_logs" ADD CONSTRAINT "quick_logs_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "quick_log_photos" ADD CONSTRAINT "quick_log_photos_quickLogId_fkey"
FOREIGN KEY ("quickLogId") REFERENCES "quick_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
