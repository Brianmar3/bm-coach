import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("../componentes/achievement-celebration.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/portal/achievements/celebration/route.ts", import.meta.url), "utf8");
const notifications = readFileSync(new URL("../lib/push-notifications.ts", import.meta.url), "utf8");
const quickLogAchievements = readFileSync(new URL("../lib/quick-log-achievements.ts", import.meta.url), "utf8");

test("los logros históricos no ingresan en la cola de celebración", () => {
  assert.match(route, /celebratedAt: null/);
  assert.match(route, /status: \{ not: "BASELINE" \}/);
  assert.match(route, /orderBy: \[\{ unlockedAt: "asc" \}, \{ createdAt: "asc" \}\]/);
});

test("un logro nuevo se anuncia por evento real y entra en una cola compartida", () => {
  assert.match(component, /bm:new-achievements/);
  assert.match(component, /enqueueCelebrations/);
  assert.match(component, /reconcileWeeklyCelebration/);
  assert.match(component, /confirmedRef/);
});

test("la celebración se confirma de forma persistente y respeta reduced motion", () => {
  const dialog = readFileSync(new URL("../componentes/celebration-dialog.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(route, /data: \{ celebratedAt: new Date\(\) \}/);
  assert.match(component, /method: "PATCH"/);
  assert.match(dialog, /showModal\(\)/);
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*\.bm-celebration-confetti \{ display: none/);
});
test("la línea base se establece una sola vez incluso sin logros históricos", () => {
  assert.match(notifications, /ACHIEVEMENT_BASELINE_KEY = "__achievement-baseline:v1__"/);
  assert.match(notifications, /achievementKey: ACHIEVEMENT_BASELINE_KEY/);
  assert.match(notifications, /if \(existingBaseline\) return/);
  assert.match(notifications, /skipDuplicates: true/);
});

test("una marca de fuerza conserva un ID estable y datos reales para la celebración", () => {
  assert.match(quickLogAchievements, /`quick-log:first:\$\{exerciseKey\}`/);
  assert.match(quickLogAchievements, /`quick-log:max:\$\{raw\.id\}`/);
  assert.match(quickLogAchievements, /name: loadLabel\(item\.type\)/);
  assert.match(quickLogAchievements, /exercise: item\.exerciseName/);
  assert.match(quickLogAchievements, /previousValue:/);
  assert.match(quickLogAchievements, /newValue:/);
});

test("fullscreen permanece hasta confirmación manual y procesa un solo elemento", () => {
  const dialog = readFileSync(new URL("../componentes/celebration-dialog.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(component, /1540|1780|setPhase/);
  assert.match(component, /queue\[0\]/);
  assert.match(dialog, /Continuar/);
  assert.match(dialog, /onClick=\{onContinue\}/);
  assert.match(component, /if \(!response.ok\) throw/);
});
test("la app abierta y reanudada consulta logros pendientes", () => {
  assert.match(component, /setInterval\(\(\) => void check\(\), 10000\)/);
  assert.match(component, /visibilitychange/);
  assert.match(component, /pageshow/);
  assert.match(component, /BM_ACHIEVEMENT_AVAILABLE/);
});
