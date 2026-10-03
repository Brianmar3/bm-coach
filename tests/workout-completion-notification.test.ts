import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildWorkoutCompletionNotification, isWorkoutTrainerNotificationEligible, shouldNotifyTrainerOfWorkout, workoutCompletionEventKey } from "../lib/workout-completion-notification.ts";
import { routineData, routineFingerprint, routineVersionSnapshot, validateRoutine, type RoutineInput } from "../lib/rutinas.ts";

const routineInput = (trainerNotificationsEnabled?: boolean): RoutineInput => ({
  name: "Plan", kind: "assigned", description: "", objective: "Fuerza", level: "principiante", status: "activa",
  startDate: "", durationWeeks: null, priorityMuscles: [], location: "", equipment: [], tags: [], studentIds: [], days: [],
  ...(trainerNotificationsEnabled === undefined ? {} : { trainerNotificationsEnabled }),
});

test("rutinas nuevas y existentes conservan avisos activos por defecto", () => {
  assert.equal(routineData(routineInput()).trainerNotificationsEnabled, true);
  assert.equal(routineVersionSnapshot(routineInput()).trainerNotificationsEnabled, true);
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const migration = readFileSync("prisma/migrations/20261003120000_training_routine_trainer_notifications/migration.sql", "utf8");
  assert.match(schema, /trainerNotificationsEnabled\s+Boolean\s+@default\(true\)/);
  assert.match(migration, /"trainerNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true/);
});

test("desactivar y reactivar la preferencia cambia la versión persistida", () => {
  assert.equal(routineData(routineInput(false)).trainerNotificationsEnabled, false);
  assert.equal(routineData(routineInput(true)).trainerNotificationsEnabled, true);
  assert.notEqual(routineFingerprint(routineInput(false)), routineFingerprint(routineInput(true)));
  assert.equal(validateRoutine({ ...routineInput(), trainerNotificationsEnabled: "false" as unknown as boolean }), "Seleccioná una preferencia de notificaciones válida.");
  const editor = readFileSync("app/rutinas/page.tsx", "utf8");
  const update = readFileSync("app/api/rutinas/[id]/route.ts", "utf8");
  assert.match(editor, /Notificaciones de esta rutina/);
  assert.match(editor, /trainerNotificationsEnabled: event\.target\.checked/);
  assert.match(update, /input\.trainerNotificationsEnabled \?\? existing\.trainerNotificationsEnabled/);
  assert.match(update, /trainerNotificationsEnabled: snapshot\.trainerNotificationsEnabled \?\? routine\.trainerNotificationsEnabled/);
});

test("solo un entrenamiento completado y habilitado puede avisar al entrenador", () => {
  const input = { completed: true, selfService: false, serviceType: "PERSONALIZED" as const, trainerNotificationsEnabled: true };
  assert.equal(shouldNotifyTrainerOfWorkout(input), true);
  assert.equal(shouldNotifyTrainerOfWorkout({ ...input, trainerNotificationsEnabled: false }), false);
  assert.equal(shouldNotifyTrainerOfWorkout({ ...input, completed: false }), false);
  assert.equal(shouldNotifyTrainerOfWorkout({ ...input, selfService: true }), false);
  assert.equal(shouldNotifyTrainerOfWorkout({ ...input, serviceType: "CLASSES" }), false);
  const route = readFileSync("app/api/portal/entrenamientos/route.ts", "utf8");
  assert.match(route, /trainerNotificationsEnabled: assignment\.routine\.trainerNotificationsEnabled/);
  assert.match(route, /if \(shouldNotifyTrainerOfWorkout\([\s\S]*await createWorkoutCompletedTrainerNotification/);
  assert.match(route, /assignment\?\.routine\.workspaceId !== session\.credential\.student\.workspaceId/);
});

test("asistencia y otros avisos no dependen del switch; Web Push y FCM comparten el mismo envío", () => {
  const attendance = readFileSync("app/api/portal/clases/route.ts", "utf8");
  const notifications = readFileSync("lib/trainer-notifications.ts", "utf8");
  assert.match(attendance, /createAttendanceTrainerNotification/);
  assert.doesNotMatch(attendance, /trainerNotificationsEnabled/);
  assert.match(notifications, /webpush\.sendNotification/);
  assert.match(notifications, /sendTrainerNativePush\(workspaceId, brandedPayload\)/);
  assert.doesNotMatch(notifications, /trainerNotificationsEnabled/);
});

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
  assert.match(notifications, /subscriptions\.length === 0[\s\S]*errors\.push\("No hay dispositivos activos\."\)/);
  assert.match(notifications, /pushError: delivered[\s\S]*errors\.join/);
  assert.doesNotMatch(notifications, /subscriptions\.length === 0[\s\S]*trainerNotification\.delete/);
});

test("la campana muestra el título y conserva lectura y navegación", () => {
  const center = readFileSync("componentes/admin-notification-center.tsx", "utf8");
  assert.match(center, /notification\.title/);
  assert.match(center, /markRead/);
  assert.match(center, /openNotificationSafely/);
});
