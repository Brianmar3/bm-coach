import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(new URL("../prisma/migrations/20260801130000_nutrition_conversation_learning/migration.sql", import.meta.url), "utf8");
const assistantService = readFileSync(new URL("../lib/nutrition-ai.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/portal/nutrition/[feature]/route.ts", import.meta.url), "utf8");

test("daily AI usage is unique per student, Argentina date and feature", () => {
  assert.match(schema, /@@unique\(\[studentId, dateKey, feature\]\)/);
  assert.match(migration, /nutrition_ai_usage_nonnegative/);
  assert.match(migration, /nutrition_ai_usage_studentId_dateKey_feature_key/);
});

test("external reservations prevent duplicate and concurrent consumption", () => {
  assert.match(schema, /requestKey\s+String\s+@unique/);
  assert.match(assistantService, /FOR UPDATE/);
  assert.match(assistantService, /isolationLevel: "Serializable"/);
  assert.match(assistantService, /DUPLICATE_REQUEST/);
  assert.match(route, /finalizeNutritionAIReservation\(transaction/);
  assert.ok(route.indexOf("nutritionMessage.createMany") < route.indexOf("finalizeNutritionAIReservation(transaction"));
});

test("assistant and education always derive ownership from the portal session", () => {
  assert.match(route, /const studentId = auth\.session\.studentId/);
  assert.doesNotMatch(route, /studentId\s*=\s*safeText\(input\.studentId/);
  assert.match(route, /where: \{ id: conversationId, studentId \}/);
  assert.match(schema, /model NutritionEducationQuizAttempt[\s\S]*studentId[\s\S]*onDelete: Cascade/);
});
