import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { currentFocusSet, focusProgress, focusCompletionTarget, workoutElapsedSeconds } from "../lib/workout-focus-flow.ts";
import { initialExerciseRestTimer, reduceExerciseRestTimer, exerciseRestSeconds } from "../lib/exercise-rest-timer.ts";
import type { PortalWorkoutSession } from "../types/portal.ts";

const portal = readFileSync(new URL("../componentes/portal-section.tsx", import.meta.url), "utf8");
const focus = readFileSync(new URL("../componentes/workout-focus.tsx", import.meta.url), "utf8");
const timer = readFileSync(new URL("../componentes/rest-timer-provider.tsx", import.meta.url), "utf8");
function session(flags = [false, false]) {
  return { date: "2026-10-13", startTime: "10:00", exercises: [{ exerciseId: "a", sets: flags.map((completed, i) => ({ completed, setNumber: i + 1 })) }, { exerciseId: "b", sets: [{ completed: false, setNumber: 1 }] }], blocks: [] } as unknown as PortalWorkoutSession;
}
test("inicio explícito no corre descanso ni persiste una sesión al sólo abrir enfoque", () => {
  assert.match(focus, /Iniciar entrenamiento/);
  assert.match(portal, /function startFocusWorkout\(\)/);
  assert.match(portal, /if \(!draft \|\| started\) return/);
  assert.match(portal, /focusExerciseId && !started \? edited : beginWith/);
  const enter = portal.slice(portal.indexOf("function focusExercise("), portal.indexOf("function exitFocus("));
  assert.doesNotMatch(enter, /beginWith|persistDraft/);
});
test("serie actual es la primera pendiente y se actualiza con el progreso real", () => {
  assert.equal(currentFocusSet(session().exercises[0]), 0);
  assert.equal(currentFocusSet(session([true, false]).exercises[0]), 1);
  assert.equal(currentFocusSet(session([true, true]).exercises[0]), -1);
});
test("progreso no avanza por navegar y cuenta bloques pendientes", () => {
  const draft = session([true, false]);
  assert.deepEqual(focusProgress(draft), { total: 3, complete: 1, percentage: 1 / 3 * 100 });
  draft.blocks = [{ blockType: "INTERVAL", result: { completed: false } }] as PortalWorkoutSession["blocks"];
  assert.equal(focusProgress(draft).percentage, 25);
});
test("última serie avanza a pendiente; último ejercicio devuelve cierre, no ID inexistente", () => {
  assert.equal(focusCompletionTarget(session(), "a"), undefined);
  const draft = session([true, true]);
  assert.equal(focusCompletionTarget(draft, "a"), "b");
  draft.exercises[1].sets[0].completed = true;
  assert.equal(focusCompletionTarget(draft, "b"), null);
  draft.exercises[0].sets[1].completed = false;
  assert.equal(focusCompletionTarget(draft, "b"), "a");
});
test("tiempo total reutiliza fecha/hora existente y sobrevive reload sin timer backend", () => {
  assert.equal(workoutElapsedSeconds(session(), Date.parse("2026-10-13T13:02:10Z")), 130);
  assert.equal(workoutElapsedSeconds({ date: "invalid", startTime: "" }, Date.now()), 0);
});
test("descanso automático usa segundos programados y pausa/reanuda sin descontar pausa", () => {
  let rest = reduceExerciseRestTimer(initialExerciseRestTimer("a", 90), "START", 1000);
  assert.equal(exerciseRestSeconds(rest, 11000), 80);
  rest = reduceExerciseRestTimer(rest, "PAUSE", 11000);
  assert.equal(exerciseRestSeconds(rest, 99000), 80);
  rest = reduceExerciseRestTimer(rest, "RESUME", 99000);
  assert.equal(exerciseRestSeconds(rest, 100000), 79);
  assert.match(portal, /exerciseRestTimer\.start\(exercise\.exerciseId, rest, exercise\.exerciseName\)/);
  assert.match(focus, /Saltar descanso/);
});
test("autoavance espera descanso/feedback y se cancela con navegación manual", () => {
  assert.match(portal, /rest\.status === "running" \|\| rest\.status === "paused"/);
  assert.match(portal, /after: new Date\(\)\.getTime\(\) \+ 600/);
  assert.match(portal, /navigationVersion === focusNavigationVersion\.current/);
  assert.match(portal, /window\.clearTimeout\(timeout\)/);
  assert.match(portal, /focusNavigationVersion\.current\+\+/);
});
test("cierre automático usa resumen existente sólo con todo completo y mantiene locks", () => {
  assert.match(portal, /focusProgress\(draft\)\.percentage === 100/);
  assert.match(portal, /sessionFinalizingRef\.current = true/);
  assert.match(portal, /saveLockRef\.current/);
  assert.match(portal, /focusActionLock\.current/);
  assert.match(portal, /setCompletionLocksRef\.current\.has\(lockKey\)/);
});
test("media/instrucciones opcionales, fallos seguros y lectura de Biblioteca independiente del flag", () => {
  assert.match(focus, /if \(!media\.libraryExerciseId\) return/);
  assert.match(focus, /available && !failed/);
  assert.match(focus, /onError=\{\(\) => setFailed\(true\)\}/);
  assert.match(focus, /instructions\.length > 0/);
  assert.match(focus, /Ver técnica/);
});
test("offline mantiene staging, sincronización existente y pausa restaurable", () => {
  assert.match(portal, /stageOfflineWorkout\(value\)/);
  assert.match(portal, /offlineWorkoutDraft\(routine\.id, dayId, weekKey\)/);
  assert.match(timer, /stored\.status === "paused"/);
  assert.match(timer, /remainingSeconds: timer\.remainingSeconds/);
});

test("inicio preciso local marca cero y no reutiliza un ancla de otra sesión", () => {
  const now = Date.parse("2026-10-13T13:00:45Z");
  assert.equal(workoutElapsedSeconds(session(), now, now), 0);
  assert.equal(workoutElapsedSeconds(session(), now + 10000, now), 10);
  assert.equal(workoutElapsedSeconds(session(), now, now - 90000), 45);
  assert.match(portal, /started-at/);
});
