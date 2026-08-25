import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getNotificationDestination,
  safePortalNotificationDestination,
} from "../lib/student-notification-destination.ts";
import { openNotificationSafely } from "../lib/trainer-notification-destination.ts";

test("resuelve los destinos contextuales del portal alumno", () => {
  assert.equal(getNotificationDestination({ type: "PAYMENT" }), "/portal/pagos");
  assert.equal(getNotificationDestination({ type: "ACHIEVEMENT" }), "/portal/puntos");
  assert.equal(getNotificationDestination({ eventKey: "ranking:monthly" }), "/portal/ranking");
  assert.equal(getNotificationDestination({ eventKey: "attendance:class-1" }), "/portal/clases");
  assert.equal(getNotificationDestination({ eventKey: "workout:session-1" }), "/portal/rutina");
  assert.equal(getNotificationDestination({ eventKey: "evaluation:updated" }), "/portal/evaluaciones");
});

test("conserva rutas internas compatibles y normaliza enlaces históricos", () => {
  assert.equal(getNotificationDestination({ type: "FEEDBACK", url: "/portal/registro#registro-1" }), "/portal/registro#registro-1");
  assert.equal(getNotificationDestination({ type: "POINTS", url: "/portal#puntos" }), "/portal/puntos");
  assert.equal(getNotificationDestination({ url: "/portal#logros" }), "/portal/puntos");
  assert.equal(getNotificationDestination({ url: "/portal/nutricion?evaluation=1" }), "/portal/nutricion?evaluation=1");
});

test("rechaza destinos externos o internos fuera de la lista permitida", () => {
  assert.equal(safePortalNotificationDestination("https://evil.example/portal/pagos"), null);
  assert.equal(safePortalNotificationDestination("//evil.example/portal/pagos"), null);
  assert.equal(safePortalNotificationDestination("/admin"), null);
  assert.equal(safePortalNotificationDestination("/portal/login"), null);
  assert.equal(getNotificationDestination({ type: "UNKNOWN", url: "https://evil.example" }), "/portal");
});

test("una notificación antigua sin metadata usa el inicio del portal", () => {
  assert.equal(getNotificationDestination({}), "/portal");
  assert.equal(getNotificationDestination({ type: "ANNOUNCEMENT" }), "/portal");
});

test("el click interno marca como leída, cierra el panel y navega", async () => {
  const calls: string[] = [];
  let panelOpen = true;
  await openNotificationSafely(
    { id: "student-notification-1", readAt: null, destination: "/portal/pagos" },
    { opening: false },
    async () => { calls.push("read"); },
    (destination) => {
      panelOpen = false;
      calls.push(`navigate:${destination}`);
    },
  );
  assert.equal(panelOpen, false);
  assert.deepEqual(calls, ["read", "navigate:/portal/pagos"]);
});

test("la API, la campana y Push consumen el destino seguro común", () => {
  const api = readFileSync(new URL("../app/api/portal/notifications/route.ts", import.meta.url), "utf8");
  const bell = readFileSync(new URL("../componentes/admin-notification-center.tsx", import.meta.url), "utf8");
  const push = readFileSync(new URL("../lib/push-notifications.ts", import.meta.url), "utf8");
  assert.match(api, /destination: getNotificationDestination\(notification\)/);
  assert.match(bell, /notification\.destination \?\? "\/portal"/);
  assert.match(bell, /setOpen\(false\)/);
  assert.match(bell, /router\.push\(destination\)/);
  assert.match(push, /url: getNotificationDestination\(message\)/);
});

test("el Service Worker valida same-origin, enfoca o abre la ruta contextual", () => {
  const serviceWorker = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(serviceWorker, /parsed\.origin === self\.location\.origin/);
  assert.match(serviceWorker, /safeNotificationTarget\(event\.notification\.data\?\.url\)/);
  assert.match(serviceWorker, /existing\.navigate\(target\).*existing\.focus\(\)/s);
  assert.match(serviceWorker, /clients\.openWindow\(target\)/);
});
