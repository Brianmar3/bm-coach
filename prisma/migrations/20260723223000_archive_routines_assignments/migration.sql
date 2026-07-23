ALTER TABLE "training_routines"
ADD COLUMN "archivedAt" TIMESTAMP(3);

ALTER TABLE "training_routine_assignments"
ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "training_routine_assignments_studentId_active_idx"
ON "training_routine_assignments"("studentId", "active");

UPDATE "training_routines"
SET "archivedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP)
WHERE "status" = 'ARCHIVADA' AND "archivedAt" IS NULL;

UPDATE "training_routine_assignments" AS assignment
SET "active" = false,
    "archivedAt" = COALESCE(routine."archivedAt", CURRENT_TIMESTAMP)
FROM "training_routines" AS routine
WHERE assignment."routineId" = routine."id"
  AND routine."status" = 'ARCHIVADA';
