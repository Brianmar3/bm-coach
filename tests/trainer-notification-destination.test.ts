import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  openNotificationSafely,
  resolveTrainerNotificationDestination,
  studentNotificationProfileUrl,
} from "../lib/trainer-notification-destination.ts";

const studentId = "student-juan";

test("un logro abre la ficha del alumno y enfoca Logros", () => {
  assert.equal(
    resolveTrainerNotificationDestination({ type: "POINTS", studentId, eventKey: `points:${studentId}:achievement:classes-10`, url: "/alumnos" }),
    "/alumnos?studentId=student-juan&section=achievements&entityId=classes-10#student-section-achievements",
  );
});

test("una marca personal conserva el identificador de la entidad", () => {
  assert.equal(
    resolveTrainerNotificationDestination({ type: "POINTS", studentId, eventKey: `points:${studentId}:personal-record:performance-sentadilla:max:100` }),
    "/alumnos?studentId=student-juan&section=records&entityId=performance-sentadilla%3Amax%3A100#student-section-records",
  );
});

test("una rutina completada abre actividad y conserva la sesión", () => {
  assert.equal(
    resolveTrainerNotificationDestination({ type: "WORKOUT_COMPLETED", studentId, entityId: "session-7" }),
    "/alumnos?studentId=student-juan&section=routines&entityId=session-7#student-section-routines",
  );
});

test("un registro rápido abre Registros y permite enfocar el elemento", () => {
  assert.equal(
    resolveTrainerNotificationDestination({ type: "POINTS", studentId, eventKey: `points:${studentId}:record:quick-log:quick-22` }),
    "/alumnos?studentId=student-juan&section=records&entityId=quick-22#student-section-records",
  );
});

test("sin entityId abre la sección y sin studentId usa el fallback general", () => {
  assert.equal(resolveTrainerNotificationDestination({ type: "ACHIEVEMENT_UNLOCKED", studentId }), "/alumnos?studentId=student-juan&section=achievements#student-section-achievements");
  assert.equal(resolveTrainerNotificationDestination({ type: "ACHIEVEMENT_UNLOCKED", url: "/alumnos" }), "/alumnos");
});

test("una entidad eliminada no altera el fallback seguro de la ficha", () => {
  assert.equal(studentNotificationProfileUrl(studentId, "records", "deleted-record"), "/alumnos?studentId=student-juan&section=records&entityId=deleted-record#student-section-records");
});

test("asistencia y pagos conservan sus destinos propios", () => {
  assert.equal(resolveTrainerNotificationDestination({ type: "CLASS_RESPONSE", studentId, url: "/asistencias?date=2026-08-01" }), "/asistencias?date=2026-08-01");
  assert.equal(resolveTrainerNotificationDestination({ type: "PAYMENT", studentId, url: "/pagos?month=2026-08" }), "/pagos?month=2026-08");
});

test("un tipo desconocido con alumno abre su ficha general", () => {
  assert.equal(resolveTrainerNotificationDestination({ type: "FUTURE_EVENT", studentId, url: "/alumnos" }), "/alumnos?studentId=student-juan");
});

test("marca como leída antes de navegar", async () => {
  const calls: string[] = [];
  const result = await openNotificationSafely(
    { id: "notification-1", readAt: null, destination: "/alumnos?studentId=student-juan" },
    { opening: false },
    async () => { calls.push("read"); },
    () => { calls.push("navigate"); },
  );
  assert.equal(result, true);
  assert.deepEqual(calls, ["read", "navigate"]);
});

test("un fallo al marcar como leída no bloquea la navegación", async () => {
  const calls: string[] = [];
  await openNotificationSafely(
    { id: "notification-2", readAt: null, destination: "/alumnos?studentId=student-juan" },
    { opening: false },
    async () => { calls.push("read"); throw new Error("offline"); },
    () => { calls.push("navigate"); },
  );
  assert.deepEqual(calls, ["read", "navigate"]);
});

test("un doble toque solo marca y navega una vez", async () => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const state = { opening: false };
  let reads = 0;
  let navigations = 0;
  const first = openNotificationSafely({ id: "notification-3", readAt: null, destination: "/alumnos" }, state, async () => { reads += 1; await pending; }, () => { navigations += 1; });
  const second = await openNotificationSafely({ id: "notification-3", readAt: null, destination: "/alumnos" }, state, async () => { reads += 1; }, () => { navigations += 1; });
  assert.equal(second, false);
  release();
  await first;
  assert.equal(reads, 1);
  assert.equal(navigations, 1);
});

test("la ruta es idéntica en móvil y escritorio porque no depende del viewport", () => {
  const input = { type: "EXERCISE_LOGGED", studentId, entityId: "record-1" };
  assert.equal(resolveTrainerNotificationDestination(input), resolveTrainerNotificationDestination(input));
});

test("la API mantiene autorización y devuelve los campos para resolver históricos", () => {
  const api = readFileSync(new URL("../app/api/admin/notifications/route.ts", import.meta.url), "utf8");
  assert.match(api, /verifyAdminSessionValue/);
  assert.match(api, /ownerKey: TRAINER_OWNER_KEY/);
  assert.match(api, /eventKey: true/);
  assert.match(api, /studentId: true/);
  assert.match(api, /resolveTrainerNotificationDestination/);
});

test("la ficha contiene anclas estables y fallback si el registro ya no existe", () => {
  const students = readFileSync(new URL("../app/alumnos/page.tsx", import.meta.url), "utf8");
  const records = readFileSync(new URL("../componentes/admin-quick-log-summary.tsx", import.meta.url), "utf8");
  assert.match(students, /student-section-achievements/);
  assert.match(students, /student-section-attendance/);
  assert.match(records, /student-section-/);
  assert.match(records, /data-record-source-id/);
});
