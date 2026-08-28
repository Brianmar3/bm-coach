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

test("un logro nuevo se anuncia por evento real y se deduplica", () => {
  assert.match(component, /bm:new-achievements/);
  assert.match(component, /completed\.current\.has\(item\.notificationId\)/);
  assert.match(component, /notificationIds\.has\(item\.notificationId\)/);
  assert.match(component, /achievementIds\.has\(item\.id\)/);
  assert.match(component, /completedAchievements\.current\.has\(item\.id\)/);
  assert.doesNotMatch(component, /pathname|usePathname/);
});

test("la celebración se confirma de forma persistente y respeta reduced motion", () => {
  assert.match(route, /data: \{ celebratedAt: new Date\(\) \}/);
  assert.match(component, /method: "PATCH"/);
  assert.match(component, /hidden[^\n]+motion-safe:block[^\n]+motion-safe:animate-ping/);
  assert.match(component, /motion-safe:translate-y-0/);
  assert.doesNotMatch(component, /animate-(?!ping)/);
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

test("la microcelebración es automática, breve y procesa la cola en orden", () => {
  assert.match(component, /setPhase\("exit"\), 1540/);
  assert.match(component, /complete\(current\), 1780/);
  assert.match(component, /const current = queue\[0\]/);
  assert.match(component, /Siguiente logro en cola/);
  assert.doesNotMatch(component, /Ver logro|Continuar/);
});

test("la app abierta y reanudada consulta logros pendientes", () => {
  assert.match(component, /setInterval\(\(\) => void check\(\), 10000\)/);
  assert.match(component, /visibilitychange/);
  assert.match(component, /pageshow/);
  assert.match(component, /BM_ACHIEVEMENT_AVAILABLE/);
});
