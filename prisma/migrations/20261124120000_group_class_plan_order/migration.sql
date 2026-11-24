ALTER TABLE "group_class_plans" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "workspaceId", "date" ORDER BY "createdAt", "id") - 1 AS position
  FROM "group_class_plans"
)
UPDATE "group_class_plans" AS plan
SET "sortOrder" = numbered.position
FROM numbered
WHERE plan."id" = numbered."id";

CREATE INDEX "group_class_plans_workspaceId_date_sortOrder_idx"
ON "group_class_plans"("workspaceId", "date", "sortOrder");
