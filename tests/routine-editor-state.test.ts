import assert from "node:assert/strict";
import test from "node:test";
import { DraftHistory, draftSignature, reorderItems, transferBlock, transferExercise } from "../lib/routine-editor-state.ts";
import { createEmptyRoutineExerciseDraft } from "../lib/routine-exercise-draft.ts";
import type { ClassBaseRoutineDraft as Draft } from "../lib/class-template-base.ts";

function fixture(): Draft {
  const block = { id: "saved-block", clientId: "block", type: "STRENGTH" as const, name: "Piernas", order: 1, rounds: null, durationSeconds: null, workSeconds: null, restSeconds: null, restBetweenRoundsSeconds: null, targetRounds: null, instructions: "Controlar", exercises: [1, 2].map(order => ({ ...createEmptyRoutineExerciseDraft(order), id: `saved-${order}`, clientId: `exercise-${order}`, name: `Sentadilla ${order}`, sets: 4, repetitions: "6-8", restSeconds: 120 })) };
  return { name: "Semana", kind: "assigned", description: "", objective: "Fuerza", level: "intermedio", status: "borrador", startDate: "", durationWeeks: null, priorityMuscles: [], location: "", equipment: [], tags: [], studentIds: [], days: [1, 2].map(dayNumber => ({ clientId: `day-${dayNumber}`, dayNumber, name: `Día ${dayNumber}`, objective: "", warmup: "", observations: "", estimatedMinutes: null, blocks: dayNumber === 1 ? [block] : [], exercises: [] })) };
}
test("copiar/mover bloques entre días conserva prescripción sin reutilizar IDs de otra ubicación", () => {
  for (const copy of [true, false]) {
    const draft = fixture(), before = structuredClone(draft);
    const result = transferBlock(draft, "day-1", "day-2", "block", copy);
    assert.deepEqual(draft, before);
    assert.equal(result.days[0].blocks.length, copy ? 1 : 0);
    const inserted = result.days[1].blocks[0];
    assert.equal(inserted.id, undefined); assert.notEqual(inserted.clientId, "block");
    assert.equal(inserted.exercises[0].id, undefined);
    assert.equal(inserted.exercises[0].repetitions, "6-8"); assert.equal(inserted.exercises[0].restSeconds, 120);
  }
});
test("mover ejercicio crea un bloque compatible, renumera origen y mantiene destino independiente", () => {
  const result = transferExercise(fixture(), "day-1", "block", "exercise-1", "day-2");
  assert.deepEqual(result.days[0].blocks[0].exercises.map(item => item.order), [1]);
  const target = result.days[1].blocks[0];
  assert.equal(target.type, "STRENGTH"); assert.equal(target.exercises[0].sets, 4); assert.equal(target.exercises[0].id, undefined);
  const next = transferExercise(result, "day-1", "block", "exercise-2", "day-2");
  assert.equal(next.days[1].blocks.length, 1); assert.deepEqual(next.days[1].blocks[0].exercises.map(item => item.order), [1, 2]);
});
test("destinos inválidos no cambian la rutina; reordenar conserva identidad", () => {
  const draft = fixture();
  assert.equal(transferBlock(draft, "day-1", "day-1", "block", false), draft);
  assert.equal(transferExercise(draft, "day-1", "block", "missing", "day-2"), draft);
  const reordered = reorderItems(draft.days, 0, 1);
  assert.equal(reordered[1], draft.days[0]); assert.equal(reorderItems(draft.days, 0, -1), draft.days);
});
test("undo/redo recupera eliminación, movimiento y prescripción; una nueva edición invalida redo", () => {
  const draft = fixture(), history = new DraftHistory(draft);
  const moved = transferBlock(draft, "day-1", "day-2", "block", false);
  history.record(moved); assert.equal(history.undo(), draft); assert.equal(history.redo(), moved);
  history.undo(); history.record({ ...draft, name: "Otro" }); assert.equal(history.future.length, 0);
});
test("escritura agrupada por campo y límite de historial", () => {
  const history = new DraftHistory("", 3);
  history.record("P", "name", 100); history.record("Pi", "name", 200); history.record("Pierna", "name", 300);
  assert.equal(history.undo(), ""); assert.equal(history.redo(), "Pierna");
  for (let i = 0; i < 8; i++) history.record(String(i));
  assert.equal(history.past.length, 3);
});
test("firma de recuperación ignora IDs temporales pero detecta cambios de prescripción", () => {
  const draft = fixture(), copy = structuredClone(draft);
  copy.days[0].clientId = "new"; copy.days[0].blocks[0].id = "new-server";
  assert.equal(draftSignature(copy), draftSignature(draft));
  copy.days[0].blocks[0].exercises[0].sets = 5;
  assert.notEqual(draftSignature(copy), draftSignature(draft));
});

test("mover dentro del mismo día permite elegir bloque, preserva datos y rechaza tipos incompatibles", () => {
  const draft = fixture(), source = draft.days[0].blocks[0];
  draft.days[0].blocks.push({ ...source, clientId: "second", exercises: [] });
  draft.days[1].blocks.push({ ...source, clientId: "cardio", type: "INTERVAL", exercises: [] });
  const before = structuredClone(draft);
  const moved = transferExercise(draft, "day-1", "block", "exercise-1", "day-1", "second");
  assert.deepEqual(draft, before);
  assert.equal(moved.days[0].blocks[0].exercises.length, 1);
  assert.equal(moved.days[0].blocks[1].exercises[0].restSeconds, 120);
  assert.equal(moved.days[0].blocks[1].exercises[0].id, undefined);
  assert.equal(transferExercise(draft, "day-1", "block", "exercise-1", "day-2", "cardio"), draft);
  assert.equal(transferExercise(draft, "day-1", "block", "exercise-1", "day-1", "block"), draft);
  assert.equal(transferExercise(draft, "day-1", "block", "exercise-1", "day-2", "missing"), draft);
});

