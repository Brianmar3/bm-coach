import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
const require = createRequire(import.meta.url);
const ts = require("typescript");
function load(file, imports = {}) {
  const result = { exports: {} };
  const { outputText } = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  new Function("require", "module", "exports", outputText)(name => imports[name] ?? require(name), result, result.exports);
  return result.exports;
}
const state = load("lib/push-notification-state.ts");
const { activateStudentWebPush } = load("lib/student-web-push.ts", { "./push-notification-state": state });
const key = new Uint8Array([4, 2]);
function device(existing = null, failure = false) {
  let subscription = existing;
  let created = 0;
  const manager = {
    getSubscription: async () => subscription,
    subscribe: async options => {
      assert.equal(options.userVisibleOnly, true);
      assert.deepEqual(options.applicationServerKey, key);
      if (failure) throw new Error("Browser failure");
      created++;
      subscription = { options: { applicationServerKey: key.buffer }, expirationTime: null, unsubscribe: async () => { subscription = null; return true; } };
      return subscription;
    },
  };
  return { manager, created: () => created };
}
test("crea una suscripción y la reutiliza al reabrir o reintentar", async () => {
  const { manager, created } = device();
  const seen = new Set();
  const register = async value => { seen.add(value); return new Response(); };
  await activateStudentWebPush(manager, key, register);
  await activateStudentWebPush(manager, key, register);
  assert.equal(created(), 1);
  assert.equal(seen.size, 1);
});
test("un fallo de Chrome no registra nada en el servidor", async () => {
  await assert.rejects(activateStudentWebPush(device(null, true).manager, key, () => assert.fail()), { stage: "subscribe", errorName: "Error" });
});
test("un fallo HTTP se distingue y conserva la suscripción para reintentar", async () => {
  const { manager, created } = device();
  await assert.rejects(activateStudentWebPush(manager, key, async () => new Response(null, { status: 409 })), { stage: "server", status: 409 });
  await activateStudentWebPush(manager, key, async () => new Response());
  assert.equal(created(), 1);
});
test("reemplaza una suscripción vencida", async () => {
  const { manager, created } = device();
  const register = async () => new Response();
  await activateStudentWebPush(manager, key, register);
  (await manager.getSubscription()).expirationTime = 1;
  await activateStudentWebPush(manager, key, register);
  assert.equal(created(), 2);
});
test("permiso concedido, bloqueo y estado al reabrir", () => {
  const input = { supported: true, iphoneBrowser: false, configured: true, hasSubscription: true, backendActive: true };
  assert.equal(state.resolvePushUiState({ ...input, permission: "granted" }), "active");
  assert.equal(state.resolvePushUiState({ ...input, permission: "denied" }), "blocked");
  assert.equal(state.resolvePushUiState({ ...input, permission: "granted", backendActive: false }), "inactive");
});
test("desactivar en el servidor solo afecta al alumno autenticado", async () => {
  let update;
  const route = load("app/api/portal/push/route.ts", {
    "@/lib/prisma": { prisma: { studentPushSubscription: { updateMany: async args => { update = args; } } } },
    "@/lib/push-notifications": {},
    "@/lib/portal-auth": { validRequestOrigin: () => true, getPortalSession: async () => ({ studentId: "student-a" }) },
  });
  const endpoint = "https://push.example/device";
  const response = await route.DELETE(new Request("https://bm.test/api/portal/push", { method: "DELETE", body: JSON.stringify({ endpoint }) }));
  assert.equal(response.status, 200);
  assert.deepEqual(update, { where: { studentId: "student-a", endpoint }, data: { active: false } });
});
test("registro repetido usa el endpoint único y una colisión no cambia de dueño", async () => {
  const { publicKey, privateKey } = require("web-push").generateVAPIDKeys();
  const { Prisma } = require("@prisma/client");
  const original = {};
  const env = { NEXT_PUBLIC_VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: "mailto:test@example.com" };
  for (const name of Object.keys(env)) original[name] = process.env[name];
  Object.assign(process.env, env);
  const rows = new Map();
  let studentId = "a";
  let simulateRace = false;
  try {
    const route = load("app/api/portal/push/route.ts", {
      "@/lib/prisma": { prisma: { studentPushSubscription: {
        findFirst: async () => null,
        upsert: async ({ where, create, update }) => {
          assert.equal(where.studentId, studentId);
          if (simulateRace) throw new Prisma.PrismaClientKnownRequestError("Collision", { code: "P2002", clientVersion: "test" });
          rows.set(where.endpoint, rows.has(where.endpoint) ? { ...rows.get(where.endpoint), ...update } : create);
        },
        updateMany: async ({ where }) => ({ count: rows.get(where.endpoint)?.studentId === where.studentId ? 1 : 0 }),
      } } },
      "@/lib/push-notifications": { establishAchievementBaseline: async () => {} },
      "@/lib/portal-auth": { validRequestOrigin: () => true, getPortalSession: async () => ({ studentId }) },
    });
    const endpoint = "https://push.example/device";
    const register = () => route.POST(new Request("https://bm.test/api/portal/push", {
      method: "POST", body: JSON.stringify({ endpoint, keys: { p256dh: "a".repeat(87), auth: "b".repeat(22) } }),
    }));
    assert.equal((await register()).status, 200);
    assert.equal((await register()).status, 200);
    assert.equal(rows.size, 1);
    studentId = "b";
    simulateRace = true;
    assert.equal((await register()).status, 409);
    assert.equal(rows.get(endpoint).studentId, "a");
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = require("web-push").generateVAPIDKeys().publicKey;
    assert.equal((await register()).status, 503);
  } finally {
    for (const [name, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("el diagnóstico conserva etapa y nombre permitido sin mensaje del navegador", async () => {
  const { manager } = device();
  manager.subscribe = async () => { throw new DOMException("endpoint privado", "AbortError"); };
  await assert.rejects(activateStudentWebPush(manager, key, () => assert.fail()), (error) => {
    assert.equal(error.stage, "subscribe");
    assert.equal(error.errorName, "AbortError");
    assert.doesNotMatch(error.message, /endpoint privado/);
    return true;
  });
  manager.getSubscription = async () => { throw new DOMException("dato privado", "CustomSecret"); };
  await assert.rejects(activateStudentWebPush(manager, key, () => assert.fail()), { stage: "getSubscription", errorName: "UnknownError" });
});
