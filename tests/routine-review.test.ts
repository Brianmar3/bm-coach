import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { routineReview } from "../lib/routine-review.ts";
import { routineValidationIssues, type RoutineInput } from "../lib/rutinas.ts";

const form = (): RoutineInput => ({ name: "Rutina", kind: "assigned", description: "", objective: "Fuerza", level: "principiante", status: "borrador", startDate: "", durationWeeks: null, priorityMuscles: [], location: "", equipment: [], tags: [], studentIds: [], days: [{ dayNumber: 1, name: "Día 1", objective: "", warmup: "", observations: "", estimatedMinutes: null, exercises: [], blocks: [{ type: "STRENGTH", name: "Bloque de fuerza", order: 1, rounds: null, durationSeconds: null, workSeconds: null, restSeconds: null, restBetweenRoundsSeconds: null, targetRounds: null, instructions: "", exercises: [{ name: "Sentadilla", muscleGroup: "Piernas", sets: 3, repetitions: "10", weight: null, effortType: "RIR", effortValue: 2, restSeconds: 90, observations: "", videoUrl: "", tempo: "", alternativeExercise: "", equipment: "", optional: false, targetType: "REPS", targetSeconds: null, targetRepetitions: "", targetDistance: "", targetSide: "", order: 1 }] }] }] });
test("válida lista para activar, sin inventar advertencia por asignación opcional", () => {
  const review = routineReview(form());
  assert.equal(review.canActivate, true);
  assert.equal(review.warnings.length, 0);
  assert.equal(review.summary, "Rutina lista para activar.");
});
test("uno o múltiples errores bloquean y conservan las reglas/keys originales", () => {
  const draft = form(); draft.days[0].blocks![0].exercises[0].muscleGroup = "";
  let review = routineReview(draft);
  assert.equal(review.canActivate, false);
  assert.equal(review.errors.length, 1);
  assert.equal(review.summary, "1 error por corregir");
  assert.equal(review.errors[0].location, "Día 1 · Bloque de fuerza · Ejercicio 1");
  draft.days[0].blocks![0].exercises[0].name = "";
  review = routineReview(draft);
  assert.equal(review.errors.length, 2);
  assert.deepEqual(review.errors.map(issue => ({ key: issue.key, message: issue.message, summary: issue.summary, dayNumber: issue.dayNumber })), routineValidationIssues(draft));
});
test("día/bloque vacío advierten sin bloquear si su configuración es válida", () => {
  const draft = form(); draft.days[0].blocks![0].exercises = [];
  const review = routineReview(draft);
  assert.equal(review.errors.length, 0);
  assert.equal(review.warnings.length, 2);
  assert.equal(review.canActivate, true);
  assert.match(review.summary, /puede activarse/);
});
test("errores y warnings se separan sin degradar errores del bloque vacío", () => {
  const draft = form(); draft.days[0].blocks![0].exercises = []; draft.days[0].blocks![0].name = "";
  const review = routineReview(draft);
  assert.equal(review.errors.length, 1);
  assert.equal(review.warnings.length, 2);
  assert.equal(review.canActivate, false);
});
test("ubicación global y día; review no modifica el draft", () => {
  const draft = form(); draft.name = ""; draft.days[0].name = "";
  const before = JSON.stringify(draft);
  const review = routineReview(draft);
  assert.equal(review.errors[0].location, "Datos de la rutina");
  assert.equal(review.errors[1].location, "Día 1");
  assert.equal(JSON.stringify(draft), before);
});
test("modal separa severidades, deshabilita CTA nativo y enlaza corrección existente", () => {
  const modal = readFileSync(new URL("../componentes/routine-review.tsx", import.meta.url), "utf8");
  const page = readFileSync(new URL("../app/rutinas/page.tsx", import.meta.url), "utf8");
  assert.match(modal, /data-severity="error"/);
  assert.match(modal, /data-severity="warning"/);
  assert.match(modal, /disabled=\{saving \|\| !review.canActivate\}/);
  assert.match(modal, /onClick=\{\(\) => correct\(issue\)\}/);
  assert.match(page, /showValidation\(routineValidationIssues/);
  assert.match(page, /focusRoutineValidationField\(issue.key\)/);
});
