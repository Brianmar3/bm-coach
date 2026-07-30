CREATE TABLE "nutrition_daily_checkins" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "hydration" BOOLEAN NOT NULL DEFAULT false,
    "protein" BOOLEAN NOT NULL DEFAULT false,
    "fruitsVegetables" BOOLEAN NOT NULL DEFAULT false,
    "mealOrganization" BOOLEAN NOT NULL DEFAULT false,
    "energy" BOOLEAN NOT NULL DEFAULT false,
    "comment" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nutrition_daily_checkins_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "trainer_nutrition_notes" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trainer_nutrition_notes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "nutrition_daily_checkins_studentId_dateKey_key"
ON "nutrition_daily_checkins"("studentId", "dateKey");

CREATE INDEX "nutrition_daily_checkins_studentId_dateKey_idx"
ON "nutrition_daily_checkins"("studentId", "dateKey" DESC);

CREATE INDEX "trainer_nutrition_notes_studentId_createdAt_idx"
ON "trainer_nutrition_notes"("studentId", "createdAt" DESC);

ALTER TABLE "nutrition_daily_checkins"
ADD CONSTRAINT "nutrition_daily_checkins_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "students"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "trainer_nutrition_notes"
ADD CONSTRAINT "trainer_nutrition_notes_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "students"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
