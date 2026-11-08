BEGIN;

CREATE TABLE "master_email_digests" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "day" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "payload" JSONB NOT NULL,
  "itemCount" INTEGER NOT NULL,
  "firstAttemptAt" TIMESTAMP(3),
  "leaseUntil" TIMESTAMP(3),
  "leaseToken" TEXT,
  "providerId" TEXT,
  "lastError" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "master_email_digest_status" CHECK ("status" IN ('PENDING','SENDING','FAILED','SENT','SKIPPED','REVIEW'))
);
CREATE UNIQUE INDEX "master_email_digests_day_key" ON "master_email_digests"("day");
CREATE INDEX "master_email_digests_status_createdAt_idx" ON "master_email_digests"("status", "createdAt");

CREATE TABLE "master_membership_renewals" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "subscriptionId" TEXT NOT NULL,
  "trainerUserId" TEXT NOT NULL,
  "trainerName" TEXT NOT NULL,
  "plan" TEXT NOT NULL,
  "nextDueAt" TIMESTAMP(3) NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "digestId" TEXT REFERENCES "master_email_digests"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "master_membership_renewals_digestId_occurredAt_idx" ON "master_membership_renewals"("digestId", "occurredAt");

CREATE TABLE "master_email_attempts" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "digestId" TEXT NOT NULL REFERENCES "master_email_digests"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'STARTED',
  "errorCode" TEXT,
  "providerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "master_email_attempt_status" CHECK ("status" IN ('STARTED','FAILED','ACCEPTED'))
);
CREATE INDEX "master_email_attempts_digestId_createdAt_idx" ON "master_email_attempts"("digestId", "createdAt");

-- Capture every supported renewal path atomically with its membership update.
-- No historical backfill and no writes to commercial data or access permissions.
CREATE FUNCTION bm_capture_membership_renewal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."status" = 'ACTIVE'
    AND NEW."nextDueAt" > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
    AND (
      (OLD."nextDueAt" IS NOT NULL AND NEW."nextDueAt" > OLD."nextDueAt")
      OR (NEW."lastPaidAt" IS NOT NULL AND NEW."lastPaidAt" IS DISTINCT FROM OLD."lastPaidAt"
          AND (OLD."lastPaidAt" IS NULL OR NEW."lastPaidAt" > OLD."lastPaidAt"))
    ) THEN
    INSERT INTO "master_membership_renewals" ("subscriptionId", "trainerUserId", "trainerName", "plan", "nextDueAt")
    SELECT NEW."id", NEW."trainerUserId", u."name", NEW."plan"::text, NEW."nextDueAt"
    FROM "users" u WHERE u."id" = NEW."trainerUserId" AND u."platformRole" = 'TRAINER'
      AND EXISTS (
        SELECT 1 FROM "workspace_memberships" m JOIN "workspaces" w ON w."id" = m."workspaceId"
        WHERE m."userId" = u."id" AND m."role" = 'OWNER' AND w."type" = 'PROFESSIONAL'
      );
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER bm_membership_renewal_email
AFTER UPDATE ON "trainer_subscriptions"
FOR EACH ROW EXECUTE FUNCTION bm_capture_membership_renewal();

COMMIT;
