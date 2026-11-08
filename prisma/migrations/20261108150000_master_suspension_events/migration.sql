BEGIN;

ALTER TABLE "master_membership_renewals"
  ALTER COLUMN "subscriptionId" DROP NOT NULL,
  ALTER COLUMN "nextDueAt" DROP NOT NULL,
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'RENEWED',
  ADD CONSTRAINT "master_membership_event_kind" CHECK (
    "kind" = 'SUSPENDED' OR ("kind" = 'RENEWED' AND "subscriptionId" IS NOT NULL AND "nextDueAt" IS NOT NULL)
  );

-- Capture the first transition into effective suspension, even when the
-- same transaction suspends both the account and the subscription.
CREATE FUNCTION bm_capture_master_suspension() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."status" <> 'SUSPENDED' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."status" = 'SUSPENDED' THEN
    RETURN NEW;
  END IF;

  -- Master writers lock the trainer row before any subscription write.
  -- This trigger only reads the counterpart and writes to the event table.
  IF TG_TABLE_NAME = 'users' THEN
    INSERT INTO "master_membership_renewals" ("kind", "subscriptionId", "trainerUserId", "trainerName", "plan", "nextDueAt")
    SELECT 'SUSPENDED', s."id", NEW."id", NEW."name", COALESCE(s."plan"::text, 'Sin asignar'), s."nextDueAt"
    FROM (SELECT 1) AS source
    LEFT JOIN "trainer_subscriptions" s ON s."trainerUserId" = NEW."id"
    WHERE NEW."platformRole" = 'TRAINER' AND s."status" IS DISTINCT FROM 'SUSPENDED'
      AND EXISTS (
        SELECT 1 FROM "workspace_memberships" m JOIN "workspaces" w ON w."id" = m."workspaceId"
        WHERE m."userId" = NEW."id" AND m."role" = 'OWNER' AND w."type" = 'PROFESSIONAL'
      );
  ELSE
    INSERT INTO "master_membership_renewals" ("kind", "subscriptionId", "trainerUserId", "trainerName", "plan", "nextDueAt")
    SELECT 'SUSPENDED', NEW."id", u."id", u."name", NEW."plan"::text, NEW."nextDueAt"
    FROM "users" u WHERE u."id" = NEW."trainerUserId" AND u."platformRole" = 'TRAINER' AND u."status" <> 'SUSPENDED'
      AND EXISTS (
        SELECT 1 FROM "workspace_memberships" m JOIN "workspaces" w ON w."id" = m."workspaceId"
        WHERE m."userId" = u."id" AND m."role" = 'OWNER' AND w."type" = 'PROFESSIONAL'
      );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bm_master_user_suspension
AFTER UPDATE OF "status" ON "users"
FOR EACH ROW EXECUTE FUNCTION bm_capture_master_suspension();

CREATE TRIGGER bm_master_subscription_suspension
AFTER INSERT OR UPDATE OF "status" ON "trainer_subscriptions"
FOR EACH ROW EXECUTE FUNCTION bm_capture_master_suspension();

COMMIT;
