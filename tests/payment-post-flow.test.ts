import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { databaseDateKey, dateKeyToDatabase, paymentAccountStatus } from "../lib/payment-dates.ts";

const api = readFileSync(new URL("../app/api/pagos/route.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/pagos/page.tsx", import.meta.url), "utf8");

test("el POST persiste exactamente el próximo vencimiento solicitado", () => {
  assert.match(page, /nextDueDate: form\.dueDate/);
  assert.match(api, /nextDueDate: string/);
  assert.match(api, /nextDueDateSnapshot: dateKeyToDatabase\(input\.nextDueDate\)/);
  assert.match(api, /dueDate: input\.nextDueDate/);
  assert.doesNotMatch(api, /input\.dueDate|nextPaymentDueDate/);
});

test("pago y vencimiento se escriben en la misma transacción y sólo para el alumno elegido", () => {
  const transaction = api.slice(api.indexOf("prisma.$transaction"), api.indexOf("isolationLevel:"));
  assert.match(transaction, /transaction\.studentPayment\.create/);
  assert.match(transaction, /transaction\.studentRecord\.update/);
  assert.match(transaction, /where: \{ id: input\.studentId \}/);
  assert.doesNotMatch(transaction, /updateMany|studentRecord\.findMany/);
  assert.ok(transaction.indexOf("studentPayment.create") < transaction.indexOf("studentRecord.update"));
});

test("un vencimiento anterior al pago se rechaza antes de abrir la transacción", () => {
  const validation = api.indexOf("input.nextDueDate < input.paidDate");
  const transaction = api.indexOf("prisma.$transaction");
  assert.ok(validation >= 0 && validation < transaction);
  assert.match(api, /El próximo vencimiento no puede ser anterior a la fecha de pago/);
});

test("el duplicado se bloquea antes de crear o actualizar", () => {
  const transaction = api.slice(api.indexOf("prisma.$transaction"), api.indexOf("isolationLevel:"));
  const duplicate = transaction.indexOf("DUPLICATE_PAYMENT");
  assert.ok(duplicate >= 0);
  assert.ok(duplicate < transaction.indexOf("studentPayment.create"));
  assert.ok(duplicate < transaction.indexOf("studentRecord.update"));
});

test("Pagos cierra el modal, usa la respuesta y distingue un refetch fallido", () => {
  assert.match(page, /setData\(saved\.dashboard\);\s*setForm\(null\)/);
  assert.match(page, /apiRequest<PaymentDashboard>\("\/api\/pagos"/);
  assert.match(page, /registrado\. No pudimos actualizar la lista/);
  assert.match(page, /paymentSaveLock\.current/);
});

test("la lógica histórica estable determina vencido y al día sin reconciliación global", () => {
  assert.equal(paymentAccountStatus({ dueDate: "2026-08-09", monthlyFee: 25_000, validPaymentCount: 1 }, "2026-08-11"), "VENCIDA");
  assert.equal(paymentAccountStatus({ dueDate: "2026-09-09", monthlyFee: 25_000, validPaymentCount: 1 }, "2026-08-11"), "AL_DIA");
  assert.doesNotMatch(`${api}\n${page}`, /reconcilePaymentStatus|deriveEffectiveDueDateFromHistory|effectiveNextDueDate/);
});

test("09/09/2026 conserva el mismo día en la base", () => {
  assert.equal(databaseDateKey(dateKeyToDatabase("2026-09-09")), "2026-09-09");
});
