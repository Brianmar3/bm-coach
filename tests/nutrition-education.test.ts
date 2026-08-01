import assert from "node:assert/strict";
import test from "node:test";
import { educationPriority, NUTRITION_EDUCATION, NUTRITION_EDUCATION_CATEGORIES, quizResult } from "../lib/nutrition-education.ts";

test("offers a developed catalog with every requested category", () => {
  assert.ok(NUTRITION_EDUCATION.length >= 20);
  assert.equal(new Set(NUTRITION_EDUCATION.map((item) => item.id)).size, NUTRITION_EDUCATION.length);
  for (const category of NUTRITION_EDUCATION_CATEGORIES) assert.ok(NUTRITION_EDUCATION.some((item) => item.category === category), category);
  for (const item of NUTRITION_EDUCATION) {
    assert.ok(item.explanation.length >= 2, item.title);
    assert.ok(item.examples.length >= 3, item.title);
    assert.ok(item.mistakes.length >= 3, item.title);
    assert.ok(item.keyPoints.length >= 3, item.title);
    assert.ok(item.application.length > 30, item.title);
    assert.ok(item.challenge.length > 20, item.title);
  }
});

test("prioritizes uncompleted content for the student's objective", () => {
  const muscle = NUTRITION_EDUCATION.find((item) => item.id === "muscle-gain")!;
  const labels = NUTRITION_EDUCATION.find((item) => item.id === "labels")!;
  assert.ok(educationPriority(muscle, "Aumentar masa muscular", false) > educationPriority(labels, "Aumentar masa muscular", false));
  assert.ok(educationPriority(muscle, "Aumentar masa muscular", true) < educationPriority(labels, "Aumentar masa muscular", false));
});

test("validates and explains mini questionnaires", () => {
  assert.deepEqual(quizResult("pre-training-food", "pre-training-1", 1), { correct: true, explanation: "Con poco margen suele convenir una porción pequeña, conocida y baja en grasa." });
  assert.equal(quizResult("pre-training-food", "pre-training-1", 0)?.correct, false);
  assert.equal(quizResult("pre-training-food", "unknown", 1), null);
});
