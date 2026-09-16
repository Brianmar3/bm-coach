CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "WorkspaceType" AS ENUM ('PROFESSIONAL', 'PERSONAL');
CREATE TYPE "WorkspaceStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'COACH');
CREATE TYPE "WorkspaceMembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "WorkspaceContentScope" AS ENUM ('GLOBAL', 'WORKSPACE');

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "WorkspaceType" NOT NULL DEFAULT 'PROFESSIONAL',
    "status" "WorkspaceStatus" NOT NULL DEFAULT 'ACTIVE',
    "timeZone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workspace_memberships" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL,
    "status" "WorkspaceMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workspace_memberships_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "students" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "coach_settings" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "monthly_summaries" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "trainer_push_subscriptions" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "trainer_notifications" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "payments" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "events" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "coach_events" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "routines" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "training_routines" ADD COLUMN "workspaceId" TEXT, ADD COLUMN "scope" "WorkspaceContentScope" NOT NULL DEFAULT 'WORKSPACE';
ALTER TABLE "training_library_folders" ADD COLUMN "workspaceId" TEXT, ADD COLUMN "scope" "WorkspaceContentScope" NOT NULL DEFAULT 'WORKSPACE';
ALTER TABLE "training_library_tags" ADD COLUMN "workspaceId" TEXT, ADD COLUMN "scope" "WorkspaceContentScope" NOT NULL DEFAULT 'WORKSPACE';
ALTER TABLE "training_block_templates" ADD COLUMN "workspaceId" TEXT, ADD COLUMN "scope" "WorkspaceContentScope" NOT NULL DEFAULT 'WORKSPACE';
ALTER TABLE "evaluations" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "weekly_class_schedules" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "class_occurrences" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "classes" ADD COLUMN "workspaceId" TEXT;

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");
CREATE UNIQUE INDEX "workspace_memberships_workspaceId_userId_key" ON "workspace_memberships"("workspaceId", "userId");
CREATE INDEX "workspace_memberships_workspaceId_idx" ON "workspace_memberships"("workspaceId");
CREATE INDEX "workspace_memberships_userId_idx" ON "workspace_memberships"("userId");
CREATE INDEX "students_workspaceId_idx" ON "students"("workspaceId");
CREATE INDEX "coach_settings_workspaceId_idx" ON "coach_settings"("workspaceId");
CREATE INDEX "monthly_summaries_workspaceId_status_year_month_idx" ON "monthly_summaries"("workspaceId", "status", "year", "month");
CREATE INDEX "trainer_push_subscriptions_workspaceId_active_idx" ON "trainer_push_subscriptions"("workspaceId", "active");
CREATE UNIQUE INDEX "trainer_push_subscriptions_workspaceId_endpoint_key" ON "trainer_push_subscriptions"("workspaceId", "endpoint");
CREATE INDEX "trainer_notifications_workspaceId_readAt_createdAt_idx" ON "trainer_notifications"("workspaceId", "readAt", "createdAt" DESC);
CREATE UNIQUE INDEX "trainer_notifications_workspaceId_eventKey_key" ON "trainer_notifications"("workspaceId", "eventKey");
CREATE INDEX "payments_workspaceId_idx" ON "payments"("workspaceId");
CREATE INDEX "events_workspaceId_idx" ON "events"("workspaceId");
CREATE INDEX "coach_events_workspaceId_date_time_idx" ON "coach_events"("workspaceId", "date", "time");
CREATE INDEX "routines_workspaceId_idx" ON "routines"("workspaceId");
CREATE INDEX "training_routines_scope_workspaceId_status_idx" ON "training_routines"("scope", "workspaceId", "status");
CREATE INDEX "training_library_folders_scope_workspaceId_status_name_idx" ON "training_library_folders"("scope", "workspaceId", "status", "name");
CREATE UNIQUE INDEX "training_library_folders_workspaceId_normalizedName_key" ON "training_library_folders"("workspaceId", "normalizedName");
CREATE INDEX "training_library_tags_scope_workspaceId_name_idx" ON "training_library_tags"("scope", "workspaceId", "name");
CREATE UNIQUE INDEX "training_library_tags_workspaceId_normalizedName_key" ON "training_library_tags"("workspaceId", "normalizedName");
CREATE INDEX "training_block_templates_scope_workspaceId_status_updatedAt_idx" ON "training_block_templates"("scope", "workspaceId", "status", "updatedAt");
CREATE INDEX "evaluations_workspaceId_idx" ON "evaluations"("workspaceId");
CREATE INDEX "weekly_class_schedules_workspaceId_dayOfWeek_startTime_idx" ON "weekly_class_schedules"("workspaceId", "dayOfWeek", "startTime");
CREATE INDEX "class_occurrences_workspaceId_date_startTime_idx" ON "class_occurrences"("workspaceId", "date", "startTime");
CREATE INDEX "classes_workspaceId_date_idx" ON "classes"("workspaceId", "date");
CREATE UNIQUE INDEX "monthly_summaries_workspaceId_year_month_key" ON "monthly_summaries"("workspaceId", "year", "month");

ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "students" ADD CONSTRAINT "students_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "coach_settings" ADD CONSTRAINT "coach_settings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "monthly_summaries" ADD CONSTRAINT "monthly_summaries_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trainer_push_subscriptions" ADD CONSTRAINT "trainer_push_subscriptions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trainer_notifications" ADD CONSTRAINT "trainer_notifications_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "coach_events" ADD CONSTRAINT "coach_events_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "routines" ADD CONSTRAINT "routines_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training_routines" ADD CONSTRAINT "training_routines_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training_library_folders" ADD CONSTRAINT "training_library_folders_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training_library_tags" ADD CONSTRAINT "training_library_tags_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training_block_templates" ADD CONSTRAINT "training_block_templates_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "weekly_class_schedules" ADD CONSTRAINT "weekly_class_schedules_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "class_occurrences" ADD CONSTRAINT "class_occurrences_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "classes" ADD CONSTRAINT "classes_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
