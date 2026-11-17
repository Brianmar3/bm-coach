CREATE TABLE "group_class_plans" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "routineId" TEXT,
  "occurrenceId" TEXT,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "group_class_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "group_class_plans_occurrenceId_key" ON "group_class_plans"("occurrenceId");
CREATE INDEX "group_class_plans_workspaceId_date_idx" ON "group_class_plans"("workspaceId", "date");

ALTER TABLE "group_class_plans" ADD CONSTRAINT "group_class_plans_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "group_class_plans" ADD CONSTRAINT "group_class_plans_routineId_fkey"
  FOREIGN KEY ("routineId") REFERENCES "training_routines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "group_class_plans" ADD CONSTRAINT "group_class_plans_occurrenceId_fkey"
  FOREIGN KEY ("occurrenceId") REFERENCES "class_occurrences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Copy existing plans without changing the occurrence or its taught snapshot.
INSERT INTO "group_class_plans" ("id", "workspaceId", "date", "routineId", "occurrenceId", "snapshot", "createdAt", "updatedAt")
SELECT 'legacy-' || "id", "workspaceId", "date", "plannedRoutineId", "id", "plannedSnapshot", "createdAt", "updatedAt"
FROM "class_occurrences"
WHERE "plannedSnapshot" IS NOT NULL;
