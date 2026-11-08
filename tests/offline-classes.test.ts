import assert from "node:assert/strict";
import test from "node:test";
import { canReadOfflineClasses, savedClassAgenda, savedClassSummary } from "../lib/offline-classes.ts";
import type { PortalClassOccurrence } from "../types/classes.ts";
import type { PortalData } from "../types/portal.ts";

const savedAt = "2026-11-07T20:00:00.000Z";
const scope = { key: "student-a/workspace-a/session-a", expiresAt: "2026-11-10T00:00:00.000Z", accountRevision: null };

test("offline agenda keeps at most four eligible occurrences and omits responses and private fields", () => {
  const occurrences = Array.from({ length: 6 }, (_, index) => ({
    id: String(index), name: "Funcional", date: "2026-11-09", startTime: "09:00", endTime: "10:00",
    response: "CONFIRMED", canRespond: true, confirmedCount: 5,
  })) as PortalClassOccurrence[];
  const saved = savedClassAgenda(occurrences, ["1", "2", "3", "4", "5"], savedAt);
  assert.equal(saved.savedAt, savedAt);
  assert.deepEqual(saved.classes.map(({ id }) => id), ["1", "2", "3", "4"]);
  assert.deepEqual(saved.classes[0], { id: "1", name: "Funcional", date: "2026-11-09", startTime: "09:00", endTime: "10:00" });
  assert.deepEqual(savedClassAgenda(occurrences, [], savedAt), { savedAt, classes: [] });
});

test("offline summary keeps only monthly attendance and points, including zero", () => {
  const home = { classesAttendedThisMonth: 0, points: { monthlyTotal: 24, total: 92 }, coachPhone: "private" } as PortalData["home"];
  assert.deepEqual(savedClassSummary(home, savedAt), { savedAt, attendance: 0, points: 24 });
});

test("offline classes require saved data, current session scope and an unexpired session", () => {
  const now = Date.parse(savedAt);
  const snapshot = { scope, summary: { savedAt, attendance: 2, points: 4 } };
  assert.equal(canReadOfflineClasses(undefined, scope.key, now), false);
  assert.equal(canReadOfflineClasses({ scope }, scope.key, now), false);
  assert.equal(canReadOfflineClasses(snapshot, scope.key, now), true);
  assert.equal(canReadOfflineClasses(snapshot, undefined, now), true);
  assert.equal(canReadOfflineClasses(snapshot, "student-b/workspace-b/session-b", now), false);
  assert.equal(canReadOfflineClasses(snapshot, scope.key, Date.parse(scope.expiresAt)), false);
});
