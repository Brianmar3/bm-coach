import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { numericDraftValue, repetitionRangeDraft, serializedRepetitionRange } from "../lib/routine-numeric-draft.ts";

const page = readFileSync(new URL("../app/rutinas/page.tsx", import.meta.url), "utf8");

test("vaciar un input numérico no lo convierte en cero", () => {
  assert.equal(numericDraftValue(""), null);
  assert.equal(numericDraftValue("3"), 3);
  assert.equal(numericDraftValue("47.25"), 47.25);
});

test("las repeticiones conservan cada extremo vacío durante la edición", () => {
  assert.deepEqual(repetitionRangeDraft("10-12"), { minimum: "10", maximum: "12" });
  assert.equal(serializedRepetitionRange("", "12"), null);
  assert.equal(serializedRepetitionRange("8", "12"), "8-12");
  assert.equal(serializedRepetitionRange("8", "8"), "8");
});

test("series, peso, esfuerzo, descanso y bloques usan el buffer numérico", () => {
  for (const field of ["Series", "Peso inicial (kg)", "RIR/RPE objetivo", "Descanso (seg.)"]) {
    assert.match(page, new RegExp(`${field.replace(/[()/]/g, "\\$&")}<NumericDraftInput`));
  }
  assert.match(page, /function NumberField[\s\S]*?<NumericDraftInput/);
  assert.doesNotMatch(page, /update\("sets", Number\(event\.target\.value\)\)/);
});

test("series y repeticiones siguen siendo number required con límites nativos", () => {
  assert.match(page, /Series<NumericDraftInput required min="1" max="100"/);
  assert.match(page, /Reps mínimas<input required type="number" min="1" max="1000"/);
  assert.match(page, /Reps máximas<input required type="number" min="1" max="1000"/);
});

test("un obligatorio vacío no altera el valor persistible y queda bloqueado por validación nativa", () => {
  assert.match(page, /if \(nextValue !== null \|\| !required\) setValue\(nextValue\)/);
  assert.match(page, /if \(repetitions !== null\) update\("repetitions", repetitions\)/);
});
