import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildWorkoutCompletionNotification, isWorkoutTrainerNotificationEligible, workoutCompletionEventKey } from "../lib/workout-completion-notification.ts";

test("PERSONALIZED registra entrenamiento y resulta elegible", () => {
  assert.equal(isWorkoutTrainerNotificationEligible("PERSONALIZED"), true);
});

test("MIXED registra entrenamiento y resulta elegible", () => {
  assert.equal(isWorkoutTrainerNotificationEligible("MIXED"), true);
});

test("CLASSES registra entrenamiento y no resulta elegible", () => {
  assert.equal(isWorkoutTrainerNotificationEligible("CLASSES"), false);
});

test("copy usa únicamente los datos reales disponibles", () => {
  const notification = buildWorkoutCompletionNotification({ studentId: "student-1", sessionId: "session-1", serviceType: "PERSONALIZED", studentName: "Brian Martinez", sessionName: "Piernas A", durationMinutes: 48, exerciseCount: 12 });
  assert.equal(notification.title, "Brian Martinez registró un entrenamiento");
  assert.equal(notification.message, "Piernas A · 48 min · 12 ejercicios");
});

test("datos faltantes producen copy válido sin inventar métricas", () => {
  const notification = buildWorkoutCompletionNotification({ studentId: "student-1", sessionId: "session-1", serviceType: "MIXED", studentName: "Ana Pérez" });
  assert.equal(notification.message, "Entrenamiento completado.");
  assert.doesNotMatch(notification.message, /min|ejercicio/);
});

test("evento y destino son estables para reintentos y ediciones", () => {
  assert.equal(workoutCompletionEventKey("session-7"), workoutCompletionEventKey("session-7"));
  const notification = buildWorkoutCompletionNotification({ studentId: "student-juan", sessionId: "session-7", serviceType: "PERSONALIZED", studentName: "Juan" });
  assert.equal(notification.eventKey, "workout-completed:session-7");
  assert.equal(notification.url, "/alumnos?studentId=student-juan&section=routines&entityId=session-7#student-section-routines");
});

test("reintento y edición posterior conservan la misma clave idempotente", () => {
  const initial = buildWorkoutCompletionNotification({ studentId: "student-1", sessionId: "session-stable", serviceType: "PERSONALIZED", studentName: "Ana", durationMinutes: 30 });
  const edited = buildWorkoutCompletionNotification({ studentId: "student-1", sessionId: "session-stable", serviceType: "PERSONALIZED", studentName: "Ana", durationMinutes: 45 });
  assert.equal(initial.eventKey, edited.eventKey);
});

test("la integración guarda primero, deduplica en DB y desacopla fallos Push", () => {
  const route = readFileSync("app/api/portal/entrenamientos/route.ts", "utf8");
  const notifications = readFileSync("lib/trainer-notifications.ts", "utf8");
  assert.ok(route.indexOf("const saved = await prisma.$transaction") < route.lastIndexOf("await createWorkoutCompletedTrainerNotification"));
  assert.match(route, /input\.status === "finalizado"/);
  assert.match(route, /dispatchTrainerPush[\s\S]*\.catch/);
  assert.match(notifications, /type: "WORKOUT_COMPLETED"/);
  assert.match(notifications, /error\.code === "P2002"/);
});

test("sin dispositivos la notificación interna se conserva", () => {
  const notifications = readFileSync("lib/trainer-notifications.ts", "utf8");
  assert.match(notifications, /subscriptions\.length === 0[\s\S]*pushError: "No hay dispositivos activos\."/);
  assert.doesNotMatch(notifications, /subscriptions\.length === 0[\s\S]*trainerNotification\.delete/);
});

test("la campana muestra el título y conserva lectura y navegación", () => {
  const center = readFileSync("componentes/admin-notification-center.tsx", "utf8");
  assert.match(center, /notification\.title/);
  assert.match(center, /markRead/);
  assert.match(center, /openNotificationSafely/);
});
