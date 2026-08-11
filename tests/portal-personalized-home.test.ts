import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../componentes/portal-section.tsx", import.meta.url), "utf8");
const overview = source.slice(source.indexOf("function PortalOverview"), source.indexOf("function WeeklyMissionAchievement"));

test("Personalizado y Mixto con rutina priorizan el plan sin romper Clases", () => {
  assert.match(overview, /serviceType === "PERSONALIZED"/);
  assert.match(overview, /serviceType === "MIXED" && Boolean\(data\.routine\)/);
  assert.match(overview, /homePlan \? <RoutineHomeCard/);
  assert.match(overview, /groupClassesEnabled && <PortalClasses compact/);
});

test("Enfoque de hoy aparece antes de Tu rutina de hoy", () => {
  assert.ok(overview.indexOf("Enfoque de hoy") < overview.indexOf("RoutineHomeCard"));
  assert.match(overview, /Tu rutina de hoy/);
  assert.doesNotMatch(overview, /Último entrenamiento/);
});

test("la tarjeta usa rutina, día, ejercicios, duración y sesiones reales", () => {
  assert.match(overview, /data\.routine/);
  assert.match(overview, /data\.workoutSessions/);
  assert.match(overview, /sessionBelongsToWeek/);
  assert.match(overview, /block\.exercises\.length/);
  assert.match(overview, /suggestedDay\?\.estimatedMinutes/);
  assert.match(overview, /Progreso semanal del plan/);
});

test("los fallbacks son claros y la acción permanece dentro del portal", () => {
  assert.match(overview, /Tu plan está listo para continuar/);
  assert.match(overview, /Continuá desde tu planificación activa/);
  assert.match(overview, /href="\/portal\/rutina"/);
  assert.match(overview, /Empezar rutina/);
  assert.match(overview, /Continuar rutina/);
  assert.match(overview, /Ver rutina/);
});

test("las tres cards adaptan sólo el progreso para el plan", () => {
  assert.match(overview, /grid grid-cols-3/);
  assert.match(overview, /Tu cuota/);
  assert.match(overview, /Progreso del plan/);
  assert.match(overview, /Tus puntos/);
  assert.match(overview, /href="\/portal\/rutina"/);
  assert.match(overview, /href="\/portal\/evaluaciones"/);
});
