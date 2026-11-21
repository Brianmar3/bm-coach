CREATE TABLE "class_day_suspensions" (
  "workspaceId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "class_day_suspensions_pkey" PRIMARY KEY ("workspaceId", "date")
);

ALTER TABLE "class_day_suspensions"
  ADD CONSTRAINT "class_day_suspensions_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
