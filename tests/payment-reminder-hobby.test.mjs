import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const { NextRequest, NextResponse } = require("next/server");
function load(file, mocks, env = {}) {
  const record = { exports: {} };
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, { module: record, exports: record.exports, require: name => {
    if (name in mocks) return mocks[name];
    throw Error(`Unexpected dependency: ${name}`);
  }, process: { env }, Response, console, URL, Set });
  return record.exports;
}
test("Hobby no programa el worker y conserva el cron diario", () => {
  const { crons } = JSON.parse(readFileSync("vercel.json", "utf8"));
  assert.deepEqual(crons.find(job => job.path === "/api/cron/payment-reminders"), { path: "/api/cron/payment-reminders", schedule: "0 11 * * *" });
  assert.equal(crons.some(job => job.path === "/api/cron/payment-reminder-deliveries"), false);
});
test("cron diario atraviesa proxy sin sesión y mantiene autenticación real en la ruta", async () => {
  const auth = { ADMIN_SESSION_COOKIE: "trainer", PLATFORM_SESSION_COOKIE: "platform", verifyAdminSessionValue: () => ({ ok: false }), adminAuthError: () => ({ status: 401, error: "Sesión requerida" }) };
  const { proxy } = load("proxy.ts", {
    "next/server": { NextResponse }, "@/lib/admin-auth": auth,
    "@/lib/trainer-session-revocation": {}, "@/lib/master-access": {},
    "@/lib/platform-session-access": {}, "@/lib/portal-experience": {},
    "@/lib/prisma": {}, "@/lib/trainer-session-access": {},
  });
  const url = "https://bm.test/api/cron/payment-reminders";
  assert.equal((await proxy(new NextRequest(url))).headers.get("x-middleware-next"), "1");
  assert.equal((await proxy(new NextRequest(url + "/other"))).status, 401);
  const calls = [];
  const { GET } = load("app/api/cron/payment-reminders/route.ts", {
    "@/lib/payment-notifications": { createPaymentReminders: async (_date, persistent) => { assert.equal(persistent, undefined); calls.push("payment"); return [{ studentId: "test-only" }]; }, sendPaymentReminderPush: async () => calls.push("payment-push") },
    "@/lib/service-expiration-notifications": { createServiceExpirationReminders: async (_date, persistent) => { assert.equal(persistent, undefined); calls.push("service"); return [{ studentId: "test-only" }]; }, sendServiceExpirationReminder: async () => calls.push("service-push") },
    "@/lib/student-reminder-delivery": { processStudentReminderDeliveries: () => assert.fail("No tocar cola") },
  }, { CRON_SECRET: "test-secret", PAYMENT_REMINDER_DELIVERY_ENABLED: "false" });
  assert.equal((await GET(new Request(url))).status, 401);
  assert.equal((await GET(new Request(url, { headers: { authorization: "Bearer wrong" } }))).status, 401);
  assert.deepEqual(calls, []);
  const response = await GET(new Request(url, { headers: { authorization: "Bearer test-secret" } }));
  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["payment", "service", "payment-push", "service-push"]);
});
