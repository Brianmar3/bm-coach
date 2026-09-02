import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("inactive schedules suppress only their future generated occurrences", () => {
  const source = read("lib/class-occurrences.ts");
  assert.match(source, /where: \{ scheduleId, date: \{ gte: today \}, status: "SCHEDULED" \}/);
  assert.match(source, /data: \{ status: "CANCELLED", suppressedBySchedule: true \}/);
  assert.match(source, /where: \{ scheduleId, date: \{ gte: today \}, suppressedBySchedule: true \}/);
  assert.match(source, /data: \{ status: "SCHEDULED", suppressedBySchedule: false \}/);
});

test("archiving a schedule preserves history and removes it from current planning", () => {
  const route = read("app/api/clases/[id]/route.ts");
  const occurrenceRoute = read("app/api/clases/ocurrencias/route.ts");
  assert.doesNotMatch(route, /weeklyClassSchedule\.delete/);
  assert.match(route, /data: \{ active: false, archivedAt: now \}/);
  assert.match(occurrenceRoute, /suppressedBySchedule: false/);
});
