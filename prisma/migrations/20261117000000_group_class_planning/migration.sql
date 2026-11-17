ALTER TABLE "class_occurrences"
  ADD COLUMN "plannedRoutineId" TEXT,
  ADD COLUMN "plannedSnapshot" JSONB,
  ADD COLUMN "taughtSnapshot" JSONB,
  ADD COLUMN "taughtAt" TIMESTAMP(3);

CREATE INDEX "class_occurrences_workspaceId_plannedRoutineId_idx"
  ON "class_occurrences"("workspaceId", "plannedRoutineId");

ALTER TABLE "class_occurrences"
  ADD CONSTRAINT "class_occurrences_plannedRoutineId_fkey"
  FOREIGN KEY ("plannedRoutineId") REFERENCES "training_routines"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
