CREATE TABLE "platform_settings" (
  "id" TEXT NOT NULL DEFAULT 'main',
  "platformName" TEXT NOT NULL DEFAULT 'BM Training',
  "supportEmail" TEXT NOT NULL DEFAULT '',
  "invitationDays" INTEGER NOT NULL DEFAULT 7,
  "defaultTrainerPlan" "TrainerSubscriptionPlan" NOT NULL DEFAULT 'STARTER',
  "initialPeriodMonths" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);
