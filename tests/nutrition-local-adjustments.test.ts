import assert from "node:assert/strict";
import { test } from "node:test";
import { localNutritionAnswer } from "../lib/nutrition-local-answer.ts";
import { shoppingItemsFromRecipes } from "../lib/nutrition-rules.ts";
import type { NutritionRecipeResult } from "../types/nutrition-intelligence.ts";

test("la guía local responde a la pregunta actual sin mezclar mensajes anteriores", () => {
  const protein = localNutritionAnswer("¿Qué es la proteína?");
  const beforeTraining = localNutritionAnswer("¿Qué puedo comer una hora antes de entrenar?");
  assert.match(protein, /nutriente/);
  assert.doesNotMatch(protein, /banana|antes de entrenar/);
  assert.match(beforeTraining, /una hora|banana/);
  assert.doesNotMatch(beforeTraining, /La proteína es/);
  assert.match(localNutritionAnswer("¿Cuál fue mi evaluación anterior?"), /no puede interpretar bien/);
});

test("compras suma unidades compatibles y conserva estados distintos", () => {
  const recipe = {
    ingredients: [
      { name: "arroz", quantity: 1, unit: "kg", category: "Cereales", state: "crudo" },
      { name: "leche", quantity: 1, unit: "l", category: "Lácteos" },
    ],
  } as NutritionRecipeResult;
  const items = shoppingItemsFromRecipes([recipe, {
    ...recipe,
    ingredients: [
      { name: "arroz", quantity: 250, unit: "g", category: "Cereales", state: "crudo" },
      { name: "arroz", quantity: 100, unit: "g", category: "Cereales", state: "cocido" },
      { name: "leche", quantity: 500, unit: "ml", category: "Lácteos" },
    ],
  }]);
  assert.equal(items.find((item) => item.name === "arroz" && item.state === "crudo")?.quantity, 1250);
  assert.equal(items.find((item) => item.name === "arroz" && item.state === "cocido")?.quantity, 100);
  assert.equal(items.find((item) => item.name === "leche")?.quantity, 1500);
});
