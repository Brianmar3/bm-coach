import assert from "node:assert/strict";
import test from "node:test";
import {
  argentinaDateKey,
  databaseDateKey,
  dateKeyToDatabase,
  effectiveNextDueDate,
  nextPaymentDueDate,
  paymentAccountStatus,
} from "../lib/payment-dates.ts";

test("un pago válido con vencimiento avanzado deja la cuenta al día", () => {
  assert.equal(paymentAccountStatus({
    dueDate: "2026-09-09",
    monthlyFee: 25_000,
    validPaymentCount: 1,
  }, "2026-08-11"), "AL_DIA");
});

test("un pago legacy reconcilia un vencimiento y snapshot que no avanzaron", () => {
  const nextDueDate = effectiveNextDueDate("2026-08-09", [{
    amount: 25_000,
    status: "PAGADO",
    paidDate: new Date("2026-08-11T12:00:00.000Z"),
    dueDate: new Date("2026-08-09T12:00:00.000Z"),
    nextDueDateSnapshot: new Date("2026-08-09T12:00:00.000Z"),
  } as never]);
  assert.equal(nextDueDate, "2026-09-09");
  assert.equal(paymentAccountStatus({ dueDate: nextDueDate, monthlyFee: 25_000, validPaymentCount: 1 }, "2026-08-11"), "AL_DIA");
});

test("el próximo vencimiento conserva el día mensual configurado", () => {
  assert.equal(nextPaymentDueDate("2026-08-09", "2026-08-11"), "2026-09-09");
  assert.equal(nextPaymentDueDate("", "2026-08-31"), "2026-09-30");
});

test("las fechas de pago no cambian de día al persistirse", () => {
  const stored = dateKeyToDatabase("2026-08-11");
  assert.equal(stored.toISOString(), "2026-08-11T12:00:00.000Z");
  assert.equal(databaseDateKey(stored), "2026-08-11");
  assert.equal(argentinaDateKey(new Date("2026-08-11T02:59:59.000Z")), "2026-08-10");
  assert.equal(argentinaDateKey(new Date("2026-08-11T03:00:00.000Z")), "2026-08-11");
});
