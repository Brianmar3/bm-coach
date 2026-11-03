import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url); const ts = require("typescript");
function loader(overrides) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file); if (cache.has(file)) return cache.get(file).exports;
    const record = { exports: {} }; cache.set(file, record);
    const source = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    function localRequire(name) {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name === "server-only") return {};
      if (!name.startsWith("@/") && !name.startsWith(".")) return require(name);
      const base = name.startsWith("@/") ? path.resolve(name.slice(2)) : path.resolve(path.dirname(file), name);
      return load([base + ".ts", base + ".tsx", base].find(existsSync));
    }
    new Function("require", "module", "exports", source)(localRequire, record, record.exports);
    return record.exports;
  }
  return load;
}
const student = { id: "a", workspaceId: "bm", serviceType: "CLASSES", data: { firstName: "Ana", lastName: "Pérez", status: "activo", plan: "Clases", monthlyFee: 30000, dueDate: "2026-12-01" } };
function payment(id, paidDate, amount, billingPeriod = "2026-11-01", extra = {}) {
  return { id, studentId: "a", student, amount, paidDate: paidDate ? new Date(paidDate) : null, billingPeriod: new Date(billingPeriod + "T00:00:00Z"), createdAt: new Date("2026-11-03T15:00:00Z"), dueDate: new Date("2026-11-01T12:00:00Z"), method: "Transferencia", status: "PAGADO", notes: "Original", concept: "Cuota", ...extra };
}
function fixture(rows, obligations = [], closed = null) {
  const writes = [];
  function match(where, row) {
    if (where.student?.workspaceId && where.student.workspaceId !== row.student.workspaceId) return false;
    if (where.studentId && where.studentId !== row.studentId) return false;
    if (where.status && where.status !== row.status) return false;
    if (where.billingPeriod && where.billingPeriod.toISOString().slice(0, 10) !== row.billingPeriod?.toISOString().slice(0, 10)) return false;
    for (const field of ["paidDate", "createdAt"]) if (where[field] && (!row[field] || row[field] < where[field].gte || row[field] >= where[field].lt)) return false;
    return true;
  }
  const db = {
    monthlySummary: { findUnique: async ({ where }) => { assert.equal(where.workspaceId_year_month.workspaceId, "bm"); return closed; } },
    studentRecord: {
      findMany: async ({ where, include }) => { assert.equal(where.workspaceId, "bm"); return include?.payments ? [{ ...student, payments: rows.filter(row => row.studentId === "a") }] : [student]; },
      findUnique: async ({ where }) => where.id === "a" && where.workspaceId === "bm" ? { id: "a" } : null,
    },
    studentPayment: {
      findMany: async ({ where }) => { assert.ok(where.student?.workspaceId === "bm" || where.studentId === "a"); return rows.filter(row => match(where, row)); },
      aggregate: async ({ where }) => { assert.equal(where.student.workspaceId, "bm"); return { _sum: { amount: rows.filter(row => match(where, row)).reduce((sum, row) => sum + row.amount, 0) } }; },
    },
    monthlyStudentObligation: { findMany: async ({ where }) => { assert.equal(where.student.workspaceId, "bm"); return obligations.filter(item => item.period === where.period.toISOString().slice(0, 10)); } },
    classAttendance: { findMany: async () => [] }, physicalEvaluation: { findMany: async () => [] }, workoutSession: { findMany: async () => [] }, studentStatusEvent: { findMany: async () => [] }, studentMembershipHistory: { findMany: async () => [] },
    $transaction: async () => { writes.push("transaction"); throw Error("Financial verification must not write"); },
  };
  const load = loader({ "@/lib/prisma": { prisma: db }, "@/lib/trainer-workspace": { requireTrainerWorkspace: async () => ({ workspaceId: "bm" }) } });
  return { load, writes, build: load("lib/monthly-summary.ts").buildMonthlySummary, payments: load("lib/payments.ts"), dates: load("lib/payment-dates.ts") };
}

for (const [clock, expectedMonth] of [["2026-10-31T20:00:00-03:00", 10], ["2026-10-31T22:00:00-03:00", 10], ["2026-10-31T23:59:00-03:00", 10], ["2026-11-01T00:01:00-03:00", 11]]) {
  test(`fecha real ${clock}: resumen, semanas e historial coinciden`, async () => {
    const row = payment("receipt", clock, 30000); const f = fixture([row]);
    const october = await f.build({ year: 2026, month: 10 }, "bm"); const november = await f.build({ year: 2026, month: 11 }, "bm");
    assert.equal(october.summary.collectedTotal, expectedMonth === 10 ? 30000 : 0);
    assert.equal(november.summary.collectedTotal, expectedMonth === 11 ? 30000 : 0);
    const expectedDate = expectedMonth === 10 ? "2026-10-31" : "2026-11-01";
    const selected = expectedMonth === 10 ? october : november;
    assert.equal(selected.weeklyCollections.reduce((sum, week) => sum + week.total, 0), 30000);
    assert.equal(selected.weeklyCollections.flatMap(week => week.payments)[0].paidDate, expectedDate);
    assert.deepEqual(selected.detailRows[0].paymentDates, [expectedDate]);
    assert.equal(f.payments.serializePayment(row).paidDate, expectedDate);
    assert.equal(f.payments.serializePayment(row).billingPeriod, "2026-11-01");
    assert.equal(f.writes.length, 0);
  });
}

test("totales de octubre/noviembre no dependen de cuota ni creación; no incluyen anulados, sin fecha o workspace ajeno", async () => {
  const f = fixture([
    payment("20", "2026-10-31T20:00:00-03:00", 30000), payment("22", "2026-10-31T22:00:00-03:00", 20000), payment("2359", "2026-10-31T23:59:00-03:00", 10000, "2026-09-01"),
    payment("nov", "2026-11-01T00:01:00-03:00", 40000, "2026-10-01"), payment("manual", "2026-10-31T12:00:00Z", 5000, "2026-12-01"),
    payment("void", "2026-10-31T12:00:00Z", 999, "2026-11-01", { status: "ANULADO" }), payment("missing", null, 888),
    payment("foreign", "2026-10-31T12:00:00Z", 777, "2026-11-01", { student: { ...student, workspaceId: "other" } }),
  ]);
  const october = await f.build({ year: 2026, month: 10 }, "bm"); const november = await f.build({ year: 2026, month: 11 }, "bm");
  assert.equal(october.summary.collectedTotal, 65000); assert.equal(october.summary.paymentCount, 4);
  assert.equal(november.summary.collectedTotal, 40000); assert.equal(november.summary.paymentCount, 1);
  assert.equal(october.weeklyCollections.at(-1).total, 65000); assert.equal(october.weeklyCollections.at(-1).label, "29–31 oct");
  assert.equal(november.weeklyCollections.some(week => week.kind === "OUTSIDE_PERIOD"), false);
  assert.ok(november.warnings.some(warning => warning.includes("no tienen fecha real")));
  assert.equal(f.writes.length, 0);
});

test("caja separada de cuotas: pagar noviembre en octubre no crea deuda ficticia ni liquida octubre", async () => {
  const obligations = [10, 11].map(month => ({ studentId: "a", period: `2026-${month}-01`, expectedAmount: 30000, dueDate: new Date(`2026-${month}-10T12:00:00Z`), studentNameSnapshot: "Ana Pérez", planNameSnapshot: "Clases", serviceSnapshot: "CLASSES", frequencySnapshot: 2 }));
  const f = fixture([payment("advance", "2026-10-31T22:00:00-03:00", 30000)], obligations);
  const october = await f.build({ year: 2026, month: 10 }, "bm"); const november = await f.build({ year: 2026, month: 11 }, "bm");
  assert.equal(october.summary.collectedTotal, 30000); assert.equal(october.summary.pendingTotal, 30000); assert.equal(october.detailRows[0].balance, 30000);
  assert.equal(november.summary.collectedTotal, 0); assert.equal(november.summary.pendingTotal, 0); assert.equal(november.detailRows[0].paymentStatus, "Pagado");
  assert.equal(november.reconciliation.collectedTotal, 30000); assert.equal(november.summary.collectionPercentage, 100);
});

test("panel Pagos usa las mismas fronteras horarias y fecha del último cobro", async () => {
  const f = fixture([payment("last", "2026-10-31T22:00:00-03:00", 30000)]);
  const dashboard = await f.payments.paymentDashboard();
  const month = dashboard.asOf.slice(0, 7);
  assert.equal(dashboard.summary.collectedThisMonth, month === "2026-10" ? 30000 : 0);
  assert.equal(dashboard.students[0].lastPaymentDate, "2026-10-31");
});

test("fecha manual conserva el día en Argentina y cambiar la cuota no la altera", () => {
  const f = fixture([]); const stored = f.dates.dateKeyToDatabase("2026-10-31");
  assert.equal(f.dates.argentinaDateKey(stored), "2026-10-31");
  for (const period of ["2026-09-01", "2026-11-01", "2026-12-01"]) assert.equal(f.payments.serializePayment(payment("manual", stored.toISOString(), 30000, period)).paidDate, "2026-10-31");
  const page = readFileSync("app/pagos/page.tsx", "utf8");
  assert.equal((page.match(/const paidDate = argentinaDateKey\(\)/g) ?? []).length, 2);
  assert.match(page, /paidDate: event.target.value/); assert.match(page, /billingPeriod: `\$\{event.target.value\}-01`/);
  const edit = readFileSync("app/api/pagos/[id]/route.ts", "utf8");
  assert.match(edit, /paidDate: dateKeyToDatabase\(input.paidDate\)/);
  const update = edit.slice(edit.indexOf("return transaction.studentPayment.update"), edit.indexOf("isolationLevel:"));
  assert.doesNotMatch(update, /dueDate:|studentId:|createdAt:/);
});

test("historial individual consulta sólo al alumno autorizado y muestra la fecha local", async () => {
  const f = fixture([payment("history", "2026-10-31T22:00:00-03:00", 30000)]);
  const GET = f.load("app/api/pagos/route.ts").GET;
  const own = await GET(new Request("https://bm.test/api/pagos?studentId=a"));
  assert.equal(own.status, 200); assert.equal((await own.json())[0].paidDate, "2026-10-31");
  assert.equal((await GET(new Request("https://bm.test/api/pagos?studentId=foreign"))).status, 404);
});

test("API real en memoria: fecha manual independiente de cuota y corrección individual preservan importe, alumno, método y vencimientos", async () => {
  const f = fixture([]); let record;
  const transaction = {
    studentRecord: { findUnique: async () => student, update: async () => student },
    studentPayment: {
      findFirst: async () => null,
      findUnique: async ({ where }) => { assert.equal(where.student.workspaceId, "bm"); return record; },
      create: async ({ data }) => { record = { ...payment("manual-api", "2026-10-31T12:00:00Z", 30000), ...data }; return record; },
      update: async ({ where, data }) => { assert.equal(where.student.workspaceId, "bm"); record = { ...record, ...data }; return record; },
    },
  };
  const local = loader({
    "@/lib/prisma": { prisma: { $transaction: async callback => callback(transaction) } },
    "@/lib/trainer-workspace": { requireTrainerWorkspace: async () => ({ workspaceId: "bm" }), assertStudentInWorkspace: async (id, workspace) => { assert.equal(id, "a"); assert.equal(workspace, "bm"); } },
    "@/lib/payments": { ...f.payments, paymentDashboard: async () => ({ asOf: "2026-11-03" }) },
    "@/lib/payment-notifications": { persistPaymentConfirmation: async () => {}, sendPaymentConfirmationPush: async () => {} },
  });
  const POST = local("app/api/pagos/route.ts").POST;
  const response = await POST(new Request("https://bm.test/api/pagos", { method: "POST", body: JSON.stringify({ studentId: "a", amount: 30000, paidDate: "2026-10-31", billingPeriod: "2026-11-01", nextDueDate: "2026-12-01", method: "Transferencia", notes: "Original" }) }));
  assert.equal(response.status, 201);
  const created = (await response.json()).payment;
  assert.equal(created.paidDate, "2026-10-31"); assert.equal(created.billingPeriod, "2026-11-01");
  // Model an old incorrect date, then exercise the existing single-record edit API.
  record.paidDate = new Date("2026-11-01T12:00:00Z");
  const before = structuredClone(record);
  const PUT = local("app/api/pagos/[id]/route.ts").PUT;
  const edited = await PUT(new Request("https://bm.test/api/pagos/manual-api", { method: "PUT", body: JSON.stringify({ amount: 30000, paidDate: "2026-10-31", billingPeriod: "2026-11-01", method: "Transferencia", notes: "Original · Corrección autorizada de fecha efectiva: 01/11/2026 → 31/10/2026" }) }), { params: Promise.resolve({ id: "manual-api" }) });
  assert.equal(edited.status, 200); assert.equal((await edited.json()).payment.paidDate, "2026-10-31");
  for (const field of ["id", "studentId", "amount", "method", "billingPeriod", "dueDate", "nextDueDateSnapshot", "createdAt", "status"]) assert.deepEqual(record[field], before[field], field);
  assert.ok(record.notes.startsWith(before.notes));
});

test("un cierre histórico conserva su snapshot y no se reescribe automáticamente", async () => {
  const snapshot = { metadata: { status: "CLOSED" }, summary: { collectedTotal: 123 } };
  const f = fixture([], [], { status: "CLOSED", snapshot });
  assert.deepEqual(await f.build({ year: 2026, month: 10 }, "bm"), snapshot); assert.equal(f.writes.length, 0);
});
