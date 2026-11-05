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

test("la frase diaria se integra al saludo antes de la sesión", () => {
  assert.ok(overview.indexOf("dailyFocus.title") < overview.indexOf("<RoutineHomeCard"));
  assert.match(overview, /Tu próxima sesión/);
  assert.doesNotMatch(overview, /Último entrenamiento/);
});

test("la tarjeta usa rutina, día, sesiones y progreso semanal reales", () => {
  assert.match(overview, /data\.routine/);
  assert.match(overview, /data\.workoutSessions/);
  assert.match(overview, /sessionBelongsToWeek/);
  assert.match(overview, /completedDayIds\.size/);
  assert.match(overview, /trainingDays\.length/);
  assert.match(overview, /ejercicios programados/);
  assert.match(overview, /plan.estimatedMinutes/);
});

test("los fallbacks son claros y la acción permanece dentro del portal", () => {
  assert.match(overview, /Sin rutina asignada/);
  assert.match(overview, /Cuando tu entrenador complete la planificación/);
  assert.match(overview, /href="\/portal\/rutina"/);
  assert.match(overview, /Ver entrenamiento/);
  assert.match(overview, /Continuar rutina/);
  assert.match(overview, /Ver rutina/);
});

test("la mejora visual permanece compacta, usa BM Icons y un CTA completo", () => {
  const card = overview.slice(overview.indexOf("function RoutineHomeCard"), overview.indexOf("function WeeklyObjectiveCard"));
  assert.match(card, /Personalizado/);
  assert.match(card, /BmDumbbellIcon/);
  assert.match(card, /BmPlayIcon/);
  assert.match(card, /plan.title/);
  assert.match(card, /Tu sesión en curso/);
  assert.match(card, /min-h-12 w-full/);
  assert.match(card, /px-4/);
  assert.doesNotMatch(card, /min-h-\[(?:1[0-9]|[2-9][0-9])rem\]/);
  assert.doesNotMatch(card, /[▦▶]/);
});

test("el objetivo semanal reutiliza la misión real sólo para servicios con clases", () => {
  assert.match(overview, /groupClassesEnabled && !weeklyCelebrated && data\.home\.weeklyMission/);
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

test("la celebración semanal conserva el servicio compartido y no se modifica desde la tarjeta", () => {
  assert.match(overview, /useWeeklyMissionCelebration\(data.home.weeklyMission\)/);
  assert.match(overview, /previousMission = useRef/);
  assert.match(overview, /if \(previous.id !== mission.id\) return/);
});

test("el resumen conserva sólo Tu cuota y Tus puntos con datos reales", () => {
  const quickStats = overview.slice(overview.indexOf("function HomeQuickStats"));
  assert.match(overview, /<HomeQuickStats data=\{data\} \/>/);
  assert.match(quickStats, /grid grid-cols-2/);
  assert.match(quickStats, /Tu cuota/);
  assert.match(quickStats, /Tus puntos/);
  assert.match(quickStats, /href="\/portal\/pagos"/);
  assert.match(quickStats, /href="\/portal\/puntos"/);
  assert.doesNotMatch(quickStats, /href="\/portal\/ranking"/);
  assert.match(quickStats, /Ver pagos <BmChevronRightIcon size=\{16\}/);
  assert.match(quickStats, /Ver puntos <BmChevronRightIcon size=\{16\}/);
  assert.match(readFileSync("componentes/portal-visuals.tsx", "utf8"), /min-h-\[6\.75rem\]/);
  assert.match(quickStats, /account\.nextDueDate/);
  assert.match(quickStats, /homePaymentCardCopy/);
  assert.match(quickStats, /aria-label=\{`Tu cuota\. \$\{paymentCopy\.title\}/);
  assert.match(readFileSync("componentes/portal-visuals.tsx", "utf8"), /PORTAL_STAT_CARD_CLASS = "[^"]*portal-home-stat portal-home-interactive/);
  for (const state of ["AL_DIA", "VENCE_PRONTO", "VENCIDA", "SIN_CONFIGURAR"]) assert.match(source, new RegExp(`${state}:`));
  assert.doesNotMatch(quickStats, /href="\/portal\/evaluaciones"/);
});
