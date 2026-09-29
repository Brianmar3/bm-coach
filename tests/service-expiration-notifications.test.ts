import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { serviceExpirationCandidate, serviceExpirationEventKey, serviceExpirationReminderKind } from "../lib/service-expiration-rules.ts";

function source(path: string) { return readFileSync(new URL(`../${path}`, import.meta.url), "utf8"); }

test("T-3 y T-0 producen claves distintas y estables", () => {
  assert.equal(serviceExpirationReminderKind("2026-10-02", "2026-09-29"), "THREE_DAYS");
  assert.equal(serviceExpirationReminderKind("2026-09-29", "2026-09-29"), "DUE_TODAY");
  assert.equal(serviceExpirationEventKey("s1", "2026-10-02", "THREE_DAYS"), serviceExpirationEventKey("s1", "2026-10-02", "THREE_DAYS"));
  assert.notEqual(serviceExpirationEventKey("s1", "2026-10-02", "THREE_DAYS"), serviceExpirationEventKey("s1", "2026-10-02", "DUE_TODAY"));
});

test("renovación o cambio de fecha invalida el aviso anterior", () => {
  assert.ok(serviceExpirationCandidate({ studentId: "s1", status: "activo", dueDate: "2026-10-02", hasNativePushDevice: true, today: "2026-09-29" }));
  assert.equal(serviceExpirationCandidate({ studentId: "s1", status: "activo", dueDate: "2026-11-02", hasNativePushDevice: true, today: "2026-09-29" }), null);
  assert.notEqual(serviceExpirationEventKey("s1", "2026-10-02", "THREE_DAYS"), serviceExpirationEventKey("s1", "2026-11-02", "THREE_DAYS"));
});

test("alumno inactivo o sin dispositivo no recibe", () => {
  assert.equal(serviceExpirationCandidate({ studentId: "s1", status: "inactivo", dueDate: "2026-10-02", hasNativePushDevice: true, today: "2026-09-29" }), null);
  assert.equal(serviceExpirationCandidate({ studentId: "s1", status: "activo", dueDate: "2026-10-02", hasNativePushDevice: false, today: "2026-09-29" }), null);
});

test("fecha civil evita corrimientos UTC", () => {
  assert.equal(serviceExpirationReminderKind("2026-10-02", "2026-09-29"), "THREE_DAYS");
  assert.equal(serviceExpirationReminderKind("2026-10-02", "2026-09-28"), null);
});

test("dedupe persistente, revalidación, Firebase y tokens inválidos reutilizan infraestructura", () => {
  const reminders = source("lib/service-expiration-notifications.ts");
  const nativePush = source("lib/native-push-notifications.ts");
  const firebase = source("lib/firebase-admin.ts");
  assert.match(reminders, /studentNotification\.create/);
  assert.match(reminders, /isUniqueConflict/);
  assert.match(reminders, /current\.eventKey !== reminder\.eventKey/);
  assert.match(reminders, /sendStudentNativePush/);
  assert.match(nativePush, /lastError/);
  assert.match(firebase, /registration-token-not-registered/);
});

test("identidad de alumno impide mezclar alumnos o workspaces", () => {
  assert.notEqual(serviceExpirationEventKey("a", "2026-10-02", "THREE_DAYS"), serviceExpirationEventKey("b", "2026-10-02", "THREE_DAYS"));
  const reminders = source("lib/service-expiration-notifications.ts");
  assert.match(reminders, /studentId: record\.id/);
  assert.match(reminders, /sendStudentNativePush\(reminder\.studentId/);
});

test("cron reutiliza job server-side diario protegido", () => {
  const route = source("app/api/cron/payment-reminders/route.ts");
  assert.match(route, /CRON_SECRET/);
  assert.match(route, /createServiceExpirationReminders/);
  assert.match(source("vercel.json"), /0 11 \* \* \*/);
});
