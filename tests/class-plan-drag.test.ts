import assert from "node:assert/strict";
import test from "node:test";
import { canDropClassPlan, classPlanDropIndex } from "../lib/class-plan-drag.ts";

test("inserta antes o después sin perder la posición al mover dentro del día", () => {
  assert.equal(classPlanDropIndex(2, 0, false), 0);
  assert.equal(classPlanDropIndex(0, 2, true), 2);
  assert.equal(classPlanDropIndex(1, 1, false), 1);
  assert.equal(canDropClassPlan("2026-11-24", "2026-11-24"), true);
  assert.equal(canDropClassPlan("2026-11-24", "2026-11-25"), false);
});
