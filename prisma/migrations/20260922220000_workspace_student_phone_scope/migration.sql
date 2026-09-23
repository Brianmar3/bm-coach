-- The same normalized phone can belong to students in different workspaces.
-- The previous global unique index guarantees there are no duplicates inside a
-- workspace before this replacement, so the new composite index is safe.
DROP INDEX IF EXISTS "students_phoneNormalized_key";

CREATE UNIQUE INDEX "students_workspaceId_phoneNormalized_key"
ON "students"("workspaceId", "phoneNormalized");
