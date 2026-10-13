import assert from "node:assert/strict";
import test from "node:test";
import { workoutBlockProgress, workoutDayProgress, workoutProgressPercentLabel } from "../lib/workout-day-progress.ts";
import { focusProgress } from "../lib/workout-focus-flow.ts";
import { emptyBlockResult } from "../lib/training-blocks.ts";
import { nextOfflineRecord } from "../lib/offline-training-types.ts";
import { syncOfflineQueue } from "../lib/offline-training-sync.ts";
import type { OfflineTrainingSnapshot } from "../lib/offline-training-types.ts";
import type { PortalWorkoutBlock, PortalWorkoutSession } from "../types/portal.ts";

function session(counts = [4, 3, 3, 3, 3, 4], completed = 0): PortalWorkoutSession {
  let remaining = completed;
  return { routineId: "routine", dayId: "day", date: "2026-10-13", startTime: "10:00", status: "en_progreso", exercises: counts.map((count, index) => ({ exerciseId: `e${index}`, sets: Array.from({ length: count }, (_, i) => ({ setNumber: i + 1, completed: remaining-- > 0 })) })), blocks: [] } as unknown as PortalWorkoutSession;
}
function block(type: PortalWorkoutBlock["blockType"]): PortalWorkoutBlock {
  return { blockId: "b", blockName: type, blockType: type, blockOrder: 1, configuration: {}, exercises: ["a", "b"].map(exerciseId => ({ exerciseId, name: exerciseId, targetType: "REPS", targetLabel: "10 reps", order: 1 })), result: emptyBlockResult() };
}

test("0/20 = 0%; una serie aumenta y el ejemplo 10/20 da 50%", () => {
  assert.equal(workoutDayProgress(session()).percentage, 0);
  assert.equal(workoutDayProgress(session(undefined, 1)).percentage, 5);
  assert.equal(workoutDayProgress(session(undefined, 10)).percentage, 50);
});
test("ejercicio parcial y completo contribuyen por series, sin ponderar todos los ejercicios igual", () => {
  assert.equal(workoutDayProgress(session([4, 16], 2)).percentage, 10);
  assert.equal(workoutDayProgress(session([4, 16], 4)).percentage, 20);
});
test("regresión: tres ejercicios completos en un único bloque no quedan en cero", () => {
  const draft = session(undefined, 10);
  draft.blocks = [block("STRENGTH")];
  assert.equal(draft.blocks[0].result.completed, false);
  assert.deepEqual(workoutDayProgress(draft), { total: 20, complete: 10, percentage: 50 });
});
test("desmarcar recalcula hacia abajo; todas las series dan 100%", () => {
  const draft = session([4, 3], 7);
  assert.equal(workoutDayProgress(draft).percentage, 100);
  draft.exercises[1].sets[2].completed = false;
  assert.equal(workoutDayProgress(draft).complete, 6);
  assert.ok(workoutDayProgress(draft).percentage < 100);
});
test("vacío y bloque de fuerza vacío no producen NaN", () => {
  const draft = session([]);
  draft.blocks = [block("STRENGTH")];
  assert.deepEqual(workoutDayProgress(draft), { total: 0, complete: 0, percentage: 0 });
});
test("todos los tipos conservan completion explícita y no inventan series", () => {
  for (const type of ["ROUNDS", "INTERVAL", "EMOM", "AMRAP", "FOR_TIME", "FREE", "MOBILITY"] as const) {
    const activity = block(type);
    const draft = session([]); draft.blocks = [activity];
    assert.equal(workoutDayProgress(draft).percentage, 0, type);
    activity.result.completed = true;
    assert.equal(workoutDayProgress(draft).percentage, 100, type);
    assert.equal(workoutDayProgress(draft).total, 1, type);
  }
});
test("movilidad/libre/circuito usan checklist único válido y checkpoint de finalización", () => {
  for (const type of ["MOBILITY", "FREE", "ROUNDS"] as const) {
    const activity = block(type);
    activity.result.completedExerciseIds = ["a", "a", "phantom"];
    assert.equal(workoutBlockProgress(activity), 1 / 3);
    activity.result.completedExerciseIds.push("b");
    assert.equal(workoutBlockProgress(activity), 2 / 3);
    activity.result.completed = true;
    assert.equal(workoutBlockProgress(activity), 1);
  }
});
test("rondas/minutos persistidos con objetivo acotado aportan sin cerrar prematuramente", () => {
  const rounds = block("ROUNDS"); rounds.configuration.rounds = 3; rounds.result.roundsCompleted = 2;
  assert.equal(workoutBlockProgress(rounds), .5);
  rounds.result.roundsCompleted = 100;
  assert.equal(workoutBlockProgress(rounds), .75);
  const emom = block("EMOM"); emom.configuration.durationSeconds = 180; emom.result.minutesCompleted = 2;
  assert.equal(workoutBlockProgress(emom), .5);
  emom.result.minutesCompleted = 999;
  assert.equal(workoutBlockProgress(emom), .75);
});
test("AMRAP/intervalos/for-time no convierten duración ni vueltas abiertas en porcentajes ficticios", () => {
  for (const type of ["AMRAP", "INTERVAL", "FOR_TIME"] as const) {
    const activity = block(type); activity.result.durationSeconds = 99999; activity.result.roundsCompleted = 999;
    assert.equal(workoutBlockProgress(activity), 0);
  }
});
test("sesión mixta no llega a 100% con bloques pendientes ni duplica las series de fuerza", () => {
  const draft = session([4], 4); draft.blocks = [block("STRENGTH"), block("MOBILITY")];
  assert.equal(workoutDayProgress(draft).percentage, 80);
  draft.blocks[1].result.completed = true;
  assert.equal(workoutDayProgress(draft).percentage, 100);
});
test("no >100%, NaN ni 100% visual por redondeo con checkpoint pendiente", () => {
  assert.equal(workoutProgressPercentLabel(99.9), 99);
  assert.equal(workoutProgressPercentLabel(100), 100);
  const activity = block("ROUNDS"); activity.configuration.rounds = 3;
  for (const value of [-1, NaN, Infinity, 100000]) {
    activity.result.roundsCompleted = value;
    const percentage = workoutDayProgress({ exercises: [], blocks: [activity] }).percentage;
    assert.ok(Number.isFinite(percentage) && percentage >= 0 && percentage < 100);
  }
});
test("Enfoque y vista normal usan exactamente el mismo helper", () => {
  assert.equal(focusProgress, workoutDayProgress);
});
test("reload, staging offline y sync conservan el mismo porcentaje sin duplicarlo", async () => {
  const snapshot = { scope: "scope", proof: "proof" } as OfflineTrainingSnapshot;
  const draft = session(undefined, 10);
  let record = nextOfflineRecord(undefined, snapshot, draft, "client");
  const restored = JSON.parse(JSON.stringify(record));
  assert.equal(workoutDayProgress(restored.payload).percentage, 50);
  const same = nextOfflineRecord(restored, snapshot, restored.payload, "another");
  assert.equal(same.revision, restored.revision);
  const store = { records: async () => [record], updateRecord: async (_key: string, update: (r: typeof record) => typeof record | undefined) => { record = update(record)!; } };
  let sends = 0;
  await syncOfflineQueue(snapshot, store, async () => { sends++; return { id: "server" }; });
  await syncOfflineQueue(snapshot, store, async () => { sends++; return { id: "server" }; });
  assert.equal(sends, 1);
  assert.equal(workoutDayProgress(record.payload).percentage, 50);
  assert.equal(record.pending, false);
});
