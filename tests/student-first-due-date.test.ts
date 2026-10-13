import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { Prisma } from "@prisma/client";
import * as dates from "../lib/payment-dates.ts";
const nativeRequire = createRequire(import.meta.url);
function load(file: string, dependencies: Record<string, unknown>) {
  const exports: Record<string, (...args: unknown[]) => unknown> = {};
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "exports", code)((name: string) => name in dependencies ? dependencies[name] : nativeRequire(name), exports);
  return exports;
}
const enrollment = load("lib/student-enrollment.ts", {
  "server-only": {}, "@/lib/student-media": { studentProfilePhoto: () => "" }, "@/lib/trainer-workspace": {},
  "@/lib/height": { storedHeightToCentimeters: () => 0 }, "@/lib/prisma": {}, "@/lib/payment-dates": dates,
  "@/types/gestion": { isStudentType: () => true }, "@/lib/student-service": {}, "@/lib/coach-plans": {}, "@/lib/student-phone-identity": {},
});
function serialize(data: Record<string, unknown>) { return enrollment.serializeStudent({ id: "a", workspaceId: "wa", data, weeklyClasses: [], primarySchedule: null }) as { firstDueDate: string | null; dueDate: string }; }

test("A/F: sin fecha base, el historial legacy no se convierte en primer vencimiento", () => {
  assert.equal(serialize({}).firstDueDate, null);
  assert.deepEqual([serialize({ dueDate: "2026-08-25" }).firstDueDate, serialize({ dueDate: "2026-08-25" }).dueDate], [null, "2026-08-25"]);
});
test("B: la fecha base explícita se mantiene separada del vencimiento actual", () => {
  const value = serialize({ firstDueDate: "2026-03-25", dueDate: "2026-11-25" });
  assert.equal(value.firstDueDate, "2026-03-25");
  assert.equal(value.dueDate, "2026-11-25");
});
for (const initial of [null, "2026-03-25"]) test("C/D/E/F: pagos y anulaciones conservan la fecha base " + initial, async () => {
  let data: Record<string, unknown> = { firstDueDate: initial, dueDate: "2026-08-25", status: "activo" };
  const payments: Array<Record<string, unknown>> = [];
  const tx = {
    studentRecord: { findUnique: async () => ({ data }), update: async ({ data: next }: { data: { data: Record<string, unknown> } }) => { data = next.data; } },
    studentPayment: {
      findUnique: async ({ where }: { where: { id?: string; requestKey?: string } }) => payments.find(p => where.id ? p.id === where.id : p.requestKey === where.requestKey) ?? null,
      findFirst: async ({ where }: { where: { id?: { not: string }; amount?: number } }) => where.id ? payments.find(p => p.id !== where.id!.not && p.status === "PAGADO" && (p.createdAt as Date) > (payments.find(x => x.id === where.id!.not)!.createdAt as Date)) ?? null : null,
      create: async ({ data: input }: { data: Record<string, unknown> }) => { const p = { ...input, id: String(payments.length + 1), createdAt: new Date(1000 + payments.length * 1000), student: { data: { ...data } } }; payments.push(p); return p; },
      update: async ({ where, data: update }: { where: { id: string }; data: Record<string, unknown> }) => { const p = payments.find(p => p.id === where.id)!; Object.assign(p, update); return p; },
    },
  };
  const deps = {
    "@prisma/client": { Prisma }, "@/lib/prisma": { prisma: { $transaction: async (run: (value: unknown) => Promise<unknown>) => run(tx) } },
    "@/lib/trainer-workspace": { requireTrainerWorkspace: async () => ({ workspaceId: "wa" }), assertStudentInWorkspace: async () => {} },
    "@/lib/payment-dates": dates,
    "@/lib/payments": { PAYMENT_METHODS: ["Efectivo"], storedStudent: (d: unknown) => d, serializePayment: (p: unknown) => p, paymentDashboard: async () => ({}) },
    "@/lib/payment-notifications": { persistPaymentConfirmation: async () => {}, sendPaymentConfirmationPush: async () => {} },
  };
  const post = load("app/api/pagos/route.ts", deps).POST;
  const patch = load("app/api/pagos/[id]/route.ts", deps).PATCH;
  for (const [period, nextDueDate] of [["2026-09-01", "2026-10-25"], ["2026-10-01", "2026-11-25"]]) {
    const response = await post(new Request("https://test.local/api/pagos", { method: "POST", body: JSON.stringify({ studentId: "a", amount: 30000, method: "Efectivo", paidDate: "2026-09-01", billingPeriod: period, nextDueDate }) })) as Response;
    assert.equal(response.status, 201); assert.equal(data.firstDueDate, initial);
  }
  for (const id of ["2", "1"]) {
    const p = payments.find(p => p.id === id)!; p.student = { data: { ...data } };
    assert.equal((await patch(new Request("https://test.local/api/pagos/" + id, { method: "PATCH", body: JSON.stringify({ action: "void", reason: "Prueba" }) }), { params: Promise.resolve({ id }) }) as Response).status, 200);
    assert.equal(data.firstDueDate, initial);
  }
  assert.equal(data.dueDate, "2026-08-25");
  assert.ok(payments.every(p => p.status === "ANULADO"));
  assert.equal(serialize(data).firstDueDate, initial);
});
test("edición no usa el próximo vencimiento como primer vencimiento", () => {
  const page = readFileSync("app/alumnos/page.tsx", "utf8");
  assert.match(page, /form.firstDueDate \? showDate\(form.firstDueDate\) : "Sin definir"/);
  assert.match(readFileSync("app/api/alumnos/route.ts", "utf8"), /firstDueDate: input.dueDate \|\| null/);
  assert.doesNotMatch(readFileSync("app/api/alumnos/[id]/route.ts", "utf8"), /firstDueDate: input.dueDate/);
});

for (const dueDate of ["", "2026-03-25"]) test("alta persiste sólo la fecha base configurada: " + (dueDate || "sin definir"), async () => {
  let saved: Record<string, unknown> = {};
  const input = { phone: "", scheduleIds: [], status: "activo", dueDate, joinedAt: "2026-03-09" };
  const tx = { studentRecord: {
    create: async ({ data }: { data: { data: Record<string, unknown> } }) => { saved = data.data; return { id: "a" }; },
    findUniqueOrThrow: async () => ({ data: saved }),
  } };
  const post = load("app/api/alumnos/route.ts", {
    "@/lib/trainer-workspace": { requireTrainerWorkspace: async () => ({ workspaceId: "wa" }) },
    "@/lib/coached-students": {}, "@prisma/client": { Prisma },
    "@/lib/prisma": { prisma: { $transaction: async (run: (tx: unknown) => Promise<unknown>) => run(tx) } },
    "@/lib/student-enrollment": { getStudentPlanOptions: async () => [], parseStudentInput: () => ({ data: input }), normalizePhone: () => "", studentJsonData: enrollment.studentJsonData, serializeStudent: (record: { data: unknown }) => record.data },
    "@/lib/student-history": { recordInitialStudentHistory: async () => {} },
    "@/lib/trainer-plan-limits-server": { assertTrainerCanAddStudent: async () => {}, TrainerStudentLimitError: class extends Error {} },
  }).POST;
  assert.equal((await post(new Request("https://test.local/api/alumnos", { method: "POST", body: "{}" })) as Response).status, 201);
  assert.equal(saved.firstDueDate, dueDate || null);
  assert.equal(saved.dueDate, dueDate);
});
