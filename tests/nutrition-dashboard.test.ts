import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../componentes/student-nutrition.tsx", import.meta.url), "utf8");
test("la portada prioriza el resumen, las recetas y los hábitos", () => {
  assert.match(source, /href="\/portal\/nutricion\/ideas"[^>]*>Explorar recetas/);
  assert.ok(source.indexOf("Resumen del día") < source.indexOf("nutrition-primary-nav"));
  assert.ok(source.indexOf("Hábitos de hoy") < source.indexOf("Tu biblioteca"));
  const dock = readFileSync(new URL("../componentes/nutrition-assistant-dock.tsx", import.meta.url), "utf8");
  assert.match(dock, /showModal/);
  assert.match(dock, /<AssistantView conversationId="" embedded/);
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

test("móvil usa hábitos legibles, herramientas compactas y estados vacíos breves", () => {
  assert.match(source, /nutrition-habit-list/);
  assert.match(source, /nutrition-primary-nav/);
  assert.doesNotMatch(source, /grid-cols-5|truncate/);
  assert.doesNotMatch(source, /overflow-x-auto|w-screen|min-w-screen/);
  assert.match(source, /Todavía no guardaste recetas/);
  assert.match(source, /Todavía no hay una recomendación nueva/);
});

test("preferencias, evaluación, recomendación y accesos conservan sus rutas", () => {
  assert.match(source, /href="\/portal\/nutricion\/preferencias"/);
  assert.match(source, /href="\/portal\/nutricion\/preferencias#datos-utilizados"/);
  assert.match(source, /href=\{data\.recommendation\.href\}/);
  for (const route of ["ideas", "recetas", "plan"]) assert.match(source, new RegExp(`/portal/nutricion/${route}`));
  assert.match(source, /href="\/portal\/nutricion\/recetas"[^>]*>Ver guardadas/);
  for (const route of ["despensa", "aprender", "favoritos", "historial"]) assert.ok(source.includes(JSON.stringify(route)));
  assert.match(source, /Explorar ideas <BmChevronRightIcon/);
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
