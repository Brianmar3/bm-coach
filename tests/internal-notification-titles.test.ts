import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const eventNotifications = read("lib/event-publication-notifications.ts");
const paymentNotifications = read("lib/payment-notifications.ts");
const nutritionNotifications = read("lib/nutrition-notifications.ts");
const nutritionNoteRoute = read("app/api/admin/alumnos/[id]/nutrition/route.ts");
const trainerNotifications = read("lib/trainer-notifications.ts");
const feedbackSources = [
  read("app/api/admin/alumnos/[id]/quick-logs/[logId]/feedback/route.ts"),
  read("app/api/admin/alumnos/[id]/exercise-records/[source]/[recordId]/feedback/route.ts"),
  read("app/api/seguimiento/route.ts"),
];

test("el portal del alumno usa títulos funcionales en las notificaciones existentes", () => {
  assert.match(eventNotifications, /const title = "Nuevo evento"/);
  assert.doesNotMatch(eventNotifications, /Nuevo evento en (?:BM Training|\$\{[^}]+\})/);
  assert.match(paymentNotifications, /studentNotification\.upsert\([\s\S]*?title: "Pago registrado"/);
  assert.match(nutritionNotifications, /studentNotification\.create\([\s\S]*?title: "Nueva actualización"/);
  assert.match(nutritionNoteRoute, /studentNotification\.create\([\s\S]*?title: "Nueva actualización"/);
  for (const source of feedbackSources) {
    assert.match(source, /studentNotification\.create\([\s\S]*?title: "Nueva devolución"/);
  }
});

test("el portal del entrenador usa la acción como título", () => {
  assert.match(
    trainerNotifications,
    /const internalTitle = input\.response === "GOING" \? "Asistencia confirmada" : "Nueva respuesta"/,
  );
  assert.match(
    trainerNotifications,
    /type: "WORKOUT_COMPLETED",[\s\S]*?title: "Rutina completada"/,
  );
});

test("los títulos de push preexistentes se conservan separados del título interno", () => {
  assert.match(paymentNotifications, /sendStudentPush\(payment\.studentId, \{\s*title: "Pago registrado ✅"/);
  assert.match(nutritionNotifications, /sendStudentPush\(studentId, \{\s*title: "Evaluación de nutrición actualizada"/);
  assert.match(trainerNotifications, /const pushTitle = "Respuesta de asistencia"/);
  assert.match(trainerNotifications, /payload: \{ title: content\.title/);
});

