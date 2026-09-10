import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url);
function load(file: string, mocks: Record<string, unknown>) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, { module: loaded, exports: loaded.exports, require: (name: string) => name in mocks ? mocks[name] : nativeRequire(name), Response, Request, Date, console });
  return loaded.exports as Record<string, (...args: any[]) => any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

function notificationStore() {
  const state = {
    students: [
      { id: "student-a-1", studentId: "student-a" },
      { id: "student-a-2", studentId: "student-a" },
      { id: "student-b-1", studentId: "student-b" },
    ],
    trainers: [
      { id: "trainer-main", ownerKey: "coach" },
      { id: "trainer-other", ownerKey: "other-coach" },
    ],
  };
  return {
    state,
    prisma: {
      studentNotification: {
        deleteMany: async ({ where }: { where: { studentId: string } }) => {
          const before = state.students.length;
          state.students = state.students.filter((item) => item.studentId !== where.studentId);
          return { count: before - state.students.length };
        },
      },
      trainerNotification: {
        deleteMany: async ({ where }: { where: { ownerKey: string } }) => {
          const before = state.trainers.length;
          state.trainers = state.trainers.filter((item) => item.ownerKey !== where.ownerKey);
          return { count: before - state.trainers.length };
        },
      },
    },
  };
}

function studentRoute(prisma: unknown, options: { authenticated?: boolean; origin?: boolean } = {}) {
  return load("app/api/portal/notifications/route.ts", {
    "@/lib/prisma": { prisma },
    "@/lib/portal-auth": { getPortalSession: async () => options.authenticated === false ? null : { studentId: "student-a" }, validRequestOrigin: () => options.origin !== false },
    "@/lib/student-notification-destination": { getNotificationDestination: () => "/portal" },
  });
}

function trainerRoute(prisma: unknown, options: { authenticated?: boolean; origin?: boolean } = {}) {
  return load("app/api/admin/notifications/route.ts", {
    "next/server": { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
    "next/headers": { cookies: async () => ({ get: () => ({ value: "session" }) }) },
    "@/lib/admin-auth": { ADMIN_SESSION_COOKIE: "admin", verifyAdminSessionValue: () => ({ ok: options.authenticated !== false }) },
    "@/lib/prisma": { prisma },
    "@/lib/portal-auth": { validRequestOrigin: () => options.origin !== false },
    "@/lib/trainer-notifications": { TRAINER_OWNER_KEY: "coach", buildAttendanceMessage: () => "", buildAttendanceUrl: () => "/asistencias" },
    "@/lib/payment-dates": { databaseDateKey: () => "2026-09-10" },
    "@/lib/class-occurrences": { occurrenceClassName: () => "Clase" },
    "@/lib/trainer-notification-destination": { resolveTrainerNotificationDestination: () => "/alumnos" },
  });
}

test("Alumno A borra sólo su historial y conserva Alumno B y entrenador", async () => {
  const { state, prisma } = notificationStore();
  const response = await studentRoute(prisma).DELETE(new Request("http://localhost/api/portal/notifications", { method: "DELETE" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, deletedCount: 2, unreadCount: 0 });
  assert.deepEqual(state.students, [{ id: "student-b-1", studentId: "student-b" }]);
  assert.equal(state.trainers.length, 2);
});

test("entrenador borra sólo su ownerKey y no toca alumnos ni otros owners", async () => {
  const { state, prisma } = notificationStore();
  const response = await trainerRoute(prisma).DELETE(new Request("http://localhost/api/admin/notifications", { method: "DELETE" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, deletedCount: 1, unreadCount: 0 });
  assert.deepEqual(state.trainers, [{ id: "trainer-other", ownerKey: "other-coach" }]);
  assert.equal(state.students.length, 3);
});

test("ambos endpoints exigen sesión y origen válido antes de borrar", async () => {
  for (const route of [studentRoute({}, { authenticated: false }), trainerRoute({}, { authenticated: false })]) {
    assert.equal((await route.DELETE(new Request("http://localhost/api/notifications", { method: "DELETE" }))).status, 401);
  }
  for (const route of [studentRoute({}, { origin: false }), trainerRoute({}, { origin: false })]) {
    assert.equal((await route.DELETE(new Request("http://localhost/api/notifications", { method: "DELETE" }))).status, 403);
  }
});

test("la UI compartida confirma, se oculta vacía y actualiza lista y badge sólo tras éxito", () => {
  const center = readFileSync("componentes/admin-notification-center.tsx", "utf8");
  assert.match(center, /!loading && notifications\.length > 0/);
  assert.match(center, /aria-label="Borrar todas las notificaciones"/);
  assert.match(center, /Borrar todas las notificaciones/);
  assert.match(center, /Se eliminarán todas tus notificaciones\./);
  assert.match(center, /role="alertdialog"/);
  assert.match(center, /useEscapeLayer\(confirmingDelete, closeDeleteConfirmation/);
  assert.match(center, /if \(!response\.ok\) throw new Error/);
  assert.match(center, /setNotifications\(\[\]\);\s*setUnreadCount\(0\);/);
  assert.match(center, /No se pudieron borrar las notificaciones\. Intentá nuevamente\./);
  assert.match(center, /onClick=\{closeDeleteConfirmation\}[\s\S]*?Cancelar/);
});

test("borrar historial no toca Web Push y la navegación individual permanece", () => {
  for (const file of ["app/api/portal/notifications/route.ts", "app/api/admin/notifications/route.ts"]) {
    const route = readFileSync(file, "utf8");
    assert.doesNotMatch(route, /PushSubscription\.delete|pushSubscription\.delete|unsubscribe/i);
  }
  const center = readFileSync("componentes/admin-notification-center.tsx", "utf8");
  assert.match(center, /openNotificationSafely/);
  assert.match(center, /method: "PATCH"/);
  assert.match(center, /router\.push\(destination\)/);
});
