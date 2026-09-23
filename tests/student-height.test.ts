import assert from "node:assert/strict";
import test from "node:test";
import { bmiFromCentimeters, centimetersToStoredHeight, storedHeightToCentimeters } from "../lib/height.ts";

test("convierte altura almacenada en metros a centímetros sin migrar datos", () => {
  assert.equal(storedHeightToCentimeters(1.57), 157);
  assert.equal(storedHeightToCentimeters(1.66), 166);
  assert.equal(storedHeightToCentimeters(1.8), 180);
  assert.equal(storedHeightToCentimeters(175), 175);
});

test("convierte la entrada de centímetros a metros y calcula IMC", () => {
  assert.equal(centimetersToStoredHeight(166), 1.66);
  assert.equal(bmiFromCentimeters(74.7, 166), "27.1");
});
