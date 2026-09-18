CREATE TYPE "TrainerSubscriptionPlan" AS ENUM ('STARTER', 'PRO', 'PREMIUM');
CREATE TYPE "TrainerSubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED');

CREATE TABLE "trainer_subscriptions" (
  "id" TEXT NOT NULL,
  "trainerUserId" TEXT NOT NULL,
  "plan" "TrainerSubscriptionPlan" NOT NULL,
  "status" "TrainerSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL,
  "lastPaidAt" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "nextDueAt" TIMESTAMP(3),
  "notes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "trainer_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "trainer_subscriptions_trainerUserId_key" ON "trainer_subscriptions"("trainerUserId");
CREATE INDEX "trainer_subscriptions_status_nextDueAt_idx" ON "trainer_subscriptions"("status", "nextDueAt");
CREATE INDEX "trainer_subscriptions_plan_idx" ON "trainer_subscriptions"("plan");

ALTER TABLE "trainer_subscriptions"
ADD CONSTRAINT "trainer_subscriptions_trainerUserId_fkey"
FOREIGN KEY ("trainerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
