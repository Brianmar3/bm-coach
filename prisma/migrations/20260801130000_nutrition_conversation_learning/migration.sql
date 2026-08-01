ALTER TABLE "nutrition_education_progress"
ADD COLUMN "lastSection" TEXT NOT NULL DEFAULT '';

CREATE TABLE "nutrition_education_quiz_attempts" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "contentId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "selectedAnswer" INTEGER NOT NULL,
  "correct" BOOLEAN NOT NULL,
  "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "nutrition_education_quiz_attempts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nutrition_ai_usage" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "dateKey" TEXT NOT NULL,
  "feature" TEXT NOT NULL,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "reservedCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "nutrition_ai_usage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "nutrition_ai_usage_nonnegative" CHECK ("usedCount" >= 0 AND "reservedCount" >= 0)
);

CREATE TABLE "nutrition_ai_requests" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "requestKey" TEXT NOT NULL,
  "dateKey" TEXT NOT NULL,
  "feature" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "conversationId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "nutrition_ai_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "nutrition_education_quiz_attempts_studentId_contentId_answeredAt_idx" ON "nutrition_education_quiz_attempts"("studentId", "contentId", "answeredAt" DESC);
CREATE UNIQUE INDEX "nutrition_ai_usage_studentId_dateKey_feature_key" ON "nutrition_ai_usage"("studentId", "dateKey", "feature");
CREATE INDEX "nutrition_ai_usage_dateKey_feature_idx" ON "nutrition_ai_usage"("dateKey", "feature");
CREATE UNIQUE INDEX "nutrition_ai_requests_requestKey_key" ON "nutrition_ai_requests"("requestKey");
CREATE INDEX "nutrition_ai_requests_studentId_dateKey_feature_status_idx" ON "nutrition_ai_requests"("studentId", "dateKey", "feature", "status");
CREATE INDEX "nutrition_ai_requests_status_expiresAt_idx" ON "nutrition_ai_requests"("status", "expiresAt");

ALTER TABLE "nutrition_education_quiz_attempts" ADD CONSTRAINT "nutrition_education_quiz_attempts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nutrition_ai_usage" ADD CONSTRAINT "nutrition_ai_usage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nutrition_ai_requests" ADD CONSTRAINT "nutrition_ai_requests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
