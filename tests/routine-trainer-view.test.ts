import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/rutinas/page.tsx", import.meta.url), "utf8");
const table = readFileSync(new URL("../componentes/routine-table-view.tsx", import.meta.url), "utf8");
const card = page.slice(page.indexOf("function RoutineCard"), page.indexOf("function Info"));
const editor = page.slice(page.indexOf("function RoutineEditor"), page.indexOf("function ExerciseEditor"));

test("la tarjeta usa una fuente única y muestra cuatro métricas en dos columnas", () => {
  assert.match(page, /import \{ routineSeriesMetrics \}/);
  assert.match(card, /const metrics = routineSeriesMetrics\(routine\)/);
  assert.match(card, /grid grid-cols-2 gap-3/);
  assert.match(card, /Series totales/);
  assert.match(card, /metrics\.totalSeries/);
});

test("la tarjeta principal ya no ofrece historial y mantiene acciones importantes", () => {
  assert.doesNotMatch(card, /Ver historial/);
  for (const action of ["Ver contenido", "Ver seguimiento", "Editar", "Duplicar", "Guardar plantilla", "Copiar a alumno", "Archivar"]) {
    assert.match(card, new RegExp(action));
  }
  assert.match(card, /Más acciones/);
});

test("Ver contenido resume series, días, ejercicios y distribución semanal", () => {
  assert.match(table, /routineSeriesMetrics\(routine\)/);
  for (const content of ["Series totales", "Distribución semanal", "Ver desglose por día"]) assert.match(table, new RegExp(content));
  assert.match(table, /weeklyDistribution\.map/);
  assert.match(table, /perDay\.map/);
  assert.match(table, /item\.percentage/);
});

test("el selector móvil conserva ancho, desplazamiento y conteo legible", () => {
  assert.match(editor, /aria-label="Días de la rutina"/);
  assert.match(editor, /snap-x snap-mandatory/);
  assert.match(editor, /overflow-x-auto/);
  assert.match(editor, /w-36 shrink-0 snap-start/);
  assert.match(editor, /whitespace-nowrap font-bold">Día/);
  assert.match(editor, /day\.exercises\.length/);
  assert.match(editor, />\+ Día</);
});

test("las acciones del día quedan compactas y ordenadas sin cambiar handlers", () => {
  assert.match(editor, /grid grid-cols-2 gap-2/);
  assert.match(editor, /Mover izquierda/);
  assert.match(editor, /Mover derecha/);
  assert.match(editor, /onClick=\{duplicateDay\}/);
  assert.match(editor, /onClick=\{addExercise\}/);
  assert.match(editor, /onClick=\{removeDay\}/);
  assert.match(editor, /col-span-2 min-h-10/);
});
