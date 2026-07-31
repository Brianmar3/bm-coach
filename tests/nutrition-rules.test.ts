import assert from "node:assert/strict";
import test from "node:test";
import {
  fallbackMealPlan,
  fallbackPantry,
  fallbackRecipes,
  classifyPantryRecipes,
  normalizeIngredientInput,
  validateMealPlanDiversity,
  nutritionSafetyCategory,
  normalizeNutritionText,
  recipeIsCompatible,
  validateRecipeResult,
} from "../lib/nutrition-rules.ts";
import { nutritionCatalogStats } from "../lib/nutrition-catalog.ts";
import { resolveNutritionActivities, weekdayForDateKey } from "../lib/nutrition-activity.ts";
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
      todayActivities: [],
      relevantActivity: null,
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

test("el catálogo local supera el mínimo de recetas e ingredientes", () => {
  const stats = nutritionCatalogStats();
  assert.ok(stats.recipes >= 80, `recetas: ${stats.recipes}`);
  assert.ok(stats.ingredients >= 100, `ingredientes: ${stats.ingredients}`);
});

test("normaliza frases, plurales, cantidades y sinónimos regionales", () => {
  assert.deepEqual(normalizeIngredientInput("Tengo arroz blanco y dos huevos"), ["arroz", "huevo"]);
  assert.deepEqual(normalizeIngredientInput("papas, zucchini y frijoles").sort(), ["papa", "poroto", "zapallito"]);
});

test("arroz y huevo produce varias opciones cocinables sin exigir condimentos", () => {
  const result = classifyPantryRecipes(context(), "arroz y huevo");
  assert.ok(result.canCookNow.length >= 5);
  assert.ok(result.canCookNow.every((item) => item.missing.length === 0));
  assert.ok(result.canCookNow.some((item) => item.recipe.title === "Arroz con huevo revuelto"));
});

test("una alergia al huevo bloquea todas las recetas con huevo", () => {
  const result = classifyPantryRecipes(context({ allergies: ["huevo"] }), "arroz y huevo");
  assert.ok(result.blockedIngredients.includes("huevo"));
  assert.ok(result.canCookNow.every((item) => !item.recipe.ingredients.some((ingredient) => ingredient.name === "huevo")));
});

test("un plan de siete días respeta mealType y repetición máxima", () => {
  const plan = fallbackMealPlan(context({ budgetPreference: "Económico" }), {
    days: 7,
    meals: ["Almuerzo", "Cena"],
    startDate: "2026-08-03",
    mode: "Variada",
  });
  const diversity = validateMealPlanDiversity(plan.meals);
  assert.equal(plan.meals.length, 14);
  assert.ok(diversity.uniqueRecipes >= 10);
  assert.ok(diversity.maximumRepeat <= 2);
  assert.equal(diversity.valid, true);
});

test("el filtro de comida no propone desayunos como almuerzo", () => {
  const recipes = fallbackRecipes(context(), { mealType: "Almuerzo", limit: 20, seed: "meal-test" });
  assert.ok(recipes.length > 5);
  assert.ok(recipes.every((recipe) => recipe.mealTypes?.includes("almuerzo")));
});

test("presupuesto económico prioriza costos relativos bajos y región argentina", () => {
  const recipes = fallbackRecipes(context({ budgetPreference: "Económico" }), { mealType: "Cena", limit: 8, seed: "budget-test" });
  assert.ok(recipes.every((recipe) => recipe.region === "AR"));
  assert.ok(recipes.slice(0, 5).every((recipe) => recipe.budgetLevel === "VERY_LOW" || recipe.budgetLevel === "LOW"));
});

test("actividad usa solo el horario de hoy y prioriza la próxima ocurrencia", () => {
  assert.equal(weekdayForDateKey("2026-07-31"), "FRIDAY");
  const result = resolveNutritionActivities({
    today: "2026-07-31",
    localTime: "10:00",
    occurrences: [{ name: "Entrenamiento funcional", startTime: "18:00", endTime: "19:00", status: "SCHEDULED" }],
    weeklySchedules: [
      { dayOfWeek: "THURSDAY", startTime: "07:00", endTime: "08:00", classType: "GAP" },
      { dayOfWeek: "FRIDAY", startTime: "18:00", endTime: "19:00", classType: "Entrenamiento funcional" },
    ],
  });
  assert.equal(result.relevantActivity?.name, "Entrenamiento funcional");
  assert.ok(result.activities.every((item) => item.name !== "GAP"));
});
