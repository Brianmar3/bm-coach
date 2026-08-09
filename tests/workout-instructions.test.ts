import assert from "node:assert/strict";
import test from "node:test";
import { separateWorkoutInstructions } from "../lib/workout-instructions.ts";

test("separa superseries explícitas de las indicaciones técnicas", () => {
  const result = separateWorkoutInstructions("Superserie: remo con mancuerna 12 reps\nMantener la espalda neutra");
  assert.deepEqual(result.structural, [{ label: "SUPERSERIE", text: "remo con mancuerna 12 reps" }]);
  assert.equal(result.technicalText, "Mantener la espalda neutra");
});

test("reconoce complementarios existentes sin inventar una relación temporal", () => {
  const result = separateWorkoutInstructions("+ isquios con banda roja 15\nMás caminata lateral con banda 10-10");
  assert.deepEqual(result.structural, [
    { label: "EJERCICIO COMPLEMENTARIO", text: "isquios con banda roja 15" },
    { label: "EJERCICIO COMPLEMENTARIO", text: "caminata lateral con banda 10-10" },
  ]);
  assert.equal(result.technicalText, "");
});

test("conserva observaciones puramente técnicas para el bloque Indicaciones", () => {
  const result = separateWorkoutInstructions("El peso marcado salieron 10rp");
  assert.deepEqual(result.structural, []);
  assert.equal(result.technicalText, "El peso marcado salieron 10rp");
});

test("admite biserie, triserie y circuito y evita duplicados", () => {
  const result = separateWorkoutInstructions("Biserie - curl 12\nTriserie: vuelos 10\nCircuito abdominal\nBiserie: curl 12");
  assert.deepEqual(result.structural, [
    { label: "BISERIE", text: "curl 12" },
    { label: "TRISERIE", text: "vuelos 10" },
    { label: "CIRCUITO", text: "abdominal" },
  ]);
});
