import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("../componentes/achievement-celebration.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/portal/achievements/celebration/route.ts", import.meta.url), "utf8");

test("los logros históricos no ingresan en la cola de celebración", () => {
  assert.match(route, /celebratedAt: null/);
  assert.match(route, /status: \{ not: "BASELINE" \}/);
  assert.match(route, /orderBy: \[\{ unlockedAt: "asc" \}, \{ createdAt: "asc" \}\]/);
});

test("un logro nuevo se anuncia por evento real y se deduplica", () => {
  assert.match(component, /bm:new-achievements/);
  assert.match(component, /completed\.current\.has\(item\.notificationId\)/);
  assert.match(component, /ids\.has\(item\.notificationId\)/);
  assert.doesNotMatch(component, /pathname|usePathname/);
});

test("la celebración se confirma de forma persistente y respeta reduced motion", () => {
  assert.match(route, /data: \{ celebratedAt: new Date\(\) \}/);
  assert.match(component, /method: "PATCH"/);
  assert.match(component, /motion-reduce:animate-none/);
});
