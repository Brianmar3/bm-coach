import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  onTimePaymentPointEventKey,
  paymentConfirmationEventKey,
  paymentReminderEventKey,
  paymentReminderKind,
  paymentWasOnTime,
} from "../lib/payment-notification-rules.ts";
import { buildValidPointEvents } from "../lib/point-event-rules.ts";

const paymentRoute = readFileSync(new URL("../app/api/pagos/route.ts", import.meta.url), "utf8");
const cronRoute = readFileSync(new URL("../app/api/cron/payment-reminders/route.ts", import.meta.url), "utf8");
const notificationService = readFileSync(new URL("../lib/payment-notifications.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../prisma/migrations/20260822100000_payment_notifications/migration.sql", import.meta.url), "utf8");

test("pagar antes o en el vencimiento suma puntos; pagar después no", () => {
  assert.equal(paymentWasOnTime("2026-08-09", "2026-08-10"), true);
  assert.equal(paymentWasOnTime("2026-08-10", "2026-08-10"), true);
  assert.equal(paymentWasOnTime("2026-08-11", "2026-08-10"), false);
});

test("cada pago usa claves estables para confirmación y puntaje", () => {
  assert.equal(paymentConfirmationEventKey("pay-1"), "payment-confirmation:pay-1");
  assert.equal(onTimePaymentPointEventKey("pay-1"), "payment-on-time:pay-1");
  const first = buildValidPointEvents({ onTimePayments: [{ id: "pay-1", date: "2026-08-10", description: "Pago" }] });
  const retry = buildValidPointEvents({ onTimePayments: [{ id: "pay-1", date: "2026-08-10", description: "Pago" }] });
  assert.deepEqual(first, retry);
  assert.equal(first[0]?.points, 5);
  assert.equal(first[0]?.sourceType, "PAYMENT");
});

test("los recordatorios existen sólo tres días antes y el día del vencimiento", () => {
  assert.equal(paymentReminderKind("2026-08-25", "2026-08-22"), "THREE_DAYS");
  assert.equal(paymentReminderKind("2026-08-25", "2026-08-25"), "DUE_TODAY");
  assert.equal(paymentReminderKind("2026-08-25", "2026-08-23"), null);
  assert.notEqual(
    paymentReminderEventKey("obligation-1", "THREE_DAYS"),
    paymentReminderEventKey("obligation-1", "DUE_TODAY"),
  );
});

test("el pago, su notificación y los puntos quedan en la transacción; push queda fuera", () => {
  const transaction = paymentRoute.slice(paymentRoute.indexOf("prisma.$transaction"), paymentRoute.indexOf("isolationLevel:"));
  assert.match(transaction, /studentPayment\.create/);
  assert.match(transaction, /persistPaymentConfirmation\(transaction, payment\)/);
  assert.doesNotMatch(transaction, /sendPaymentConfirmationPush/);
  assert.ok(paymentRoute.indexOf("sendPaymentConfirmationPush", paymentRoute.indexOf("isolationLevel:")) > 0);
  assert.match(notificationService, /studentNotification\.upsert/);
  assert.match(notificationService, /studentPointTransaction\.upsert/);
});

test("el cron exige secreto y la deduplicación está respaldada por índice único", () => {
  assert.match(cronRoute, /Bearer \$\{secret\}/);
  assert.match(cronRoute, /if \(!secret/);
  assert.match(notificationService, /paymentReminderEventKey/);
  assert.match(notificationService, /P2002/);
  assert.match(migration, /ADD COLUMN "eventKey" TEXT/);
  assert.match(migration, /CREATE UNIQUE INDEX "student_notifications_eventKey_key"/);
});

test("la migración es estrictamente aditiva", () => {
  assert.doesNotMatch(migration, /\bDROP\b|\bDELETE\b|\bUPDATE\b|\bTRUNCATE\b/i);
  assert.match(migration, /ADD VALUE IF NOT EXISTS 'PAYMENT'/);
  assert.match(migration, /ADD COLUMN "eventKey" TEXT/);
});
