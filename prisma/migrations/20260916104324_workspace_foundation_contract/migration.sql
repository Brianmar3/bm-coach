-- Workspace Foundation CONTRACT migration.
--
-- This file is intentionally outside prisma/migrations. Do not move it into the
-- active migration chain until the compatible app is deployed, the backfill is
-- complete and idempotent, and the EXPAND verifier and inventory comparison pass.

BEGIN;

DO $$
DECLARE
  table_name text;
  null_count bigint;
  required_index text;
  legacy_index text;
BEGIN
  FOREACH required_index IN ARRAY ARRAY[
    'trainer_push_subscriptions_workspaceId_endpoint_key',
    'trainer_notifications_workspaceId_eventKey_key',
    'training_library_folders_workspaceId_normalizedName_key',
    'training_library_tags_workspaceId_normalizedName_key',
    'monthly_summaries_workspaceId_year_month_key'
  ]
  LOOP
    IF to_regclass(format('%I.%I', 'public', required_index)) IS NULL THEN
      RAISE EXCEPTION 'Workspace Foundation CONTRACT blocked: missing final index %', required_index;
    END IF;
  END LOOP;

  FOREACH legacy_index IN ARRAY ARRAY[
    'trainer_push_subscriptions_endpoint_key',
    'trainer_notifications_eventKey_key',
    'training_library_folders_normalizedName_key',
    'training_library_tags_normalizedName_key',
    'monthly_summaries_year_month_key'
  ]
  LOOP
    IF to_regclass(format('%I.%I', 'public', legacy_index)) IS NULL THEN
      RAISE EXCEPTION 'Workspace Foundation CONTRACT blocked: missing legacy index %', legacy_index;
    END IF;
  END LOOP;

  FOREACH table_name IN ARRAY ARRAY[
    'students',
    'coach_settings',
    'monthly_summaries',
    'trainer_push_subscriptions',
    'trainer_notifications',
    'payments',
    'events',
    'coach_events',
    'routines',
    'training_routines',
    'training_library_folders',
    'training_library_tags',
    'training_block_templates',
    'evaluations',
    'weekly_class_schedules',
    'class_occurrences',
    'classes'
  ]
  LOOP
    EXECUTE format('SELECT count(*) FROM %I WHERE "workspaceId" IS NULL', table_name)
      INTO null_count;

    IF null_count <> 0 THEN
      RAISE EXCEPTION 'Workspace Foundation CONTRACT blocked: %.workspaceId has % NULL rows', table_name, null_count;
    END IF;
  END LOOP;
END $$;

ALTER TABLE "students" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "coach_settings" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "monthly_summaries" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "trainer_push_subscriptions" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "trainer_notifications" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "payments" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "events" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "coach_events" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "routines" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "training_routines" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "training_library_folders" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "training_library_tags" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "training_block_templates" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "evaluations" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "weekly_class_schedules" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "class_occurrences" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "classes" ALTER COLUMN "workspaceId" SET NOT NULL;

DROP INDEX "trainer_push_subscriptions_endpoint_key";
DROP INDEX "trainer_notifications_eventKey_key";
DROP INDEX "training_library_folders_normalizedName_key";
DROP INDEX "training_library_tags_normalizedName_key";
DROP INDEX "monthly_summaries_year_month_key";

COMMIT;
