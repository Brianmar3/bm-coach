ALTER TABLE "weekly_class_schedules" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "class_occurrences" ADD COLUMN "suppressedBySchedule" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "weekly_class_schedules_archivedAt_idx" ON "weekly_class_schedules"("archivedAt");
