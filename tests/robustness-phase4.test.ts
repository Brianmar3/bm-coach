import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { apiRequest, ClientApiError, safeInternalPath } from "../lib/client-api.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const helper = read("lib/client-api.ts");
const attendance = read("app/asistencias/page.tsx");
const payments = read("app/pagos/page.tsx");
const workout = read("componentes/portal-section.tsx");
const workoutApi = read("app/api/portal/entrenamientos/route.ts");
const followUp = read("componentes/routine-follow-up-dashboard.tsx");
const trainerLogin = read("app/admin/login/page.tsx");
const portalLogin = read("componentes/portal-login-form.tsx");

test("el retorno tras login acepta sólo destinos internos", () => {
  assert.equal(safeInternalPath("/rutinas?tab=seguimiento", "/dashboard"), "/rutinas?tab=seguimiento");
  for (const unsafe of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)"]) {
    assert.equal(safeInternalPath(unsafe, "/dashboard"), "/dashboard");
  }
  assert.match(trainerLogin, /safeInternalPath.*"\/dashboard"/);
  assert.match(portalLogin, /safeInternalPath.*"\/portal"/);
});

test("el cliente distingue sesión, permisos, conflictos, servidor y red", () => {
  for (const status of ["401", "403", "404", "409"]) assert.match(helper, new RegExp(`status === ${status}`));
  assert.match(helper, /status >= 500/);
  assert.match(helper, /"network"/);
  assert.match(helper, /if \(kind === "session"\) redirectExpiredSession/);
  assert.doesNotMatch(helper, /kind === "forbidden".*redirectExpiredSession/);
});

test("401 redirige al login correcto, 403 no redirige y red informa conexión", async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = (globalThis as typeof globalThis & { window?: unknown }).window;
  const destinations: string[] = [];
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { pathname: "/seguimiento", search: "?estado=atencion", hash: "", assign: (value: string) => destinations.push(value) } } });
  try {
    globalThis.fetch = async () => Response.json({ error: "interno" }, { status: 403 });
    await assert.rejects(apiRequest("/api/x", undefined, { fallback: "Falló", scope: "admin" }), (error) => error instanceof ClientApiError && error.kind === "forbidden" && error.message === "No tenés acceso a esta sección.");
    assert.deepEqual(destinations, []);

    globalThis.fetch = async () => Response.json({ error: "interno" }, { status: 401 });
    await assert.rejects(apiRequest("/api/x", undefined, { fallback: "Falló", scope: "admin" }), (error) => error instanceof ClientApiError && error.kind === "session");
    assert.equal(destinations[0], "/admin/login?next=%2Fseguimiento%3Festado%3Datencion");

    globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
    await assert.rejects(apiRequest("/api/x", undefined, { fallback: "Falló", scope: "portal" }), (error) => error instanceof ClientApiError && error.kind === "network" && /servidor/.test(error.message));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) delete (globalThis as typeof globalThis & { window?: unknown }).window;
    else Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
  }
});

test("asistencia sólo revierte si falla el guardado, no si falla el resumen", () => {
  const saveFailure = attendance.indexOf("setRoster(previousRoster)");
  const refreshFailure = attendance.indexOf("La asistencia se guardó, pero no pudimos actualizar el resumen.");
  assert.ok(saveFailure >= 0 && refreshFailure > saveFailure);
  assert.equal(attendance.slice(refreshFailure, attendance.indexOf("finally", refreshFailure)).includes("setRoster(previousRoster)"), false);
  assert.match(attendance, /savingLock\.current/);
});

test("pagos conserva el resultado guardado si falla el refresco y bloquea doble envío", () => {
  assert.match(payments, /setData\(saved\.dashboard\);\s*setForm\(null\)/);
  assert.match(payments, /los datos guardados se mantienen/);
  assert.match(payments, /if \(!form \|\| paymentSaveLock\.current\) return/);
});

test("finalizar entrenamiento usa lock síncrono, conserva borrador al fallar y no expone payloads", () => {
  assert.match(workout, /if \(!draft \|\| saveLockRef\.current\) return/);
  assert.match(workout, /saveLockRef\.current = true/);
  assert.match(workout, /finally \{ saveLockRef\.current = false/);
  const finalSave = workout.slice(workout.indexOf("async function save(finalize = false)"), workout.indexOf("function openFinalSummary"));
  assert.ok(finalSave.indexOf("window.localStorage.removeItem") > finalSave.indexOf("apiRequest<"));
  assert.doesNotMatch(`${workout}\n${workoutApi}`, /developmentDetail|payload: next|payload: process\.env/);
  assert.doesNotMatch(workoutApi, /payload: input/);
});

test("seguimiento redirige sólo por 401 mediante el helper y conserva datos hasta éxito", () => {
  assert.match(followUp, /apiRequest<SummaryResponse>/);
  assert.doesNotMatch(followUp, /status === 401 \|\| response\.status === 403/);
  assert.ok(followUp.indexOf("setStudents(body.students)") > followUp.indexOf("apiRequest<SummaryResponse>"));
});

test("hay límites globales para errores y rutas inexistentes", () => {
  assert.match(read("app/error.tsx"), /reset/);
  assert.match(read("app/not-found.tsx"), /Esta pantalla no está disponible/);
});

test("los guards, logout e identidad del portal se resuelven del lado servidor", () => {
  const proxy = read("proxy.ts");
  const portalLayout = read("app/portal/(student)/layout.tsx");
  const portalWorkoutApi = read("app/api/portal/entrenamientos/route.ts");
  const adminLogout = read("app/api/admin/auth/logout/route.ts");
  const portalLogout = read("app/api/portal/logout/route.ts");
  assert.match(proxy, /verifyAdminSessionValue/);
  assert.match(portalLayout, /requirePortalPageSession/);
  assert.match(portalWorkoutApi, /studentId: session\.studentId/);
  assert.match(portalWorkoutApi, /where: \{ id: input\.id, studentId: session\.studentId \}/);
  assert.match(adminLogout, /maxAge: 0/);
  assert.match(portalLogout, /studentPortalSession\.delete/);
  assert.match(portalLogout, /maxAge: 0/);
});
