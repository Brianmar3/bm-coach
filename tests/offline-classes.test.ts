import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { canReadOfflineClasses, OFFLINE_EXERCISE_PAGE_SIZE, saveLatestExercises, savedClassAgenda, savedClassSummary } from "../lib/offline-classes.ts";
import type { PortalClassOccurrence } from "../types/classes.ts";
import type { PortalData } from "../types/portal.ts";
import { offlineScope } from "../lib/offline-training-types.ts";
import { normalizeExerciseName } from "../lib/exercise-name.ts";

const savedAt = "2026-11-07T20:00:00.000Z";
const scope = { key: "student-a/workspace-a/session-a", expiresAt: "2026-11-10T00:00:00.000Z", accountRevision: null };

test("offline exercises show the most recent entry and its last set, not a historical or session best", () => {
  const newest = { sourceId: "new", exerciseKey: "squat", exerciseName: "Sentadilla", date: "2026-11-07", createdAt: savedAt, sets: 2,
    setDetails: [{ setNumber: 1, weight: 60, repetitions: 5, unit: "kg" }, { setNumber: 2, weight: 40, repetitions: 8, unit: "kg" }] };
  const old = { ...newest, sourceId: "old", date: "2026-11-05", setDetails: [{ setNumber: 1, weight: 100, repetitions: 3, unit: "kg" }] };
  assert.deepEqual(saveLatestExercises([old, newest], savedAt), { savedAt, exercises: [
    { key: "squat", name: "Sentadilla", date: "2026-11-07", weight: 40, unit: "kg", sets: 2, repetitions: 8 },
  ] });
  assert.deepEqual(saveLatestExercises([], savedAt), { savedAt, exercises: [] });
  const many = Array.from({ length: 24 }, (_, i) => ({ ...newest, exerciseKey: String(i) }));
  assert.equal(saveLatestExercises(many, savedAt).exercises.length, 24);
  assert.equal(OFFLINE_EXERCISE_PAGE_SIZE, 5);
  assert.equal(canReadOfflineClasses({ scope, exercises: saveLatestExercises([], savedAt) }, scope.key, Date.parse(savedAt)), true);
});

test("offline exercises API reads only the authenticated workspace and returns fresh minimal copies", async () => {
  const execute = <T>(path: string, dependencies: Record<string, unknown>) => {
    const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const exports = {};
    new Function("require", "exports", code)((name: string) => {
      assert.ok(name in dependencies, name);
      return dependencies[name];
    }, exports);
    return exports as T;
  };
  type Session = { id: string; studentId: string; credential: { mustChangePassword: boolean; student: { serviceType: string; workspaceId: string } } };
  let session: Session | null = null;
  let weight = 40;
  let queries = 0;
  const date = new Date(savedAt);
  const checkScope = (where: { studentId: string; student: { workspaceId: string } }) => {
    queries++;
    assert.equal(where.studentId, session?.studentId);
    assert.equal(where.student.workspaceId, session?.credential.student.workspaceId);
  };
  const loader = execute("../lib/unified-exercise-records.ts", {
    "server-only": {},
    "@/lib/exercise-name": { normalizeExerciseName },
    "@/lib/prisma": { prisma: {
      quickLog: { findMany: async ({ where }: { where: Parameters<typeof checkScope>[0] }) => {
        checkScope(where);
        return [{ id: "entry", exerciseName: "Sentadilla", date, createdAt: date, sets: 3, repetitions: 8, currentValue: weight, unit: "kg", feedback: null }];
      } },
      classWorkoutLog: { findMany: async ({ where }: { where: Parameters<typeof checkScope>[0] & { occurrence: { workspaceId: string } } }) => {
        checkScope(where);
        assert.deepEqual(where.occurrence, where.student);
        return [];
      } },
      workoutSession: { findMany: async ({ where }: { where: Parameters<typeof checkScope>[0] & { routine: { workspaceId: string } } }) => {
        checkScope(where);
        assert.deepEqual(where.routine, where.student);
        return [];
      } },
    } },
  });
  const { GET } = execute<{ GET: () => Promise<Response> }>("../app/api/portal/offline-exercises/route.ts", {
    "@/lib/portal-auth": { getPortalSession: async () => session },
    "@/lib/offline-classes": { saveLatestExercises },
    "@/lib/offline-training-types": { offlineScope },
    "@/lib/unified-exercise-records": loader,
  });
  assert.equal((await GET()).status, 401);
  session = { id: "session-a", studentId: "student-a", credential: { mustChangePassword: false, student: { serviceType: "MIXED", workspaceId: "workspace-a" } } };
  assert.equal((await GET()).status, 403);
  assert.equal(queries, 0);
  session.credential.student.serviceType = "CLASSES";
  const first = await GET();
  assert.equal(first.headers.get("cache-control"), "private, no-store");
  assert.equal(first.headers.get("x-bm-offline-scope"), offlineScope("student-a", "workspace-a", "session-a"));
  assert.deepEqual((await first.json()).exercises, [{ key: "sentadilla", name: "Sentadilla", date: "2026-11-07", weight: 40, unit: "kg", sets: 3, repetitions: 8 }]);
  weight = 32.5;
  session = { id: "session-b", studentId: "student-b", credential: { mustChangePassword: false, student: { serviceType: "CLASSES", workspaceId: "workspace-b" } } };
  const next = await GET();
  assert.equal(next.headers.get("x-bm-offline-scope"), offlineScope("student-b", "workspace-b", "session-b"));
  assert.equal((await next.json()).exercises[0].weight, 32.5);
  assert.equal(queries, 6);
});

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
