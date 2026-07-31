CREATE TABLE "nutrition_profiles" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "dietaryType" TEXT NOT NULL DEFAULT '',
    "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "intolerances" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "restrictions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredFoods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dislikedFoods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "budgetPreference" TEXT NOT NULL DEFAULT '',
    "cookingTimeMinutes" INTEGER,
    "cookingLevel" TEXT NOT NULL DEFAULT '',
    "equipment" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "servings" INTEGER NOT NULL DEFAULT 1,
    "usualMealTimes" JSONB,
    "repetitionPreference" TEXT NOT NULL DEFAULT '',
    "varietyPreference" TEXT NOT NULL DEFAULT '',
    "locale" TEXT NOT NULL DEFAULT 'es-AR',
    "consentAt" TIMESTAMP(3),
    "personalizationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "notificationPreferences" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "nutrition_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nutrition_recipes" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "servings" INTEGER NOT NULL,
    "preparationMinutes" INTEGER NOT NULL,
    "difficulty" TEXT NOT NULL,
    "ingredients" JSONB NOT NULL,
    "steps" JSONB NOT NULL,
    "equipment" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "substitutions" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rationale" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL,
    "aiModelVersion" TEXT,
    "contextSnapshot" JSONB,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "nutrition_recipes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nutrition_meal_plans" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "configuration" JSONB NOT NULL,
    "meals" JSONB NOT NULL,
    "contextSnapshot" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "nutrition_meal_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nutrition_shopping_lists" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "mealPlanId" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "budgetMode" BOOLEAN NOT NULL DEFAULT false,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "nutrition_shopping_lists_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nutrition_pantry_sessions" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "ingredients" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "nutrition_pantry_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nutrition_favorites" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "nutrition_favorites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nutrition_conversations" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "contextSummary" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "nutrition_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nutrition_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "structuredData" JSONB,
    "safetyCategory" TEXT,
    "modelVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "nutrition_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nutrition_ai_interactions" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "intention" TEXT NOT NULL,
    "contextSnapshot" JSONB,
    "inputSummary" TEXT NOT NULL,
    "outputSummary" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "modelVersion" TEXT,
    "usageMetadata" JSONB,
    "latencyMs" INTEGER,
    "success" BOOLEAN NOT NULL,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "nutrition_ai_interactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nutrition_education_progress" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "nutrition_education_progress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nutrition_analytics_events" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "nutrition_analytics_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "nutrition_profiles_studentId_key" ON "nutrition_profiles"("studentId");
CREATE INDEX "nutrition_profiles_personalizationEnabled_updatedAt_idx" ON "nutrition_profiles"("personalizationEnabled", "updatedAt");
CREATE INDEX "nutrition_recipes_studentId_createdAt_idx" ON "nutrition_recipes"("studentId", "createdAt" DESC);
CREATE INDEX "nutrition_recipes_studentId_isFavorite_updatedAt_idx" ON "nutrition_recipes"("studentId", "isFavorite", "updatedAt" DESC);
CREATE INDEX "nutrition_meal_plans_studentId_active_startDate_idx" ON "nutrition_meal_plans"("studentId", "active", "startDate" DESC);
CREATE INDEX "nutrition_shopping_lists_studentId_status_updatedAt_idx" ON "nutrition_shopping_lists"("studentId", "status", "updatedAt" DESC);
CREATE INDEX "nutrition_shopping_lists_mealPlanId_idx" ON "nutrition_shopping_lists"("mealPlanId");
CREATE INDEX "nutrition_pantry_sessions_studentId_expiresAt_idx" ON "nutrition_pantry_sessions"("studentId", "expiresAt" DESC);
CREATE UNIQUE INDEX "nutrition_favorites_studentId_contentType_contentId_key" ON "nutrition_favorites"("studentId", "contentType", "contentId");
CREATE INDEX "nutrition_favorites_studentId_createdAt_idx" ON "nutrition_favorites"("studentId", "createdAt" DESC);
CREATE INDEX "nutrition_conversations_studentId_updatedAt_idx" ON "nutrition_conversations"("studentId", "updatedAt" DESC);
CREATE INDEX "nutrition_messages_conversationId_createdAt_idx" ON "nutrition_messages"("conversationId", "createdAt");
CREATE INDEX "nutrition_ai_interactions_studentId_createdAt_idx" ON "nutrition_ai_interactions"("studentId", "createdAt" DESC);
CREATE INDEX "nutrition_ai_interactions_feature_success_createdAt_idx" ON "nutrition_ai_interactions"("feature", "success", "createdAt" DESC);
CREATE UNIQUE INDEX "nutrition_education_progress_studentId_contentId_key" ON "nutrition_education_progress"("studentId", "contentId");
CREATE INDEX "nutrition_education_progress_studentId_updatedAt_idx" ON "nutrition_education_progress"("studentId", "updatedAt" DESC);
CREATE INDEX "nutrition_analytics_events_studentId_createdAt_idx" ON "nutrition_analytics_events"("studentId", "createdAt" DESC);
CREATE INDEX "nutrition_analytics_events_event_createdAt_idx" ON "nutrition_analytics_events"("event", "createdAt" DESC);

ALTER TABLE "nutrition_profiles" ADD CONSTRAINT "nutrition_profiles_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nutrition_recipes" ADD CONSTRAINT "nutrition_recipes_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nutrition_meal_plans" ADD CONSTRAINT "nutrition_meal_plans_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nutrition_shopping_lists" ADD CONSTRAINT "nutrition_shopping_lists_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nutrition_shopping_lists" ADD CONSTRAINT "nutrition_shopping_lists_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "nutrition_meal_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "nutrition_pantry_sessions" ADD CONSTRAINT "nutrition_pantry_sessions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nutrition_favorites" ADD CONSTRAINT "nutrition_favorites_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nutrition_conversations" ADD CONSTRAINT "nutrition_conversations_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nutrition_messages" ADD CONSTRAINT "nutrition_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "nutrition_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nutrition_ai_interactions" ADD CONSTRAINT "nutrition_ai_interactions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nutrition_education_progress" ADD CONSTRAINT "nutrition_education_progress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nutrition_analytics_events" ADD CONSTRAINT "nutrition_analytics_events_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
