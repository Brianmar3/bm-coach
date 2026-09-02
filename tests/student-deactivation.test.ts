import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("app/api/alumnos/[id]/route.ts", "utf8");

test("student deletion is a reversible deactivation that preserves the record", () => {
  assert.doesNotMatch(route, /studentRecord\.delete/);
  assert.match(route, /status: "inactivo", lifecycleStatus: "inactivo"/);
  assert.match(route, /weeklyClassAssignment\.updateMany/);
  assert.match(route, /trainingRoutineAssignment\.updateMany/);
  assert.match(route, /studentPortalCredential\.updateMany/);
});

test("student deactivation voids only future unpaid obligations", () => {
  assert.match(route, /period: \{ gt: currentPeriod \}/);
  assert.match(route, /paidAmount: 0/);
  assert.match(route, /status: \{ in: \["PENDING", "OVERDUE"\] \}/);
  assert.match(route, /data: \{ status: "VOID", balance: 0 \}/);
});
