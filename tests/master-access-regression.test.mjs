import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as auth from "../lib/admin-auth.ts";
import * as entry from "../lib/master-access.ts";
import * as revocation from "../lib/trainer-session-revocation.ts";
import * as trainerAccess from "../lib/trainer-session-access.ts";

const require = createRequire(import.meta.url);
const { NextRequest, NextResponse } = require("next/server");
process.env.BM_COACH_ADMIN_TOKEN = "master-regression-only-not-a-real-secret-12345";

function load(file, mocks) {
  const record = { exports: {} };
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, { module: record, exports: record.exports, require: name => name in mocks ? mocks[name] : require(name), process: { env: { NODE_ENV: "production" } }, Date, URL, Response, Request, console, Buffer });
  return record.exports;
}

function environment({ role = "PLATFORM_OWNER", status = "ACTIVE", revoked = false } = {}) {
  const calls = [];
  const user = { id: "owner", status, platformRole: role, memberships: [{ role: "OWNER", status: "ACTIVE", workspace: { type: "PROFESSIONAL", status: "ACTIVE" } }] };
  const prisma = {
    user: { findUnique: async args => { calls.push(["user", args.where.id]); return args.where.id === "deleted" ? null : { ...user, id: args.where.id }; } },
    trainerPasswordResetToken: { findFirst: async () => revoked ? { id: "reset" } : null },
    studentPortalSession: { findUnique: async () => { calls.push(["student"]); return { expiresAt: new Date(Date.now() + 10000), credential: { active: true } }; } },
  };
  const mocks = {
    "next/server": { NextResponse }, "@/lib/admin-auth": auth, "@/lib/master-access": entry,
    "@/lib/trainer-session-revocation": revocation, "@/lib/trainer-session-access": trainerAccess,
    "@/lib/prisma": { prisma },
    "@/lib/portal-experience": { LAST_PORTAL_COOKIE: "bm_coach_last_portal", STUDENT_SESSION_COOKIE: "bm_coach_student_session", portalExperienceCookieOptions: () => ({ path: "/" }) },
  };
  mocks["@/lib/platform-session-access"] = load("lib/platform-session-access.ts", { "@/lib/admin-auth": auth, "@/lib/trainer-session-revocation": revocation });
  return { prisma, mocks, calls, proxy: load("proxy.ts", mocks).proxy };
}

function request(path, cookies = {}, options = {}) {
  return new NextRequest(`https://bm.test${path}`, { ...options, headers: { cookie: Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join("; "), ...options.headers } });
}
const platformCookie = () => ({ [auth.PLATFORM_SESSION_COOKIE]: auth.createPlatformSessionValue("owner").value });
const trainerCookie = id => ({ [auth.ADMIN_SESSION_COOKIE]: auth.createAdminSessionValue(id ?? "owner").value });

test("reproducción: entrenador autenticado no secuestra /master, incluso si su identidad es PLATFORM_OWNER", async () => {
  const env = environment();
  const response = await env.proxy(request("/master", trainerCookie()));
  assert.equal(response.headers.get("location"), null, "Debe mostrar login Master; la versión anterior redirige a /dashboard");
  assert.equal(response.status, 200);
  assert.deepEqual(env.calls, [], "Master sin sesión propia no consulta ni depende de sesiones ajenas");
});

test("/platform sin sesión Master vuelve a /master conservando destino, nunca a Dashboard", async () => {
  const env = environment();
  const response = await env.proxy(request("/platform/settings?section=general", trainerCookie()));
  const location = new URL(response.headers.get("location"));
  assert.equal(location.pathname, "/master");
  assert.equal(location.searchParams.get("next"), "/platform/settings?section=general");
});

test("Master solo y ambas sesiones: acceso directo, recarga y enlaces internos permanecen en Master", async () => {
  for (const cookies of [platformCookie(), { ...platformCookie(), ...trainerCookie("other-trainer"), bm_coach_student_session: "student", bm_coach_last_portal: "admin" }]) {
    const env = environment();
    for (let reload = 0; reload < 2; reload++) {
      assert.equal(new URL((await env.proxy(request("/master", cookies))).headers.get("location")).pathname, "/platform/trainers");
      for (const path of ["/platform", "/platform/trainers", "/platform/settings", "/platform/trainers/abc"]) {
        const response = await env.proxy(request(path, cookies));
        assert.equal(response.status, 200); assert.equal(response.headers.get("location"), null);
      }
    }
    assert.ok(!env.calls.some(([kind, id]) => kind === "student" || id === "other-trainer"));
  }
});

test("alternar Master/Entrenador conserva ambas cookies y respeta cada guard", async () => {
  const cookies = { ...platformCookie(), ...trainerCookie() }; const env = environment();
  for (const path of ["/platform/trainers", "/dashboard", "/platform/settings", "/dashboard"]) {
    const response = await env.proxy(request(path, cookies));
    assert.equal(response.status, 200); assert.equal(response.headers.get("location"), null);
    assert.ok(!response.cookies.get(auth.ADMIN_SESSION_COOKIE)); assert.ok(!response.cookies.get(auth.PLATFORM_SESSION_COOKIE));
  }
});

test("Master vencido, manipulado o con firma antigua presenta login pese a Trainer vigente", async () => {
  const expired = auth.createPlatformSessionValue("owner", new Date(Date.now() - 31 * 86400000)).value;
  for (const value of [expired, "old-cookie-format", auth.createPlatformSessionValue("owner").value + "x"]) {
    const env = environment(); const cookies = { ...trainerCookie(), [auth.PLATFORM_SESSION_COOKIE]: value };
    assert.equal((await env.proxy(request("/master", cookies))).headers.get("location"), null);
    assert.equal(new URL((await env.proxy(request("/platform/trainers", cookies))).headers.get("location")).pathname, "/master");
    assert.notEqual((await env.proxy(request("/api/platform/trainers", cookies))).status, 200);
  }
});

test("sesiones legadas v1/v2 de coach nunca dan permiso Master ni bloquean el login", async () => {
  for (const token of [auth.createAdminSessionValue().value, auth.createAdminSessionValue("owner").value]) {
    const env = environment();
    assert.equal((await env.proxy(request("/master", { [auth.ADMIN_SESSION_COOKIE]: token }))).headers.get("location"), null);
    assert.equal((await env.proxy(request("/api/platform/trainers", { [auth.PLATFORM_SESSION_COOKIE]: token }))).status, 403);
  }
});

test("firma Master no basta: rol actual, estado y revocación se verifican en servidor", async () => {
  for (const state of [{ role: "TRAINER" }, { status: "SUSPENDED" }, { revoked: true }]) {
    const env = environment(state); const cookies = { ...platformCookie(), ...trainerCookie() };
    assert.equal((await env.proxy(request("/master", cookies))).headers.get("location"), null);
    assert.equal((await env.proxy(request("/api/platform/trainers", cookies))).status, 403);
    assert.equal(new URL((await env.proxy(request("/platform", cookies))).headers.get("location")).pathname, "/master");
  }
});

test("producción: mutaciones Master rechazan origen externo aun con ambas sesiones válidas", async () => {
  const env = environment(); const cookies = { ...platformCookie(), ...trainerCookie() };
  const invalid = await env.proxy(request("/api/platform/settings", cookies, { method: "PATCH", headers: { origin: "https://evil.test", host: "bm.test" } }));
  assert.equal(invalid.status, 403);
  assert.equal((await env.proxy(request("/api/platform/settings", cookies, { method: "PATCH", headers: { origin: "https://bm.test", "x-forwarded-host": "bm.test" } }))).status, 200);
});

test("layout y API validan el mismo rol/revocación que el proxy, incluso sin pasar por él", async () => {
  for (const state of [{}, { role: "TRAINER" }, { status: "SUSPENDED" }, { revoked: true }]) {
    const env = environment(state);
    class LoginRedirect extends Error {}
    const guard = load("lib/platform-auth.ts", { ...env.mocks,
      "server-only": {},
      "next/headers": { cookies: async () => ({ get: name => name === auth.PLATFORM_SESSION_COOKIE ? { value: platformCookie()[name] } : undefined }) },
      "next/navigation": { redirect: destination => { assert.equal(destination, "/master"); throw new LoginRedirect(); } },
      "@/lib/platform-access": { isPlatformOwner: role => role === "PLATFORM_OWNER" },
    });
    const api = await guard.platformOwnerApiAccess();
    if (!Object.keys(state).length) { assert.equal(api.ok, true); assert.equal((await guard.requirePlatformOwnerPage()).id, "owner"); }
    else { assert.equal(api.ok, false); assert.equal(api.response.status, 403); await assert.rejects(guard.requirePlatformOwnerPage(), LoginRedirect); }
  }
});

test("login Master emite sólo su cookie persistente, conserva Trainer y logout es independiente", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    for (const role of ["PLATFORM_OWNER", "TRAINER"]) {
      const writes = [];
      const cookies = new Map(Object.entries(trainerCookie()));
      const mocks = {
        "@/lib/admin-auth": auth,
        "next/headers": { cookies: async () => ({ set: (name, value, options) => { cookies.set(name, value); writes.push({ name, value, options }); } }) },
        "@/lib/prisma": { prisma: { user: { findUnique: async () => ({ id: "owner", platformRole: role, status: "ACTIVE", passwordHash: "fixture-hash" }) } } },
        "@/lib/portal-auth": { normalizeUsername: value => value.toLowerCase(), validRequestOrigin: () => true, verifyPassword: async (password, hash) => password === "correct" && hash === "fixture-hash", consumePasswordVerificationTime: async () => {} },
      };
      const login = load("app/api/platform/auth/login/route.ts", mocks);
      const response = await login.POST(new Request("https://bm.test/api/platform/auth/login", { method: "POST", body: JSON.stringify({ email: "owner@bm.test", password: "correct" }) }));
      if (role !== "PLATFORM_OWNER") { assert.equal(response.status, 401); assert.equal(writes.length, 0); continue; }
      assert.equal(response.status, 200); assert.equal(writes.length, 1);
      const cookie = writes[0]; assert.equal(cookie.name, auth.PLATFORM_SESSION_COOKIE);
      assert.equal(cookie.options.path, "/"); assert.equal(cookie.options.httpOnly, true); assert.equal(cookie.options.secure, true); assert.equal(cookie.options.sameSite, "lax");
      assert.equal(cookie.options.maxAge, 30 * 86400); assert.ok(cookie.options.expires > new Date());
      assert.equal(auth.verifyPlatformSessionValue(cookie.value).ok, true);
      // A fresh guard context reconstructs identity from the persisted cookie, not in-memory state.
      const restored = environment();
      assert.equal((await restored.proxy(request("/platform/settings", Object.fromEntries(cookies)))).status, 200);
      writes.length = 0;
      await load("app/api/platform/auth/logout/route.ts", mocks).POST(new Request("https://bm.test/api/platform/auth/logout", { method: "POST" }));
      assert.deepEqual(writes.map(item => item.name), [auth.PLATFORM_SESSION_COOKIE]);
      assert.equal(writes[0].options.maxAge, 0);
      assert.equal(auth.verifyAdminSessionValue(cookies.get(auth.ADMIN_SESSION_COOKIE)).ok, true);
    }
  } finally { if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv; }
});

test("sesiones dependientes de identidad no se cachean; next sólo retorna a rutas de plataforma", async () => {
  const env = environment();
  for (const path of ["/master", "/platform/settings", "/api/platform/trainers"]) {
    for (const cookies of [{}, platformCookie()]) assert.match((await env.proxy(request(path, cookies))).headers.get("cache-control"), /private, no-store/);
  }
  for (const value of [null, "//evil.test", "/dashboard", "/portal", "/platform/../../admin/login", "/\\evil.test", "https://evil.test/platform"]) assert.equal(entry.masterReturnPath(value), "/platform/trainers");
  assert.equal(entry.masterReturnPath("/platform/settings?tab=general"), "/platform/settings?tab=general");
});
