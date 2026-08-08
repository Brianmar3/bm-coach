CREATE TYPE "EvaluationStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'REASSESSMENT_RECOMMENDED');

ALTER TABLE "physical_evaluations"
ADD COLUMN "version" INTEGER,
ADD COLUMN "status" "EvaluationStatus" NOT NULL DEFAULT 'COMPLETED',
ADD COLUMN "currentStep" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "completionPercentage" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN "creationKey" TEXT,
ADD COLUMN "trainerName" TEXT NOT NULL DEFAULT 'Entrenador',
ADD COLUMN "primaryGoal" TEXT NOT NULL DEFAULT '',
ADD COLUMN "secondaryGoals" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "experienceLevel" TEXT NOT NULL DEFAULT '',
ADD COLUMN "weeklyAvailability" TEXT NOT NULL DEFAULT '',
ADD COLUMN "generalData" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "habits" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "trainingObservations" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "trainerNotes" TEXT NOT NULL DEFAULT '',
ADD COLUMN "finalStrengths" TEXT NOT NULL DEFAULT '',
ADD COLUMN "finalPriorities" TEXT NOT NULL DEFAULT '',
ADD COLUMN "finalLimitations" TEXT NOT NULL DEFAULT '',
ADD COLUMN "planningNotes" TEXT NOT NULL DEFAULT '',
ADD COLUMN "finalComment" TEXT NOT NULL DEFAULT '',
ADD COLUMN "reassessmentDate" DATE,
ADD COLUMN "completedAt" TIMESTAMP(3);

WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "studentId" ORDER BY "date" ASC, "createdAt" ASC, "id" ASC
  ) AS row_number
  FROM "physical_evaluations"
)
UPDATE "physical_evaluations" AS evaluation
SET "version" = numbered.row_number::INTEGER
FROM numbered
WHERE evaluation."id" = numbered."id";

ALTER TABLE "physical_evaluations"
ALTER COLUMN "version" SET NOT NULL,
ALTER COLUMN "version" SET DEFAULT 1;

CREATE UNIQUE INDEX "physical_evaluations_creationKey_key" ON "physical_evaluations"("creationKey");
CREATE UNIQUE INDEX "physical_evaluations_studentId_version_key" ON "physical_evaluations"("studentId", "version");
CREATE INDEX "physical_evaluations_studentId_status_date_idx" ON "physical_evaluations"("studentId", "status", "date");
CREATE INDEX "physical_evaluations_status_idx" ON "physical_evaluations"("status");

CREATE TABLE "evaluation_measurements" (
  "id" TEXT NOT NULL,
  "evaluationId" TEXT NOT NULL,
  "measurementType" TEXT NOT NULL,
  "side" TEXT,
  "value" DECIMAL(8,2) NOT NULL,
  "unit" TEXT NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "evaluation_measurements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evaluation_body_issues" (
  "id" TEXT NOT NULL,
  "evaluationId" TEXT NOT NULL,
  "bodyZone" TEXT NOT NULL,
  "side" TEXT NOT NULL,
  "intensity" INTEGER,
  "hasPain" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'NOT_SPECIFIED',
  "studentDescription" TEXT NOT NULL DEFAULT '',
  "trainerObservation" TEXT NOT NULL DEFAULT '',
  "approximateDate" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "evaluation_body_issues_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evaluation_test_results" (
  "id" TEXT NOT NULL,
  "evaluationId" TEXT NOT NULL,
  "testKey" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NOT_PERFORMED',
  "numericValue" DECIMAL(10,2),
  "unit" TEXT NOT NULL DEFAULT '',
  "rightValue" DECIMAL(10,2),
  "leftValue" DECIMAL(10,2),
  "rightUnit" TEXT NOT NULL DEFAULT '',
  "leftUnit" TEXT NOT NULL DEFAULT '',
  "pain" BOOLEAN NOT NULL DEFAULT false,
  "rightPain" BOOLEAN NOT NULL DEFAULT false,
  "leftPain" BOOLEAN NOT NULL DEFAULT false,
  "protocol" TEXT NOT NULL DEFAULT '',
  "variation" TEXT NOT NULL DEFAULT '',
  "observations" TEXT NOT NULL DEFAULT '',
  "compensations" TEXT NOT NULL DEFAULT '',
  "notPerformedReason" TEXT NOT NULL DEFAULT '',
  "rawResult" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "evaluation_test_results_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "evaluation_measurements_evaluationId_measurementType_side_key" ON "evaluation_measurements"("evaluationId", "measurementType", "side");
CREATE INDEX "evaluation_measurements_evaluationId_idx" ON "evaluation_measurements"("evaluationId");
CREATE INDEX "evaluation_body_issues_evaluationId_idx" ON "evaluation_body_issues"("evaluationId");
CREATE UNIQUE INDEX "evaluation_test_results_evaluationId_testKey_category_key" ON "evaluation_test_results"("evaluationId", "testKey", "category");
CREATE INDEX "evaluation_test_results_evaluationId_category_idx" ON "evaluation_test_results"("evaluationId", "category");

ALTER TABLE "evaluation_measurements" ADD CONSTRAINT "evaluation_measurements_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "physical_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evaluation_body_issues" ADD CONSTRAINT "evaluation_body_issues_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "physical_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evaluation_test_results" ADD CONSTRAINT "evaluation_test_results_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "physical_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
