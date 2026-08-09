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
  for (const key of ["hydration", "protein", "fruitsVegetables", "mealOrganization", "energy"]) assert.match(source, new RegExp(`${key}:`));
  assert.match(source, /checked=\{habits\[key\]\}/);
  assert.match(source, /event\.target\.checked/);
  assert.match(source, /Agregar comentario opcional/);
  assert.match(source, /value=\{comment\}/);
  assert.match(source, /onChange=\{\(event\) => setComment/);
  assert.match(source, /onClick=\{saveHabits\}/);
  assert.match(source, /body: JSON\.stringify\(\{ \.\.\.habits, comment \}\)/);
  assert.match(source, /className="peer sr-only"/);
  assert.doesNotMatch(source, /accent-yellow|className="h-5 w-5/);
});

test("móvil usa hábitos horizontales, accesos compactos y estados vacíos breves", () => {
  assert.match(source, /grid grid-cols-5/);
  assert.match(source, /grid grid-cols-2 gap-2 sm:grid-cols-4/);
  assert.doesNotMatch(source, /overflow-x-auto|w-screen|min-w-screen/);
  assert.match(source, /Todavía no guardaste recetas/);
  assert.match(source, /Todavía no hay una recomendación nueva/);
});

test("preferencias, evaluación, recomendación y accesos conservan sus rutas", () => {
  assert.match(source, /href="\/portal\/nutricion\/preferencias"/);
  assert.match(source, /href="\/portal\/nutricion\/preferencias#datos-utilizados"/);
  assert.match(source, /href=\{data\.recommendation\.href\}/);
  for (const route of ["compras", "despensa", "recetas", "aprender"]) assert.match(source, new RegExp(`/portal/nutricion/${route}`));
  assert.match(source, /href="\/portal\/nutricion\/recetas"[^>]*>Ver todas/);
  assert.match(source, /Explorar →/);
});

test("el rediseño usa iconos lineales y evita emojis y botones amarillos dominantes", () => {
  assert.match(source, /function LineIcon/);
  assert.match(source, /function HabitIcon/);
  for (const emoji of ["💧", "🥩", "🍎", "🥗", "⚡", "🛒", "🍲", "📖", "🎓"]) assert.doesNotMatch(source, new RegExp(emoji, "u"));
  assert.doesNotMatch(source, /rounded-xl bg-yellow-400 px-4 text-(?:xs|sm) font-black text-(?:black|zinc-950)/);
});

test("la navegación global conserva Nutrición activa por ruta", () => {
  const shell = readFileSync(new URL("../componentes/portal-shell.tsx", import.meta.url), "utf8");
  assert.match(shell, /\["Nutrición", "\/portal\/nutricion"/);
  assert.match(shell, /pathname\.startsWith\(href\)/);
  for (const route of ["/portal", "/portal/rutina", "/portal/clases", "/portal/nutricion", "/portal/evaluaciones"]) assert.match(shell, new RegExp(`"${route}"`));
});
