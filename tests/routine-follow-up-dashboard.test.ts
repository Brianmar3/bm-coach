import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboard = readFileSync(new URL("../componentes/routine-follow-up-dashboard.tsx", import.meta.url), "utf8");
const summaryApi = readFileSync(new URL("../app/api/seguimiento/resumen/route.ts", import.meta.url), "utf8");
const detailApi = readFileSync(new URL("../app/api/seguimiento/detalle/route.ts", import.meta.url), "utf8");

test("Seguimiento muestra los cuatro KPI y la tabla profesional", () => {
  for (const text of ["Alumnos en seguimiento", "Al día", "Necesitan atención", "Promedio por alumno", "Rutina activa", "Cumplimiento", "Ver seguimiento"]) assert.match(dashboard, new RegExp(text));
});

test("los filtros principales quedan compactos y sin fecha ni checkbox de molestia", () => {
  for (const text of ["Buscar alumno o rutina", "Todos los estados", "Todos los lugares", "Limpiar"]) assert.match(dashboard, new RegExp(text));
  assert.doesNotMatch(dashboard, /type="date"|Con molestia activa/);
});

test("el detalle es un drawer responsive con pestañas y cierre por Escape", () => {
  assert.match(dashboard, /lg:w-\[62vw\]/);
  assert.match(dashboard, /h-dvh/);
  assert.match(dashboard, /event\.key === "Escape"/);
  assert.match(dashboard, /role="tab" aria-selected=\{tab === value\}/);
  assert.match(dashboard, /min-h-11 shrink-0 border-b-2/);
  assert.match(dashboard, /aria-label="Cerrar seguimiento"/);
  for (const tab of ["Resumen", "Sesiones", "Progreso", "Molestias"]) assert.match(dashboard, new RegExp(tab));
});

test("los controles compactos de seguimiento tienen nombre accesible y target táctil", () => {
  assert.match(dashboard, /aria-label="Página anterior"/);
  assert.match(dashboard, /aria-label="Página siguiente"/);
  assert.match(dashboard, /aria-live="polite"/);
  assert.match(dashboard, /aria-labelledby="session-detail-title"/);
  assert.match(dashboard, /id="session-detail-title"/);
  assert.doesNotMatch(dashboard, /className="size-(?:9|10) rounded-lg border border-zinc-800 disabled:opacity-30"/);
});

test("el resumen individual usa datos reales y estados vacíos", () => {
  for (const section of ["Sesiones recientes", "Evolución corporal", "Cumplimiento del plan", "Duración por sesión", "Distribución por tipo de bloque"]) assert.match(dashboard, new RegExp(section));
  assert.match(detailApi, /physicalEvaluation\.findMany/);
  assert.match(detailApi, /blockDistribution/);
  assert.match(detailApi, /exerciseProgress/);
  assert.doesNotMatch(dashboard, /Notas del entrenador/);
});

test("el listado no descarga el historial completo y el detalle se pide bajo demanda", () => {
  assert.match(dashboard, /\/api\/seguimiento\/resumen/);
  assert.match(dashboard, /\/api\/seguimiento\/detalle\?studentId=/);
  assert.doesNotMatch(summaryApi, /coachInstructions|targetRepetitions|previousLogs/);
  assert.match(detailApi, /take: 100/);
});
