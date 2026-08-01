import assert from "node:assert/strict";
import test from "node:test";
import {
  applyRepairPlan,
  buildRepairPlan,
  executeRepairMode,
  normalizePersonName,
  resolveRepairMode,
  summarizeRepair,
} from "../scripts/ranking-repair-core.mjs";

function fakePrisma(rows: Array<Record<string, unknown>>, failAt = -1) {
  let calls = 0;
  return {
    rows,
    async $transaction(callback: (transaction: unknown) => Promise<unknown>) {
      const snapshot = structuredClone(rows);
      const transaction = {
        studentPointTransaction: {
          async updateMany({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) {
            if (calls++ === failAt) throw new Error("fallo simulado");
            const row = rows.find((item) => item.id === where.id && item.active === where.active && (!where.occurredAt || (item.occurredAt as Date).getTime() === (where.occurredAt as Date).getTime()));
            if (!row) return { count: 0 };
            Object.assign(row, data);
            return { count: 1 };
          },
        },
      };
      try {
        return await callback(transaction);
      } catch (error) {
        rows.splice(0, rows.length, ...snapshot);
        throw error;
      }
    },
  };
}

const invalidChanges = [
  { action: "INVALIDATE", studentId: "lisi", student: "Lisi Gabbarini", transactionId: "a1", eventKey: "achievement:classes-1", points: 15 },
  { action: "INVALIDATE", studentId: "lisi", student: "Lisi Gabbarini", transactionId: "a2", eventKey: "achievement:seniority-30", points: 15 },
];

test("dry-run es explícito y no ejecuta la función de escritura", async () => {
  assert.equal(resolveRepairMode(["--dry-run"]), "dry-run");
  assert.throws(() => resolveRepairMode([]), /--dry-run/);
  const result = await executeRepairMode({ $transaction: () => { throw new Error("no debe escribir"); } }, "dry-run", invalidChanges);
  assert.deepEqual(result, { applied: 0, omitted: 0, errors: 0 });
});

test("apply aborta sin confirmación y se habilita con la confirmación exacta", () => {
  assert.throws(() => resolveRepairMode(["--apply"]), /--confirm-ranking-repair/);
  assert.equal(resolveRepairMode(["--apply", "--confirm-ranking-repair"]), "apply");
});

test("INVALIDATE se aplica una sola vez y conserva los puntos legítimos", async () => {
  const rows = [
    { id: "a1", active: true, points: 15, occurredAt: new Date("2026-08-01T12:00:00Z") },
    { id: "valid", active: true, points: 5, occurredAt: new Date("2026-07-29T12:00:00Z") },
  ];
  const prisma = fakePrisma(rows);
  assert.deepEqual(await applyRepairPlan(prisma, [invalidChanges[0]]), { applied: 1, omitted: 0, errors: 0 });
  assert.equal(rows[0].active, false);
  assert.equal(rows[1].active, true);
  assert.deepEqual(await applyRepairPlan(prisma, [invalidChanges[0]]), { applied: 0, omitted: 1, errors: 0 });
});

test("CORRECT_DATE conserva id, alumno, puntos y fuente", async () => {
  const original = { id: "date-1", active: true, studentId: "s1", points: 5, sourceId: "attendance-1", occurredAt: new Date("2026-08-01T01:00:00Z") };
  const rows = [original];
  const prisma = fakePrisma(rows);
  await applyRepairPlan(prisma, [{ action: "CORRECT_DATE", transactionId: "date-1", from: "2026-08-01T01:00:00.000Z", to: "2026-07-31T12:00:00.000Z" }]);
  assert.deepEqual({ id: rows[0].id, studentId: rows[0].studentId, points: rows[0].points, sourceId: rows[0].sourceId }, { id: "date-1", studentId: "s1", points: 5, sourceId: "attendance-1" });
  assert.equal((rows[0].occurredAt as Date).toISOString(), "2026-07-31T12:00:00.000Z");
});

test("la transacción revierte todas las acciones ante un error", async () => {
  const rows = [{ id: "a1", active: true }, { id: "a2", active: true }];
  await assert.rejects(() => applyRepairPlan(fakePrisma(rows, 1), invalidChanges), /fallo simulado/);
  assert.deepEqual(rows, [{ id: "a1", active: true }, { id: "a2", active: true }]);
});

test("el resumen por alumno informa los dos movimientos y 30 puntos de Lisi", () => {
  const summary = summarizeRepair([{ id: "a1" }, { id: "a2" }], invalidChanges);
  assert.equal(summary.invalidMovements, 2);
  assert.equal(summary.invalidPoints, 30);
  assert.deepEqual(summary.byStudent[0], { studentId: "lisi", student: "Lisi Gabbarini", invalidMovements: 2, invalidPoints: 30, datesToCorrect: 0 });
});

test("Román se encuentra con o sin tilde y puede no tener movimientos detectables", () => {
  assert.equal(normalizePersonName("Román Torrasca"), "roman torrasca");
  assert.equal(normalizePersonName("Roman Torrasca"), "roman torrasca");
  const plan = buildRepairPlan([], {}, (value: Date) => value);
  assert.deepEqual(plan, []);
});
