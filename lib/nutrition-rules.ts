import type {
  NutritionContextSnapshot,
  NutritionIngredient,
  NutritionPlanMeal,
  NutritionRecipeResult,
  NutritionShoppingItem,
} from "@/types/nutrition-intelligence";

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
  /suplemento.*dosis/i,
];

export const PROFESSIONAL_REDIRECT =
  "Este tema necesita una evaluación profesional. Puedo ayudarte con orientación general, pero no reemplazar una consulta con un nutricionista o profesional de salud.";

export function normalizeNutritionText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();
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

function ingredient(
  name: string,
  quantity: number | null,
  unit: string,
  category: string,
): NutritionIngredient {
  return { name, quantity, unit, category };
}

const RECIPE_LIBRARY: NutritionRecipeResult[] = [
  {
    title: "Bowl de arroz, pollo y vegetales",
    description: "Una comida completa y fácil de preparar con ingredientes cotidianos.",
    servings: 1,
    preparationMinutes: 30,
    difficulty: "Fácil",
    ingredients: [
      ingredient("arroz", 80, "g", "Cereales y legumbres"),
      ingredient("pollo", 150, "g", "Proteínas"),
      ingredient("zanahoria", 1, "unidad", "Frutas y verduras"),
      ingredient("zapallito", 1, "unidad", "Frutas y verduras"),
      ingredient("aceite de oliva", 1, "cucharada", "Almacén"),
    ],
    steps: [
      "Cociná el arroz hasta que quede tierno.",
      "Cociná el pollo en una sartén y agregá los vegetales cortados.",
      "Serví todo en un bowl y condimentá a gusto.",
    ],
    equipment: ["olla", "sartén"],
    substitutions: [
      { ingredient: "pollo", replacement: "lentejas cocidas o tofu" },
      { ingredient: "arroz", replacement: "papa o fideos" },
    ],
    rationale: "Combina una fuente de proteína, carbohidratos y vegetales.",
    warnings: [],
    tags: ["almuerzo", "cena", "postentrenamiento"],
  },
  {
    title: "Tostadas con huevo y tomate",
    description: "Una opción rápida para desayuno, merienda o comida liviana.",
    servings: 1,
    preparationMinutes: 12,
    difficulty: "Fácil",
    ingredients: [
      ingredient("pan integral", 2, "rebanadas", "Cereales y legumbres"),
      ingredient("huevo", 2, "unidades", "Proteínas"),
      ingredient("tomate", 1, "unidad", "Frutas y verduras"),
      ingredient("aceite de oliva", 1, "cucharadita", "Almacén"),
    ],
    steps: [
      "Tostá el pan.",
      "Cociná los huevos de la forma que prefieras.",
      "Serví con tomate y condimentá.",
    ],
    equipment: ["sartén", "tostadora"],
    substitutions: [
      { ingredient: "huevo", replacement: "hummus o tofu revuelto" },
      { ingredient: "pan integral", replacement: "tortilla de maíz o papa cocida" },
    ],
    rationale: "Es práctica y aporta energía junto con una fuente de proteína.",
    warnings: [],
    tags: ["desayuno", "merienda", "rápido", "preentrenamiento"],
  },
  {
    title: "Guiso rápido de lentejas",
    description: "Una preparación rendidora, económica y fácil de reutilizar.",
    servings: 2,
    preparationMinutes: 35,
    difficulty: "Fácil",
    ingredients: [
      ingredient("lentejas cocidas", 400, "g", "Cereales y legumbres"),
      ingredient("cebolla", 1, "unidad", "Frutas y verduras"),
      ingredient("zanahoria", 1, "unidad", "Frutas y verduras"),
      ingredient("tomate triturado", 250, "ml", "Almacén"),
      ingredient("arroz", 100, "g", "Cereales y legumbres"),
    ],
    steps: [
      "Rehogá cebolla y zanahoria.",
      "Agregá tomate, lentejas y un poco de agua.",
      "Cociná hasta integrar y serví con arroz.",
    ],
    equipment: ["olla"],
    substitutions: [
      { ingredient: "lentejas cocidas", replacement: "garbanzos o porotos" },
      { ingredient: "arroz", replacement: "papa" },
    ],
    rationale: "Usa alimentos rendidores y combina legumbres con cereales.",
    warnings: [],
    tags: ["almuerzo", "cena", "económico", "preparación anticipada"],
  },
  {
    title: "Avena nocturna con fruta",
    description: "Se prepara con anticipación y queda lista para llevar.",
    servings: 1,
    preparationMinutes: 8,
    difficulty: "Fácil",
    ingredients: [
      ingredient("avena", 50, "g", "Cereales y legumbres"),
      ingredient("leche o bebida vegetal", 180, "ml", "Lácteos"),
      ingredient("banana", 1, "unidad", "Frutas y verduras"),
      ingredient("maní o semillas", 1, "cucharada", "Almacén"),
    ],
    steps: [
      "Mezclá la avena con la leche o bebida vegetal.",
      "Agregá la fruta y el maní o semillas.",
      "Guardá tapado en la heladera durante la noche.",
    ],
    equipment: ["heladera", "frasco"],
    substitutions: [
      { ingredient: "leche o bebida vegetal", replacement: "yogur o agua" },
      { ingredient: "banana", replacement: "manzana o pera" },
    ],
    rationale: "Ayuda a resolver una comida con anticipación y pocos pasos.",
    warnings: [],
    tags: ["desayuno", "merienda", "para llevar", "sin cocinar"],
  },
  {
    title: "Ensalada de garbanzos para llevar",
    description: "Una opción fresca que puede prepararse con anticipación.",
    servings: 1,
    preparationMinutes: 15,
    difficulty: "Fácil",
    ingredients: [
      ingredient("garbanzos cocidos", 200, "g", "Cereales y legumbres"),
      ingredient("tomate", 1, "unidad", "Frutas y verduras"),
      ingredient("zanahoria", 1, "unidad", "Frutas y verduras"),
      ingredient("hojas verdes", 1, "taza", "Frutas y verduras"),
      ingredient("aceite de oliva", 1, "cucharada", "Almacén"),
    ],
    steps: [
      "Enjuagá los garbanzos.",
      "Cortá los vegetales y mezclá todo.",
      "Llevá el aderezo aparte si vas a transportarla.",
    ],
    equipment: ["recipiente con tapa"],
    substitutions: [
      { ingredient: "garbanzos cocidos", replacement: "lentejas o porotos" },
      { ingredient: "hojas verdes", replacement: "repollo fino" },
    ],
    rationale: "Es simple, transportable y combina legumbres con vegetales.",
    warnings: [],
    tags: ["almuerzo", "rápido", "para llevar", "sin cocinar"],
  },
];

function restrictions(context: NutritionContextSnapshot) {
  return [
    ...context.profile.allergies,
    ...context.profile.intolerances,
    ...context.profile.restrictions,
    ...context.profile.dislikedFoods,
  ].map(normalizeNutritionText).filter(Boolean);
}

export function recipeIsCompatible(
  recipe: NutritionRecipeResult,
  context: NutritionContextSnapshot,
) {
  const blocked = restrictions(context);
  if (!blocked.length) return true;
  return recipe.ingredients.every((item) => {
    const name = normalizeNutritionText(item.name);
    return blocked.every((value) => !name.includes(value) && !value.includes(name));
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

export function fallbackRecipes(
  context: NutritionContextSnapshot,
  input: { mealType?: string; tags?: string[]; limit?: number },
) {
  const desiredTags = [
    safeText(input.mealType, 30),
    ...stringList(input.tags, 5),
  ].map(normalizeNutritionText).filter(Boolean);
  const compatible = RECIPE_LIBRARY.filter((recipe) => recipeIsCompatible(recipe, context));
  const scored = compatible.map((recipe) => ({
    recipe,
    score: desiredTags.reduce(
      (sum, tag) => sum + (recipe.tags.some((item) => normalizeNutritionText(item).includes(tag)) ? 1 : 0),
      0,
    ),
  })).sort((left, right) => right.score - left.score || left.recipe.preparationMinutes - right.recipe.preparationMinutes);
  return scored.slice(0, Math.max(1, Math.min(input.limit ?? 4, 5))).map(({ recipe }) => ({
    ...recipe,
    rationale: `${recipe.rationale} Orientación alineada con tu objetivo: ${objectiveLabel(context.student.objective)}.`,
  }));
}

export function fallbackPantry(
  context: NutritionContextSnapshot,
  pantryIngredients: string[],
) {
  const pantry = pantryIngredients.map(normalizeNutritionText);
  const recipes = RECIPE_LIBRARY.filter((recipe) => recipeIsCompatible(recipe, context));
  const results = recipes.map((recipe) => {
    const missing = recipe.ingredients.filter((item) => {
      const name = normalizeNutritionText(item.name);
      return !pantry.some((available) => name.includes(available) || available.includes(name));
    });
    return { recipe, missing: missing.map((item) => item.name) };
  }).sort((left, right) => left.missing.length - right.missing.length);
  return {
    canCookNow: results.filter((item) => item.missing.length === 0).slice(0, 3),
    missingOne: results.filter((item) => item.missing.length === 1).slice(0, 3),
    alternatives: results.filter((item) => item.missing.length > 1).slice(0, 2),
  };
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function fallbackMealPlan(
  context: NutritionContextSnapshot,
  input: { days?: number; meals?: string[]; startDate?: string },
) {
  const days = safeInteger(input.days, 1, 7, 7);
  const mealTypes = stringList(input.meals, 5);
  const selectedMeals = mealTypes.length ? mealTypes : ["Almuerzo", "Cena"];
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(input.startDate ?? "")
    ? input.startDate!
    : context.today;
  const recipes = fallbackRecipes(context, { limit: 5 });
  if (!recipes.length) return { startDate, endDate: addDays(startDate, days - 1), meals: [] };
  const meals: NutritionPlanMeal[] = [];
  for (let day = 0; day < days; day += 1) {
    for (let position = 0; position < selectedMeals.length; position += 1) {
      const recipe = recipes[(day + position) % recipes.length];
      const mealType = selectedMeals[position];
      meals.push({
        id: `${day}-${position}-${normalizeNutritionText(mealType).replace(/\s/g, "-")}`,
        dateKey: addDays(startDate, day),
        mealType,
        title: recipe.title,
        suggestedTime: context.profile.usualMealTimes[mealType.toLocaleLowerCase("es")] ?? "",
        relationToTraining: context.training.routineName
          ? "Organizada para acompañar tus días de entrenamiento."
          : "Organizada según tu objetivo y hábitos.",
        status: "PLANNED",
      });
    }
  }
  return { startDate, endDate: addDays(startDate, days - 1), meals };
}

export function shoppingItemsFromRecipes(
  recipes: NutritionRecipeResult[],
): NutritionShoppingItem[] {
  const grouped = new Map<string, NutritionShoppingItem>();
  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients) {
      const key = `${normalizeNutritionText(ingredient.name)}|${normalizeNutritionText(ingredient.unit)}`;
      const current = grouped.get(key);
      if (current && current.quantity !== null && ingredient.quantity !== null) {
        current.quantity += ingredient.quantity;
      } else if (!current) {
        grouped.set(key, {
          ...ingredient,
          id: `item-${grouped.size + 1}-${normalizeNutritionText(ingredient.name).replace(/\s/g, "-")}`,
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
      name,
      quantity: Number.isFinite(quantityValue) && quantityValue >= 0 ? quantityValue : null,
      unit: safeText(ingredientRecord.unit, 30),
      category: safeText(ingredientRecord.category, 50) || "Otros",
      optional: ingredientRecord.optional === true,
    }];
  }).slice(0, 30);
  const steps = stringList(record.steps, 20);
  if (!title || ingredients.length < 2 || !steps.length) return null;
  return {
    title,
    description,
    servings: safeInteger(record.servings, 1, 12, 1),
    preparationMinutes: safeInteger(record.preparationMinutes, 1, 240, 20),
    difficulty: record.difficulty === "Intermedia" ? "Intermedia" : "Fácil",
    ingredients,
    steps,
    equipment: stringList(record.equipment, 12),
    substitutions: Array.isArray(record.substitutions)
      ? record.substitutions.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const source = item as Record<string, unknown>;
          const ingredientName = safeText(source.ingredient, 80);
          const replacement = safeText(source.replacement, 100);
          return ingredientName && replacement ? [{ ingredient: ingredientName, replacement }] : [];
        }).slice(0, 12)
      : [],
    rationale: safeText(record.rationale, 300),
    warnings: stringList(record.warnings, 8),
    tags: stringList(record.tags, 12),
  };
}
