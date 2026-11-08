import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import * as rules from "../lib/master-email.ts";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync("app/api/cron/master-memberships/route.ts", "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function route(env, run = async () => ({ status: "SENT", digestId: "digest" })) {
  const exports = {};
  const prisma = { masterEmailDigest: { count: async () => 0 } };
  const imports = { "@/lib/prisma": { prisma }, "@/lib/master-email": rules, "@/lib/master-email-service": { runMasterDigest: run } };
  new Function("require", "exports", "process", "console", code)((name) => imports[name], exports, { env }, { info() {}, error() {} });
  return exports.GET;
}
const env = { CRON_SECRET: "x".repeat(32), VERCEL_ENV: "production", MASTER_EMAIL_ENABLED: "true", RESEND_API_KEY: "fake", MASTER_EMAIL_FROM: "test@bm.test", MASTER_APP_URL: "https://bm.test" };
const request = (authorized = true) => new Request("https://bm.test/api/cron/master-memberships", { headers: authorized ? { authorization: `Bearer ${env.CRON_SECRET}` } : {} });

test("real route: auth before database/provider; no caching", async () => {
  const response = await route(env, async () => { assert.fail("must not run"); })(request(false));
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "no-store");
});
test("real route: disabled and preview never dispatch", async () => {
  for (const settings of [{ ...env, MASTER_EMAIL_ENABLED: "false" }, { ...env, VERCEL_ENV: "preview" }]) {
    const response = await route(settings, async () => { assert.fail("must not run"); })(request());
    assert.deepEqual(await response.json(), { status: "DISABLED" });
  }
});
test("real route: success and sanitized failure, no secrets or payload in response", async () => {
  const response = await route(env)(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "SENT", digestId: "digest", reviewCount: 0 });
  const failed = await route(env, async () => { throw new Error("private credential"); })(request());
  assert.equal(failed.status, 503);
  assert.doesNotMatch(await failed.text(), /private credential/);
  assert.equal((await route({ ...env, RESEND_API_KEY: "" })(request())).status, 503);
});
test("cron bypass is exact; Master APIs retain existing platform authorization", () => {
  const proxy = readFileSync("proxy.ts", "utf8");
  assert.match(proxy, /if \(path === "\/api\/cron\/master-memberships"\) return NextResponse.next\(\);/);
  assert.doesNotMatch(proxy, /path.startsWith\("\/api\/cron/);
  assert.match(proxy, /platformSessionAccess\(request.cookies.get\(PLATFORM_SESSION_COOKIE\)/);
  assert.match(readFileSync("lib/platform-session-access.ts", "utf8"), /user.platformRole === "PLATFORM_OWNER"/);
  const crons = JSON.parse(readFileSync("vercel.json", "utf8")).crons;
  assert.deepEqual(crons.find((cron) => cron.path === "/api/cron/master-memberships"), { path: "/api/cron/master-memberships", schedule: "0 11 * * *" });
  assert.ok(crons.some((cron) => cron.path === "/api/cron/payment-reminders"));
});
