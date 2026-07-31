import assert from "node:assert/strict";
import test from "node:test";
import {
  fallbackMealPlan,
  fallbackPantry,
  fallbackRecipes,
  nutritionSafetyCategory,
  normalizeNutritionText,
  recipeIsCompatible,
  validateRecipeResult,
} from "../lib/nutrition-rules.ts";
import type { NutritionContextSnapshot } from "../types/nutrition-intelligence.ts";

function context(
  overrides: Partial<NutritionContextSnapshot["profile"]> = {},
): NutritionContextSnapshot {
  return {
    today: "2026-07-31",
    localHour: 12,
    student: {
      firstName: "Alumno",
      objective: "Aumentar masa muscular",
      birthDate: "1990-01-01",
      age: 36,
      plan: "3 días",
      serviceType: "MIXED",
      joinedAt: "2025-01-01",
    },
    evaluation: null,
    profile: {
      dietaryType: "",
      allergies: [],
      intolerances: [],
      restrictions: [],
      preferredFoods: [],
      dislikedFoods: [],
      budgetPreference: "",
      cookingTimeMinutes: 30,
      cookingLevel: "Inicial",
      equipment: ["olla", "sartén"],
      servings: 1,
      usualMealTimes: {},
      repetitionPreference: "Moderada",
      varietyPreference: "Equilibrada",
      locale: "es-AR",
      consentAt: null,
      personalizationEnabled: false,
      notificationPreferences: {},
      updatedAt: "2026-07-31T12:00:00.000Z",
      ...overrides,
    },
    training: {
      routineName: "Fuerza",
      routineDays: ["Día 1"],
      scheduledClasses: [],
      recentAttendances: 2,
    },
    habits: {
      daysRegistered: 2,
      compliancePercentage: 70,
      strongestHabit: "Proteína",
      habitToImprove: "Hidratación",
    },
    activePlan: null,
  };
}

test("normaliza mayúsculas, tildes y espacios", () => {
  assert.equal(normalizeNutritionText("  ProteÍNA   Vegetal "), "proteina vegetal");
});

test("deriva consultas clínicas sin generar orientación específica", () => {
  assert.equal(nutritionSafetyCategory("¿Qué medicación cambio si tengo diabetes?"), "PROFESSIONAL_REDIRECT");
  assert.equal(nutritionSafetyCategory("¿Cómo organizo una merienda?"), null);
});

test("bloquea recetas incompatibles con una alergia declarada", () => {
  const recipes = fallbackRecipes(context(), { mealType: "Desayuno", limit: 5 });
  const eggRecipe = recipes.find((item) => item.ingredients.some((ingredient) => ingredient.name === "huevo"));
  assert.ok(eggRecipe);
  assert.equal(recipeIsCompatible(eggRecipe, context({ allergies: ["huevo"] })), false);
  assert.ok(fallbackRecipes(context({ allergies: ["huevo"] }), { limit: 5 }).every((item) => recipeIsCompatible(item, context({ allergies: ["huevo"] }))));
});

test("valida estructuras y rechaza recetas incompletas", () => {
  assert.equal(validateRecipeResult({ title: "Sin ingredientes", steps: ["Mezclar"] }), null);
  assert.ok(validateRecipeResult({
    title: "Ensalada simple",
    ingredients: [
      { name: "tomate", quantity: 1, unit: "unidad", category: "Frutas y verduras" },
      { name: "garbanzos", quantity: 200, unit: "g", category: "Proteínas" },
    ],
    steps: ["Mezclar los ingredientes"],
  }));
});

test("la planificación es estable e idempotente para el mismo contexto", () => {
  const first = fallbackMealPlan(context(), { days: 3, meals: ["Almuerzo"], startDate: "2026-08-01" });
  const second = fallbackMealPlan(context(), { days: 3, meals: ["Almuerzo"], startDate: "2026-08-01" });
  assert.deepEqual(first, second);
  assert.equal(first.meals.length, 3);
});

test("despensa separa recetas según ingredientes faltantes", () => {
  const result = fallbackPantry(context(), ["arroz", "pollo", "zanahoria", "zapallito", "aceite de oliva"]);
  assert.ok(result.canCookNow.some((item) => item.recipe.title.includes("arroz")));
});
