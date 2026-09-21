import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createAdminSessionValue, verifyAdminSessionValue } from "../lib/admin-auth.ts";
import { AUTH_SESSION_DAYS, AUTH_SESSION_MAX_AGE_SECONDS, authSessionExpiresAt, clearAuthCookieOptions, persistentAuthCookieOptions } from "../lib/session-persistence.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("alumno y trainer comparten una duración persistente de 30 días", () => {
  const now = new Date("2026-09-20T12:00:00.000Z");
  const expiresAt = authSessionExpiresAt(now);
  const options = persistentAuthCookieOptions(expiresAt);
  assert.equal(AUTH_SESSION_DAYS, 30);
  assert.equal(AUTH_SESSION_MAX_AGE_SECONDS, 2_592_000);
  assert.equal(expiresAt.getTime() - now.getTime(), AUTH_SESSION_MAX_AGE_SECONDS * 1000);
  assert.deepEqual(options, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
    priority: "high",
  });
});

test("la sesión firmada del trainer sigue válida varios días y vence al día 30", () => {
  const previous = process.env.BM_COACH_ADMIN_TOKEN;
  process.env.BM_COACH_ADMIN_TOKEN = "x".repeat(40);
  try {
    const createdAt = new Date("2026-09-20T12:00:00.000Z");
    const session = createAdminSessionValue("trainer-a", createdAt);
    assert.ok(session);
    assert.equal(verifyAdminSessionValue(session.value, new Date("2026-10-19T11:59:59.000Z")).ok, true);
    assert.deepEqual(verifyAdminSessionValue(session.value, session.expiresAt), { ok: false, reason: "expired" });
  } finally {
    if (previous === undefined) delete process.env.BM_COACH_ADMIN_TOKEN;
    else process.env.BM_COACH_ADMIN_TOKEN = previous;
  }
});

test("login y registro del alumno persisten también la sesión de base por 30 días", () => {
  const portalAuth = read("lib/portal-auth.ts");
  const registration = read("app/api/portal/registro/route.ts");
  assert.match(portalAuth, /authSessionExpiresAt/);
  assert.match(portalAuth, /portalSessionExpiresAt\(now\)/);
  assert.match(portalAuth, /persistentAuthCookieOptions\(expiresAt\)/);
  assert.match(registration, /portalSessionExpiresAt\(\)/);
  assert.doesNotMatch(`${portalAuth}\n${registration}`, /14\s*\*\s*86400000|SESSION_DAYS\s*=\s*14/);
});

test("logout invalida inmediatamente las dos cookies con el mismo Path", () => {
  assert.deepEqual(clearAuthCookieOptions(), {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
    priority: "high",
  });
  assert.match(read("app/api/admin/auth/logout/route.ts"), /clearAdminSessionCookieOptions/);
  assert.match(read("app/api/portal/logout/route.ts"), /clearPortalSessionCookieOptions/);
  assert.match(read("app/api/portal/logout/route.ts"), /studentPortalSession\.delete/);
});

test("PWA y TWA dependen de cookies HTTP y no guardan contraseñas en storage", () => {
  const authSurface = [
    read("app/admin/login/page.tsx"),
    read("app/master/page.tsx"),
    read("componentes/portal-login-form.tsx"),
    read("componentes/pwa-service-worker-registration.tsx"),
    read("public/sw.js"),
  ].join("\n");
  assert.doesNotMatch(authSurface, /localStorage|sessionStorage/);
  assert.match(read("public/portal/manifest.webmanifest"), /"display"\s*:\s*"standalone"/);
});
