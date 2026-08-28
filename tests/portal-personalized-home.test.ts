import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../componentes/portal-section.tsx", import.meta.url), "utf8");
const overview = source.slice(source.indexOf("function PortalOverview"), source.indexOf("function WeeklyMissionAchievement"));

test("Personalizado prioriza la rutina, Mixto lo hace con plan activo y Clases conserva su agenda", () => {
  assert.match(overview, /serviceType === "PERSONALIZED"/);
  assert.match(overview, /const groupClassesEnabled = hasGroupClasses/);
  assert.match(overview, /hasPersonalizedService\(data\.profile\.serviceType\)/);
  assert.match(overview, /routineFocused \|\| Boolean\(data\.routine\)/);
  assert.match(overview, /homePlan \? <RoutineHomeCard/);
  assert.match(overview, /groupClassesEnabled && <PortalClasses compact/);
});

test("Enfoque de hoy aparece antes de Tu rutina de hoy", () => {
  assert.ok(overview.indexOf("Enfoque de hoy") < overview.indexOf("<RoutineHomeCard"));
  assert.match(overview, /Tu rutina de hoy/);
  assert.doesNotMatch(overview, /Último entrenamiento/);
});

test("la tarjeta usa rutina, día, sesiones y progreso semanal reales", () => {
  assert.match(overview, /data\.routine/);
  assert.match(overview, /data\.workoutSessions/);
  assert.match(overview, /sessionBelongsToWeek/);
  assert.match(overview, /completedDayIds\.size/);
  assert.match(overview, /trainingDays\.length/);
  assert.match(overview, /Progreso semanal del plan/);
  assert.match(overview, /sesiones completadas esta semana/);
});

test("los fallbacks son claros y la acción permanece dentro del portal", () => {
  assert.match(overview, /Tu plan está listo para continuar/);
  assert.match(overview, /Continuá desde tu planificación activa/);
  assert.match(overview, /href="\/portal\/rutina"/);
  assert.match(overview, /Empezar rutina/);
  assert.match(overview, /Continuar rutina/);
  assert.match(overview, /Ver rutina/);
});

test("la mejora visual permanece compacta, usa BM Icons y un CTA completo", () => {
  const card = overview.slice(overview.indexOf("function RoutineHomeCard"), overview.indexOf("function WeeklyObjectiveCard"));
  assert.match(card, /Personalizado/);
  assert.match(card, /BmDumbbellIcon/);
  assert.match(card, /BmPlayIcon/);
  assert.match(card, /Tu entrenamiento está listo/);
  assert.match(card, /Continuá tu entrenamiento/);
  assert.match(card, /min-h-12 w-full/);
  assert.match(card, /p-4/);
  assert.doesNotMatch(card, /min-h-\[(?:1[0-9]|[2-9][0-9])rem\]/);
  assert.doesNotMatch(card, /[▦▶]/);
});

test("el objetivo semanal reutiliza la misión real sólo para servicios con clases", () => {
  assert.match(overview, /groupClassesEnabled && data\.home\.weeklyMission/);
  assert.match(overview, /<WeeklyObjectiveCard mission=\{data\.home\.weeklyMission\}/);
  assert.match(overview, /mission\.progress/);
  assert.match(overview, /mission\.target/);
  assert.match(overview, /mission\.pointsPerSession/);
  assert.match(overview, /mission\.completionBonus/);
  assert.match(overview, /completed \? "Cumplido"/);
  assert.match(overview, /Objetivo semanal completado · \+\$\{mission\.completionBonus\} pts/);
  assert.doesNotMatch(overview, /maximumReward\} pts obtenidos/);
  assert.doesNotMatch(overview, /Confirmadas/);
});

test("la celebración semanal responde sólo a la transición real del mismo objetivo", () => {
  assert.match(overview, /previousMission = useRef\(\{ id: mission\.id, state: mission\.state, progress: mission\.progress/);
  assert.match(overview, /if \(previous\.id !== mission\.id\) return/);
  assert.match(overview, /previous\.state !== "COMPLETED" && mission\.state === "COMPLETED"/);
  assert.match(overview, /bm:weekly-mission-celebrated:/);
  assert.match(overview, /setCelebrating\(true\)/);
  assert.match(overview, /setTimeout\(\(\) => setCelebrating\(false\), 1200\)/);
  assert.doesNotMatch(overview, /completed \? "portal-home-objective-celebrating"/);
});

test("el resumen conserva sólo Tu cuota y Tus puntos con datos reales", () => {
  assert.match(overview, /<HomeQuickStats data=\{data\} \/>/);
  assert.match(overview, /grid grid-cols-2/);
  assert.match(overview, /Tu cuota/);
  assert.match(overview, /Tus puntos/);
  assert.doesNotMatch(overview, /Progreso del plan|Progreso resumido/);
  assert.doesNotMatch(overview, /href="\/portal\/progreso"/);
  assert.match(overview, /href="\/portal\/pagos"/);
  assert.match(overview, /href="\/portal\/puntos"/);
  assert.match(overview, /account\.nextDueDate/);
  assert.match(overview, /homePaymentCardCopy/);
  assert.match(overview, /aria-label=\{`Tu cuota\. \$\{paymentCopy\.title\}/);
  assert.match(overview, /portal-home-interactive/);
  for (const state of ["AL_DIA", "VENCE_PRONTO", "VENCIDA", "SIN_CONFIGURAR"]) assert.match(source, new RegExp(`${state}:`));
  assert.doesNotMatch(overview, /href="\/portal\/evaluaciones"/);
});
