import {
  INGREDIENT_CATALOG,
  NUTRITION_RECIPE_CATALOG,
  type NutritionBudgetLevel,
} from "./nutrition-catalog.ts";
import type {
  NutritionContextSnapshot,
  NutritionPlanMeal,
  NutritionRecipeResult,
  NutritionShoppingItem,
} from "../types/nutrition-intelligence.ts";

const CLINICAL_PATTERNS = [
  /diabetes/i,
  /embaraz/i,
  /renal/i,
  /medicaci/i,
  /trastorno aliment/i,
  /anorex/i,
  /bulimi/i,
  /vomit/i,
  /purg/i,
  /ayuno extremo/i,
  /bajar .*r[aá]pid/i,
  /alergia grave/i,
  /emergencia/i,
  /dolor (?:de pecho|fuerte)/i,
  /desmay/i,
  /dificultad para respirar/i,
  /sangr/i,
  /s[ií]ntoma/i,
  /enfermedad/i,
  /insuficiencia/i,
  /dosis/i,
  /quemador/i,
  /suplemento.*dosis/i,
];

const BASIC_PANTRY = new Set([
  "agua",
  "sal",
  "pimienta",
  "aceite",
  "vinagre",
  "oregano",
  "pimenton",
  "comino",
  "canela",
]);

const SUBSTITUTION_GROUPS = [
  ["lenteja", "garbanzo", "poroto", "arveja"],
  ["pollo", "carne de pollo desmenuzada"],
  ["leche", "leche vegetal", "yogur"],
  ["papa", "batata", "pure de papa", "pure de zapallo"],
  ["zapallito", "berenjena", "zapallo"],
  ["merluza", "atun", "caballa", "sardina"],
  ["pan", "tortilla de trigo", "tortilla de maiz"],
];

const BUDGET_ORDER: Record<NutritionBudgetLevel, number> = {
  VERY_LOW: 0,
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
};

export const PROFESSIONAL_REDIRECT =
  "Este tema necesita una evaluación profesional. Puedo ayudarte con orientación general, pero no reemplazar una consulta con un nutricionista o profesional de salud.";

export function normalizeNutritionText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-AR")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ingredientAliases = INGREDIENT_CATALOG.flatMap((ingredient) =>
  [ingredient.name, ...ingredient.aliases].map((alias) => ({
    alias: normalizeNutritionText(alias),
    canonical: ingredient.name,
  })),
).sort((left, right) => right.alias.length - left.alias.length);

export function canonicalIngredient(value: string) {
  const normalized = normalizeNutritionText(value)
    .replace(/\b(?:tengo|hay|me queda|quedo|quedan|un|una|unos|unas|dos|tres|cuatro|cocido|cocida|cocidos|cocidas)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const exact = ingredientAliases.find((item) => item.alias === normalized);
  if (exact) return exact.canonical;
  const contained = ingredientAliases.find((item) =>
    new RegExp(`(?:^|\\s)${item.alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|\\s)`).test(normalized),
  );
  return contained?.canonical ?? normalized;
}

export function normalizeIngredientInput(value: string | string[]) {
  const text = Array.isArray(value) ? value.join(", ") : value;
  const normalized = normalizeNutritionText(text);
  const found: string[] = [];
  for (const item of ingredientAliases) {
    if (!item.alias) continue;
    const pattern = new RegExp(
      `(?:^|\\s)${item.alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|\\s)`,
    );
    if (pattern.test(normalized) && !found.includes(item.canonical)) {
      found.push(item.canonical);
    }
  }
  if (found.length) return found;
  return text
    .split(/,|\by\b|\n/gi)
    .map(canonicalIngredient)
    .filter(Boolean);
}

export function nutritionSafetyCategory(value: string) {
  return CLINICAL_PATTERNS.some((pattern) => pattern.test(value))
    ? "PROFESSIONAL_REDIRECT"
    : null;
}

export function stringList(value: unknown, limit = 20) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item) => {
    if (typeof item !== "string") return [];
    const clean = item.trim().replace(/\s+/g, " ").slice(0, 80);
    return clean ? [clean] : [];
  }))].slice(0, limit);
}

export function safeText(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";
}

export function safeInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
) {
  const number = Number(value);
  return Number.isInteger(number) && number >= minimum && number <= maximum
    ? number
    : fallback;
}

function contextRestrictions(context: NutritionContextSnapshot) {
  return [
    ...context.profile.allergies,
    ...context.profile.intolerances,
    ...context.profile.restrictions,
    ...context.profile.dislikedFoods,
  ].map(canonicalIngredient).filter(Boolean);
}

function vegetarianProfile(context: NutritionContextSnapshot) {
  const value = normalizeNutritionText(
    `${context.profile.dietaryType} ${context.profile.restrictions.join(" ")}`,
  );
  return /vegetarian|vegano/.test(value);
}

export function recipeIsCompatible(
  recipe: NutritionRecipeResult,
  context: NutritionContextSnapshot,
) {
  const blocked = contextRestrictions(context);
  const animalProteins = new Set([
    "pollo",
    "carne de pollo desmenuzada",
    "carne vacuna",
    "cerdo",
    "merluza",
    "atun",
    "caballa",
    "sardina",
    "jamon cocido",
  ]);
  return recipe.ingredients.every((item) => {
    const canonical = canonicalIngredient(item.name);
    if (vegetarianProfile(context) && animalProteins.has(normalizeNutritionText(canonical))) return false;
    return blocked.every((value) => {
      const normalizedBlocked = normalizeNutritionText(value);
      const normalizedIngredient = normalizeNutritionText(canonical);
      return normalizedIngredient !== normalizedBlocked &&
        !normalizedIngredient.includes(normalizedBlocked) &&
        !normalizedBlocked.includes(normalizedIngredient);
    });
  });
}

export function objectiveLabel(objective: string) {
  const normalized = normalizeNutritionText(objective);
  if (/masa|muscul|aument|ganar/.test(normalized)) return "Aumentar masa muscular";
  if (/grasa|bajar|descenso|adelgaz/.test(normalized)) return "Bajar grasa";
  if (/rend|deport|compet|fuerza/.test(normalized)) return "Mejorar rendimiento";
  if (/mantener|mantenimiento/.test(normalized)) return "Mantener";
  return objective.trim() || "Mejorar hábitos";
}

function budgetFrom(value: string): NutritionBudgetLevel | null {
  const normalized = normalizeNutritionText(value);
  if (/muy econom|economico|economica|bajo/.test(normalized)) return "LOW";
  if (/moderad/.test(normalized)) return "MODERATE";
  if (/flexible|alto|sin limite/.test(normalized)) return "HIGH";
  return null;
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function recipeId(recipe: NutritionRecipeResult) {
  return recipe.id ?? recipe.tags.find((tag) => tag.startsWith("catalog:"))?.slice(8) ?? normalizeNutritionText(recipe.title).replace(/\s+/g, "-");
}

function mealTypeMatches(recipe: NutritionRecipeResult, mealType: string) {
  const desired = normalizeNutritionText(mealType);
  if (!desired) return true;
  return (recipe.mealTypes ?? recipe.tags).some((item) =>
    normalizeNutritionText(item) === desired,
  );
}

export type RecipeSelectionInput = {
  mealType?: string;
  tags?: string[];
  limit?: number;
  search?: string;
  ingredient?: string;
  budget?: string;
  maxMinutes?: number;
  seed?: string;
  recentRecipeIds?: string[];
  rejectedRecipeIds?: string[];
  acceptedRecipeIds?: string[];
  candidates?: NutritionRecipeResult[];
};

export function fallbackRecipes(
  context: NutritionContextSnapshot,
  input: RecipeSelectionInput,
) {
  const desiredTags = stringList(input.tags, 10).map(normalizeNutritionText);
  const search = normalizeNutritionText(input.search ?? "");
  const desiredIngredient = input.ingredient
    ? canonicalIngredient(input.ingredient)
    : "";
  const budget = budgetFrom(input.budget || context.profile.budgetPreference);
  const recent = new Set(stringList(input.recentRecipeIds, 100));
  const rejected = new Set(stringList(input.rejectedRecipeIds, 100));
  const accepted = new Set(stringList(input.acceptedRecipeIds, 100));
  const seed = input.seed || `${context.today}:${context.localHour}`;
  const maxMinutes = Number(input.maxMinutes) || context.profile.cookingTimeMinutes || 240;

  const candidates = (input.candidates ?? NUTRITION_RECIPE_CATALOG).filter((recipe) => {
    const id = recipeId(recipe);
    if (rejected.has(id) || !recipeIsCompatible(recipe, context)) return false;
    if (!mealTypeMatches(recipe, input.mealType ?? "")) return false;
    if (recipe.preparationMinutes > maxMinutes) return false;
    if (search) {
      const searchable = normalizeNutritionText(
        `${recipe.title} ${recipe.ingredients.map((item) => item.name).join(" ")} ${recipe.tags.join(" ")}`,
      );
      if (!searchable.includes(search)) return false;
    }
    if (desiredIngredient && !recipe.ingredients.some((item) => canonicalIngredient(item.name) === desiredIngredient)) return false;
    return true;
  });

  const scored = candidates.map((recipe) => {
    const id = recipeId(recipe);
    let score = 20;
    score += desiredTags.reduce((sum, tag) =>
      sum + (recipe.tags.some((item) => normalizeNutritionText(item).includes(tag)) ? 8 : 0), 0);
    if (budget && recipe.budgetLevel) {
      const difference = BUDGET_ORDER[recipe.budgetLevel] - BUDGET_ORDER[budget];
      score += difference <= 0 ? 8 : -difference * 12;
    }
    if (recent.has(id) && !accepted.has(id)) score -= 100;
    if (accepted.has(id)) score += 12;
    if (context.profile.preferredFoods.some((food) =>
      recipe.ingredients.some((item) => canonicalIngredient(item.name) === canonicalIngredient(food)))) score += 6;
    score += (stableHash(`${seed}:${id}`) % 1000) / 1000;
    return { recipe, score };
  }).sort((left, right) => right.score - left.score || left.recipe.title.localeCompare(right.recipe.title, "es"));

  const limit = Math.max(1, Math.min(input.limit ?? 4, 20));
  const preferred = scored.filter((item) => item.score > -50);
  const pool = preferred.length >= limit ? preferred : scored;
  return pool.slice(0, limit).map(({ recipe }) => ({
    ...recipe,
    rationale: `${recipe.rationale} Orientación alineada con tu objetivo: ${objectiveLabel(context.student.objective)}.`,
  }));
}

function availableReplacement(missing: string, pantry: Set<string>) {
  const normalizedMissing = normalizeNutritionText(missing);
  const group = SUBSTITUTION_GROUPS.find((items) =>
    items.map(normalizeNutritionText).includes(normalizedMissing),
  );
  if (!group) return null;
  return group.find((item) => pantry.has(canonicalIngredient(item))) ?? null;
}

export type PantryRecipeMatch = {
  recipe: NutritionRecipeResult;
  missing: string[];
  replacements?: Array<{ ingredient: string; replacement: string }>;
  matchRatio?: number;
};

export function classifyPantryRecipes(
  context: NutritionContextSnapshot,
  pantryInput: string | string[],
  recipes = NUTRITION_RECIPE_CATALOG,
) {
  const available = normalizeIngredientInput(pantryInput);
  const pantry = new Set(available.map(canonicalIngredient));
  const blockedAvailable = available.filter((item) =>
    contextRestrictions(context).includes(canonicalIngredient(item)),
  );
  const results = recipes.filter((recipe) => recipeIsCompatible(recipe, context)).map((recipe) => {
    const essential = (recipe.essentialIngredients?.length
      ? recipe.essentialIngredients
      : recipe.ingredients.filter((item) => !item.optional).map((item) => item.name))
      .map(canonicalIngredient)
      .filter((item) => !BASIC_PANTRY.has(normalizeNutritionText(item)));
    const missing = essential.filter((item) => !pantry.has(item));
    const replacements = missing.flatMap((item) => {
      const replacement = availableReplacement(item, pantry);
      return replacement ? [{ ingredient: item, replacement }] : [];
    });
    const matched = essential.length - missing.length;
    return {
      recipe,
      missing,
      replacements,
      matchRatio: essential.length ? matched / essential.length : 1,
    };
  }).sort((left, right) =>
    right.matchRatio - left.matchRatio ||
    left.missing.length - right.missing.length ||
    (left.recipe.budgetLevel ? BUDGET_ORDER[left.recipe.budgetLevel] : 9) - (right.recipe.budgetLevel ? BUDGET_ORDER[right.recipe.budgetLevel] : 9) ||
    left.recipe.preparationMinutes - right.recipe.preparationMinutes,
  );
  return {
    normalizedIngredients: available,
    blockedIngredients: blockedAvailable,
    canCookNow: results.filter((item) => item.missing.length === 0).slice(0, 8),
    missingOne: results.filter((item) => item.missing.length === 1 && item.replacements.length === 0).slice(0, 8),
    alternatives: results.filter((item) => item.missing.length > 0 && item.missing.length === item.replacements.length).slice(0, 8),
  };
}

export function fallbackPantry(
  context: NutritionContextSnapshot,
  pantryIngredients: string[] | string,
) {
  return classifyPantryRecipes(context, pantryIngredients);
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function fallbackMealPlan(
  context: NutritionContextSnapshot,
  input: RecipeSelectionInput & { days?: number; meals?: string[]; startDate?: string; mode?: string },
) {
  const days = safeInteger(input.days, 1, 7, 7);
  const selectedMeals = stringList(input.meals, 6).length
    ? stringList(input.meals, 6)
    : ["Almuerzo", "Cena"];
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(input.startDate ?? "")
    ? input.startDate!
    : context.today;
  const maxRepeats = normalizeNutritionText(input.mode ?? "").includes("pocas recetas") ? 2 : 1;
  const counts = new Map<string, number>();
  const proteinLastUsed = new Map<string, number>();
  const methodLastUsed = new Map<string, number>();
  const meals: NutritionPlanMeal[] = [];
  const selectedRecipes = new Map<string, NutritionRecipeResult>();

  for (let day = 0; day < days; day += 1) {
    for (let position = 0; position < selectedMeals.length; position += 1) {
      const mealType = selectedMeals[position];
      const candidates = fallbackRecipes(context, {
        ...input,
        mealType,
        limit: 20,
        seed: `${input.seed ?? startDate}:${day}:${position}`,
      }).filter((recipe) => (counts.get(recipeId(recipe)) ?? 0) < maxRepeats);
      const pool = candidates.length ? candidates : fallbackRecipes(context, { ...input, mealType, limit: 20 });
      const recipe = [...pool].sort((left, right) => {
        const leftProtein = proteinLastUsed.get(left.mainProtein ?? "") ?? -10;
        const rightProtein = proteinLastUsed.get(right.mainProtein ?? "") ?? -10;
        const leftMethod = methodLastUsed.get(left.cookingMethod ?? "") ?? -10;
        const rightMethod = methodLastUsed.get(right.cookingMethod ?? "") ?? -10;
        return (leftProtein + leftMethod) - (rightProtein + rightMethod) ||
          stableHash(`${startDate}:${day}:${position}:${recipeId(left)}`) - stableHash(`${startDate}:${day}:${position}:${recipeId(right)}`);
      })[0];
      if (!recipe) continue;
      const id = recipeId(recipe);
      selectedRecipes.set(id, recipe);
      counts.set(id, (counts.get(id) ?? 0) + 1);
      proteinLastUsed.set(recipe.mainProtein ?? "", day * selectedMeals.length + position);
      methodLastUsed.set(recipe.cookingMethod ?? "", day * selectedMeals.length + position);
      meals.push({
        id: `${day}-${position}-${normalizeNutritionText(mealType).replace(/\s/g, "-")}`,
        dateKey: addDays(startDate, day),
        mealType,
        title: recipe.title,
        suggestedTime: context.profile.usualMealTimes[mealType.toLocaleLowerCase("es-AR")] ?? "",
        relationToTraining: context.training.todayActivities.length
          ? "Organizada para acompañar tu actividad y facilitar la recuperación."
          : "Organizada según tu objetivo, presupuesto y hábitos.",
        status: "PLANNED",
      });
    }
  }
  return {
    startDate,
    endDate: addDays(startDate, days - 1),
    meals,
    recipes: [...selectedRecipes.values()],
  };
}

export function validateMealPlanDiversity(meals: NutritionPlanMeal[]) {
  const counts = new Map<string, number>();
  for (const meal of meals) counts.set(meal.title, (counts.get(meal.title) ?? 0) + 1);
  const maximumRepeat = Math.max(0, ...counts.values());
  return {
    uniqueRecipes: counts.size,
    maximumRepeat,
    valid: meals.every((meal) => meal.mealType && meal.title) && maximumRepeat <= 2,
  };
}

export function shoppingItemsFromRecipes(
  recipes: NutritionRecipeResult[],
): NutritionShoppingItem[] {
  const grouped = new Map<string, NutritionShoppingItem>();
  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients.filter((item) => !item.optional)) {
      const key = `${canonicalIngredient(ingredient.name)}|${normalizeNutritionText(ingredient.unit)}`;
      const current = grouped.get(key);
      if (current && current.quantity !== null && ingredient.quantity !== null) {
        current.quantity += ingredient.quantity;
      } else if (!current) {
        grouped.set(key, {
          ...ingredient,
          id: `item-${grouped.size + 1}-${canonicalIngredient(ingredient.name).replace(/\s/g, "-")}`,
          checked: false,
        });
      }
    }
  }
  return [...grouped.values()].sort(
    (left, right) =>
      left.category.localeCompare(right.category, "es") ||
      left.name.localeCompare(right.name, "es"),
  );
}

export function validateRecipeResult(value: unknown): NutritionRecipeResult | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const title = safeText(record.title, 120);
  const description = safeText(record.description, 400);
  const rawIngredients = Array.isArray(record.ingredients) ? record.ingredients : [];
  const ingredients = rawIngredients.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const ingredientRecord = item as Record<string, unknown>;
    const name = safeText(ingredientRecord.name, 80);
    if (!name) return [];
    const quantityValue = Number(ingredientRecord.quantity);
    return [{
      name: canonicalIngredient(name),
      quantity: Number.isFinite(quantityValue) && quantityValue >= 0 ? quantityValue : null,
      unit: safeText(ingredientRecord.unit, 30),
      category: safeText(ingredientRecord.category, 50) || "Otros",
      optional: ingredientRecord.optional === true,
    }];
  }).slice(0, 30);
  const steps = stringList(record.steps, 20);
  if (!title || ingredients.length < 2 || !steps.length) return null;
  const budget = safeText(record.budgetLevel, 20);
  const budgetLevel = (["VERY_LOW", "LOW", "MODERATE", "HIGH"] as const).find((item) => item === budget);
  return {
    id: safeText(record.id, 100) || undefined,
    title,
    description,
    servings: safeInteger(record.servings, 1, 12, 1),
    preparationMinutes: safeInteger(record.preparationMinutes, 1, 240, 20),
    difficulty: record.difficulty === "Intermedia" ? "Intermedia" : "Fácil",
    ingredients,
    essentialIngredients: stringList(record.essentialIngredients, 30).map(canonicalIngredient),
    optionalIngredients: stringList(record.optionalIngredients, 30).map(canonicalIngredient),
    steps,
    equipment: stringList(record.equipment, 12),
    substitutions: Array.isArray(record.substitutions)
      ? record.substitutions.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const source = item as Record<string, unknown>;
          const ingredientName = safeText(source.ingredient, 80);
          const replacement = safeText(source.replacement, 100);
          return ingredientName && replacement ? [{ ingredient: canonicalIngredient(ingredientName), replacement: canonicalIngredient(replacement) }] : [];
        }).slice(0, 12)
      : [],
    rationale: safeText(record.rationale, 300),
    warnings: stringList(record.warnings, 8),
    tags: stringList(record.tags, 20),
    mealTypes: stringList(record.mealTypes, 8),
    budgetLevel,
    region: safeText(record.region, 20) || "AR",
    objectiveTags: stringList(record.objectiveTags, 8),
    trainingTags: stringList(record.trainingTags, 8),
    mainProtein: safeText(record.mainProtein, 50),
    cookingMethod: safeText(record.cookingMethod, 50),
    reusable: record.reusable === true,
  };
}
