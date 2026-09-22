ALTER TYPE "TrainerSubscriptionPlan" ADD VALUE 'FREE' BEFORE 'STARTER';

ALTER TABLE "trainer_subscriptions"
ADD COLUMN "trialEndsAt" TIMESTAMP(3);

CREATE TABLE "trainer_password_reset_tokens" (
    "id" TEXT NOT NULL,
    "trainerUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "trainer_password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "trainer_password_reset_tokens_tokenHash_key"
ON "trainer_password_reset_tokens"("tokenHash");

CREATE INDEX "trainer_password_reset_tokens_trainerUserId_expiresAt_idx"
ON "trainer_password_reset_tokens"("trainerUserId", "expiresAt");

ALTER TABLE "trainer_password_reset_tokens"
ADD CONSTRAINT "trainer_password_reset_tokens_trainerUserId_fkey"
FOREIGN KEY ("trainerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
