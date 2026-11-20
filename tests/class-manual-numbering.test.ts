import assert from "node:assert/strict";
import test from "node:test";
import { renumberManualLines } from "../lib/class-manual-numbering.ts";

test("insertar y eliminar renglones mantiene la numeración con punto", () => {
  assert.deepEqual(renumberManualLines(["1. Hola", "2. ", "2. Hola"]), ["1. Hola", "2. ", "3. Hola"]);
  assert.deepEqual(renumberManualLines(["1. Hola", "3. Hola"]), ["1. Hola", "2. Hola"]);
});

test("la numeración con guion conserva formato y comienzo", () => {
  assert.deepEqual(renumberManualLines(["  4- Uno", "  5- ", "  5- Dos"]), ["  4- Uno", "  5- ", "  6- Dos"]);
});

test("el texto ordinario no se renumera", () => {
  assert.deepEqual(renumberManualLines(["3x12 sentadillas", "20/11/2026"]), ["3x12 sentadillas", "20/11/2026"]);
});
