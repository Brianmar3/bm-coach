CREATE TYPE "PlatformRole" AS ENUM ('TRAINER', 'PLATFORM_OWNER');
CREATE TYPE "TrainerServiceType" AS ENUM ('CLASSES', 'PERSONALIZED', 'MIXED', 'ONLINE');
CREATE TYPE "TrainerInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

ALTER TABLE "users"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "brandName" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "serviceType" "TrainerServiceType",
  ADD COLUMN "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "platformRole" "PlatformRole" NOT NULL DEFAULT 'TRAINER';

DO $$
DECLARE initial_owner_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO initial_owner_count
  FROM "workspace_memberships" membership
  JOIN "workspaces" workspace ON workspace."id" = membership."workspaceId"
  JOIN "users" account ON account."id" = membership."userId"
  WHERE workspace."slug" = 'bm-fuerza-funcional'
    AND membership."role" = 'OWNER'
    AND membership."status" = 'ACTIVE'
    AND workspace."status" = 'ACTIVE'
    AND account."status" = 'ACTIVE';

  IF initial_owner_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one active owner for the initial BM workspace, found %', initial_owner_count;
  END IF;
END $$;

UPDATE "users" AS account
SET "platformRole" = 'PLATFORM_OWNER',
    "onboardingCompleted" = true
FROM "workspace_memberships" AS membership
JOIN "workspaces" AS workspace ON workspace."id" = membership."workspaceId"
WHERE account."id" = membership."userId"
  AND workspace."slug" = 'bm-fuerza-funcional'
  AND membership."role" = 'OWNER'
  AND membership."status" = 'ACTIVE';

CREATE TABLE "trainer_invitations" (
  "id" TEXT NOT NULL,
  "inviterId" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "brandName" TEXT,
  "tokenHash" TEXT NOT NULL,
  "status" "TrainerInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "trainer_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "trainer_invitations_tokenHash_key" ON "trainer_invitations"("tokenHash");
CREATE INDEX "trainer_invitations_email_idx" ON "trainer_invitations"("email");
CREATE INDEX "trainer_invitations_status_expiresAt_idx" ON "trainer_invitations"("status", "expiresAt");
ALTER TABLE "trainer_invitations" ADD CONSTRAINT "trainer_invitations_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
