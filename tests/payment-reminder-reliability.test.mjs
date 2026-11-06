import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url), ts = require("typescript");
function loadService(file, overrides) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const record = { exports: {} }; cache.set(file, record);
    const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function("require", "module", "exports", code)(name => {
      if (name in overrides) return overrides[name];
      if (name === "server-only") return {};
      if (!name.startsWith("@/") && !name.startsWith(".")) return require(name);
      const base = name.startsWith("@/") ? path.resolve(name.slice(2)) : path.resolve(path.dirname(file), name);
      return load([base + ".ts", base].find(existsSync));
    }, record, record.exports);
    return record.exports;
  }
  return load(file);
}
const date = value => new Date(value + "T00:00:00Z");
const obligation = (id, studentId, due, period) => ({ id, studentId, dueDate: date(due), period: date(period), expectedAmount: 100, status: "PENDING", balance: 100, student: { data: { status: "activo" } } });

test("cruce de mes agrupa pagos por alumno y período, conserva parcial y evita completo", async () => {
  const obligations = [obligation("o1", "a", "2026-11-02", "2026-11-01"), obligation("o2", "b", "2026-10-30", "2026-10-01")];
  const notifications = new Map(); let query;
  const db = {
    monthlyStudentObligation: { findMany: async args => { query = args; return obligations; } },
    studentPayment: { groupBy: async () => [{ studentId: "a", billingPeriod: date("2026-11-01"), _sum: { amount: 40 } }, { studentId: "a", billingPeriod: date("2026-10-01"), _sum: { amount: 999 } }, { studentId: "b", billingPeriod: date("2026-10-01"), _sum: { amount: 100 } }] },
    studentNotification: { findUnique: async ({ where }) => notifications.get(where.eventKey), create: async ({ data }) => {
      if (notifications.has(data.eventKey)) throw new (require("@prisma/client").Prisma.PrismaClientKnownRequestError)("duplicate", { code: "P2002", clientVersion: "test" });
      notifications.set(data.eventKey, data); return data;
    } },
  };
  const service = loadService("lib/payment-notifications.ts", { "@/lib/prisma": { prisma: db }, "@/lib/push-notifications": {}, "@/lib/student-reminder-delivery": { persistReminderEvent: async input => { await db.studentNotification.create({ data: input }); return true; } } });
  const result = await service.createPaymentReminders("2026-10-30");
  assert.deepEqual(query.where.dueDate.in.map(d => d.toISOString().slice(0, 10)), ["2026-10-30", "2026-11-02"]);
  assert.equal(query.where.period, undefined);
  assert.equal(result.length, 1); assert.equal(result[0].studentId, "a"); assert.ok(result[0].message.includes("60"));
  assert.equal((await service.createPaymentReminders("2026-10-30")).length, 0);
  assert.ok(result[0].eventKey.includes("o1:2026-11-02:"));
});

test("pago completo resuelve sólo sus avisos; parcial sigue pendiente y conserva registros", async () => {
  for (const amount of [40, 100]) {
    let updated;
    const db = {
      studentNotification: { findMany: async args => { assert.equal(args.where.studentId, "a"); return [{ id: "n", message: "Vencimiento original", eventKey: "payment-reminder:o1:2026-11-02:three_days" }]; }, updateMany: async args => { updated = args; } },
      studentRecord: { findUnique: async () => ({ data: { status: "activo", dueDate: "2026-12-02" } }) },
      monthlyStudentObligation: { findMany: async args => { assert.equal(args.where.studentId, "a"); return [obligation("o1", "a", "2026-11-02", "2026-11-01")]; } },
      studentPayment: { groupBy: async args => { assert.equal(args.where.studentId, "a"); return [{ billingPeriod: date("2026-11-01"), _sum: { amount } }]; } },
    };
    const state = loadService("lib/payment-reminder-state.ts", {});
    await state.resolveStudentPaymentReminders(db, "a");
    assert.equal(Boolean(updated), amount === 100);
    if (updated) { assert.equal(updated.where.studentId, "a"); assert.equal(updated.data.title, "Recordatorio resuelto"); assert.ok(updated.data.readAt); }
  }
});

test("renovación resuelve aviso de perfil antiguo sin borrar su clave", async () => {
  let updated;
  const state = loadService("lib/payment-reminder-state.ts", {});
  await state.resolveStudentPaymentReminders({
    studentNotification: { findMany: async () => [{ id: "n", eventKey: "service-expiration:a:2026-11-02:DUE_TODAY" }], updateMany: async args => { updated = args; } },
    studentRecord: { findUnique: async () => ({ data: { status: "activo", dueDate: "2026-12-02" } }) },
    monthlyStudentObligation: { findMany: async () => [] }, studentPayment: { groupBy: async () => [] },
  }, "a");
  assert.deepEqual(updated.where.id.in, ["n"]); assert.equal(updated.data.eventKey, undefined);
});

test("dedupe entre circuitos sólo para coincidencia no ambigua de alumno y fecha", async () => {
  const state = loadService("lib/payment-reminder-state.ts", {});
  for (const count of [0, 1, 2]) {
    assert.equal(await state.hasMatchingPaymentObligation({ studentRecord: { findUnique: async () => ({ workspaceId: "bm", serviceType: "CLASSES", data: { plan: "2 días", dueDate: "2026-11-02" } }) }, monthlyStudentObligation: { count: async ({ where }) => {
      assert.equal(where.studentId, "a"); assert.equal(where.dueDate.toISOString().slice(0, 10), "2026-11-02"); return count;
    } } }, "a", "2026-11-02"), count === 1);
  }
});

test("error FCM no se transforma en éxito; cuota pagada antes del envío no se programa", async () => {
  const failure = { configured: true, delivered: false, results: [{ error: "messaging/server-unavailable" }] };
  const candidate = { studentId: "a", dueDate: "2026-11-02", eventKey: "service-expiration:a:2026-11-02:DUE_TODAY", title: "vence", message: "vence" };
  const db = { studentRecord: { findUnique: async () => ({ data: {} }), findFirst: async () => ({ id: "a", data: { status: "activo", dueDate: "2026-11-02" } }) }, monthlyStudentObligation: { count: async () => 0 } };
  const service = loadService("lib/service-expiration-notifications.ts", { "@/lib/prisma": { prisma: db }, "@/lib/native-push-notifications": { sendStudentNativePush: async () => failure } });
  assert.deepEqual(await service.sendServiceExpirationReminder(candidate, "2026-11-02"), failure);
  let guard;
  const payments = loadService("lib/payment-notifications.ts", { "@/lib/prisma": { prisma: {
    monthlyStudentObligation: { findFirst: async () => obligation("o1", "a", new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date()), "2026-11-01") },
    studentPayment: { aggregate: async () => ({ _sum: { amount: 100 } }) },
  } }, "@/lib/push-notifications": { sendStudentPush: async (_id, _message, callback) => { guard = callback; } } });
  await payments.sendPaymentReminderPush({ ...candidate, obligationId: "o1", dueDate: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date()) });
  assert.equal(await guard(), false);
});

test("modo anterior genera cuota y servicio sin necesitar las tablas de la cola", async () => {
  const created = [];
  const db = {
    monthlyStudentObligation: { findMany: async () => [obligation("o1", "a", "2026-11-02", "2026-11-01")] },
    studentRecord: { findMany: async () => [{ id: "b", data: { status: "activo", dueDate: "2026-11-02" }, nativePushDevices: [{ id: "d" }] }] },
    studentPayment: { groupBy: async () => [] },
    studentNotification: { findUnique: async () => null, create: async ({ data }) => { created.push(data); return { id: "notice", ...data }; } },
  };
  Object.defineProperty(db, "studentReminderEvent", { get() { assert.fail("No consultar la cola con flag false"); } });
  const overrides = {
    "@/lib/prisma": { prisma: db }, "@/lib/push-notifications": {}, "@/lib/native-push-notifications": {},
    "@/lib/student-reminder-delivery": { persistReminderEvent: () => assert.fail("No persistir cola deshabilitada") },
    "@/lib/payment-reminder-state": { resolveStudentPaymentReminders: async () => {}, hasMatchingPaymentObligation: async () => false },
  };
  const payments = loadService("lib/payment-notifications.ts", overrides);
  const services = loadService("lib/service-expiration-notifications.ts", overrides);
  assert.equal((await payments.createPaymentReminders("2026-10-30", false)).length, 1);
  assert.equal((await services.createServiceExpirationReminders("2026-10-30", false)).length, 1);
  assert.deepEqual(created.map(item => item.type), ["PAYMENT", "REMINDER"]);
});
