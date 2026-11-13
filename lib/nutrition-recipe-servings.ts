import type { NutritionRecipeResult } from "../types/nutrition-intelligence.ts";

export function recipeWithServings(recipe: NutritionRecipeResult, servings: number): NutritionRecipeResult {
  if (servings === recipe.servings) return recipe;
  return {
    ...recipe,
    servings,
    ingredients: recipe.ingredients.map((item) => ({
      ...item,
      quantity: item.quantity === null ? null : item.quantity * servings / recipe.servings,
    })),
  };
}
