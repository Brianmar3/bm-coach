CREATE TABLE "group_class_drafts" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "trainerId" TEXT NOT NULL,
  "draftKey" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "group_class_drafts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "group_class_drafts_workspaceId_trainerId_draftKey_key"
  ON "group_class_drafts"("workspaceId", "trainerId", "draftKey");
ALTER TABLE "group_class_drafts" ADD CONSTRAINT "group_class_drafts_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_class_drafts" ADD CONSTRAINT "group_class_drafts_trainerId_fkey"
  FOREIGN KEY ("trainerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
