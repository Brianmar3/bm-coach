import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../componentes/student-nutrition.tsx", import.meta.url), "utf8");
const quickLinks = source.slice(source.indexOf("const quickLinks"), source.indexOf("] as const;") + 11);
const dashboard = source;

test("el inicio conserva únicamente cuatro accesos útiles", () => {
  for (const label of ["Compras", "Cocinar", "Recetas", "Aprender"]) assert.match(quickLinks, new RegExp(`\\["${label}"`));
  assert.equal((quickLinks.match(/\/portal\/nutricion\//g) ?? []).length, 4);
  assert.doesNotMatch(quickLinks, /Favoritos|Historial|Preguntar al asistente|\/asistente/);
});

test("el panel sigue una jerarquía breve y accionable", () => {
  const recommendation = source.indexOf("Para hoy");
  const habits = source.indexOf("Hábitos de hoy");
  const actions = source.indexOf("Accesos útiles");
  const recipes = source.indexOf("Recetas recientes");
  const trainer = source.indexOf("Recomendación de tu entrenador");
  assert.ok(recommendation < habits && habits < actions && actions < recipes && recipes < trainer);
  assert.doesNotMatch(dashboard, /Planificación activa/);
  assert.doesNotMatch(dashboard, /href="\/portal\/nutricion\/asistente"/);
});

test("hábitos integra un resumen compacto y mantiene la edición existente", () => {
  assert.match(source, /compliancePercentage/);
  assert.match(source, /NUTRITION_HABITS\.map/);
  assert.match(source, /Agregar comentario opcional/);
  assert.match(source, /onClick=\{saveHabits\}/);
  assert.match(source, /sm:w-auto/);
});

test("móvil usa dos columnas compactas y estados vacíos breves", () => {
  assert.match(source, /grid grid-cols-2 gap-2 sm:grid-cols-4/);
  assert.match(source, /min-h-20/);
  assert.match(source, /Todavía no guardaste recetas/);
  assert.match(source, /Todavía no hay una recomendación nueva/);
});
