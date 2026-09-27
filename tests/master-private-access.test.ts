import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ADMIN_SESSION_COOKIE,
  PLATFORM_SESSION_COOKIE,
  createAdminSessionValue,
  createPlatformSessionValue,
  verifyAdminSessionValue,
  verifyPlatformSessionValue,
} from "../lib/admin-auth.ts";
import { masterEntryDestination } from "../lib/master-access.ts";
import { trainerIdentityHasWorkspaceAccess } from "../lib/trainer-session-access.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("PLATFORM_OWNER abre y vuelve a abrir /master con su sesión persistente", () => {
  const previous = process.env.BM_COACH_ADMIN_TOKEN;
  process.env.BM_COACH_ADMIN_TOKEN = "m".repeat(40);
  try {
    const createdAt = new Date("2026-09-27T12:00:00.000Z");
    const session = createPlatformSessionValue("owner-a", createdAt);
    assert.ok(session);
    assert.equal(verifyPlatformSessionValue(session.value, new Date("2026-10-20T12:00:00.000Z")).ok, true);
    assert.equal(masterEntryDestination({ platformOwnerValid: true, trainerValid: false, studentValid: false }), "/platform/trainers");
    assert.match(read("proxy.ts"), /path === "\/master"[\s\S]*verifyPlatformSessionValue[\s\S]*masterEntryDestination/);
  } finally {
    if (previous === undefined) delete process.env.BM_COACH_ADMIN_TOKEN;
    else process.env.BM_COACH_ADMIN_TOKEN = previous;
  }
});

test("PLATFORM_OWNER conserva acceso a /platform/trainers bajo guard propio", () => {
  const proxy = read("proxy.ts");
  assert.match(proxy, /const platformRoute = [^;]*\/platform/);
  assert.match(proxy, /if \(platformRoute\)[\s\S]*verifyPlatformSessionValue/);
  assert.match(read("app/platform/layout.tsx"), /requirePlatformOwnerPage/);
  assert.match(read("lib/platform-auth.ts"), /PLATFORM_SESSION_COOKIE/);
});

test("TRAINER y STUDENT que intentan /master vuelven a su portal", () => {
  assert.equal(masterEntryDestination({ platformOwnerValid: false, trainerValid: true, studentValid: false }), "/dashboard");
  assert.equal(masterEntryDestination({ platformOwnerValid: false, trainerValid: false, studentValid: true }), "/portal");
});

test("la entrada normal mantiene al TRAINER en el dashboard", () => {
  const trainerLogin = read("app/api/admin/auth/login/route.ts");
  assert.match(trainerLogin, /trainerIdentityHasWorkspaceAccess\(user\)/);
  assert.match(trainerLogin, /next: onboardingCompleted \? "\/dashboard"/);
  assert.doesNotMatch(trainerLogin, /PLATFORM_SESSION_COOKIE|createPlatformSessionValue/);
});

test("PLATFORM_OWNER con workspace profesional activo también puede iniciar como Trainer", () => {
  const memberships = [{ role: "OWNER", status: "ACTIVE", workspace: { status: "ACTIVE", type: "PROFESSIONAL" } }];
  assert.equal(trainerIdentityHasWorkspaceAccess({ status: "ACTIVE", memberships }), true);
  assert.equal(trainerIdentityHasWorkspaceAccess({ status: "ACTIVE", memberships: [] }), false);
  assert.equal(trainerIdentityHasWorkspaceAccess({ status: "SUSPENDED", memberships }), false);
});

test("Master no aparece en la navegación visible normal", () => {
  const normalSurfaces = [
    "componentes/sidebar.tsx",
    "componentes/admin-topbar.tsx",
    "app/admin/login/page.tsx",
    "componentes/portal-login-form.tsx",
    "app/configuracion/page.tsx",
  ].map(read).join("\n");
  assert.doesNotMatch(normalSurfaces, /href=[^\n]*(?:\/master|\/platform)|router\.(?:push|replace)\([^\n]*(?:\/master|\/platform)/);
  assert.doesNotMatch(normalSurfaces, /PLATFORM_OWNER|Acceso Master|Panel Master/i);
});

test("Master, Trainer y Student coexisten sin compartir cookie ni logout", () => {
  assert.notEqual(PLATFORM_SESSION_COOKIE, ADMIN_SESSION_COOKIE);
  const previous = process.env.BM_COACH_ADMIN_TOKEN;
  process.env.BM_COACH_ADMIN_TOKEN = "s".repeat(40);
  try {
    const trainer = createAdminSessionValue("trainer-a");
    const platform = createPlatformSessionValue("owner-a");
    assert.ok(trainer && platform);
    assert.equal(verifyAdminSessionValue(platform.value).ok, false);
    assert.equal(verifyPlatformSessionValue(trainer.value).ok, false);
  } finally {
    if (previous === undefined) delete process.env.BM_COACH_ADMIN_TOKEN;
    else process.env.BM_COACH_ADMIN_TOKEN = previous;
  }
  assert.equal(masterEntryDestination({ platformOwnerValid: true, trainerValid: true, studentValid: true }), "/platform/trainers");
  assert.match(read("componentes/platform-shell.tsx"), /\/api\/platform\/auth\/logout/);
  assert.match(read("app/api/platform/auth/logout/route.ts"), /PLATFORM_SESSION_COOKIE/);
  assert.doesNotMatch(read("app/api/platform/auth/logout/route.ts"), /ADMIN_SESSION_COOKIE|STUDENT_SESSION_COOKIE/);
  assert.match(read("app/api/admin/auth/logout/route.ts"), /ADMIN_SESSION_COOKIE/);
  assert.doesNotMatch(read("app/api/admin/auth/logout/route.ts"), /PLATFORM_SESSION_COOKIE|STUDENT_SESSION_COOKIE/);
});
