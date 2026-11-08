import assert from "node:assert/strict";
import test from "node:test";
import { argentinaDay, authorizedMasterCron, digestWindow, masterEmailConfig, membershipEmailItem, invitationEmailItem, renderMasterEmail, sendMasterEmail } from "../lib/master-email.ts";

const now = new Date("2026-10-27T11:00:00Z");
test("fechas argentinas, cambio de mes/año y corte a las 08:00", () => {
  assert.equal(argentinaDay(new Date("2027-01-01T02:59:59Z")), "2026-12-31");
  assert.equal(digestWindow(new Date("2026-10-27T10:59:59Z")).ready, false);
  assert.equal(digestWindow(now).ready, true);
  assert.equal(digestWindow(now).cutoff.toISOString(), now.toISOString());
});
test("resumen diario: próximos siete días, todos los vencidos y exclusión de canceladas", () => {
  for (const days of [-4, -3, -2, -1, 0, 1, 2, 3, 4, 7, 8]) {
    const subscription = { nextDueAt: new Date(now.getTime() + days * 86400000), plan: "PRO" as const, status: "ACTIVE" as const, trainer: { name: "Entrenador" } };
    assert.equal(Boolean(membershipEmailItem(subscription, now)), days <= 7);
    assert.equal(membershipEmailItem({ ...subscription, status: "CANCELLED" }, now), null);
  }
  const subscription = { nextDueAt: new Date("2026-10-24T12:00:00Z"), plan: "FREE" as const, status: "ACTIVE" as const, trainer: { name: "Ana" } };
  assert.equal(membershipEmailItem(subscription, now)?.state, "Vencida");
  assert.equal(membershipEmailItem({ ...subscription, status: "SUSPENDED" }, now)?.state, "Suspendida");
  assert.equal(membershipEmailItem({ ...subscription, nextDueAt: null }, now), null);
  assert.equal(membershipEmailItem({ ...subscription, nextDueAt: new Date("2026-11-27T12:00:00Z") }, now), null);
});
test("comparación por día local, sin redondear horas restantes", () => {
  const subscription = { nextDueAt: new Date("2026-10-28T02:59:59Z"), plan: "PRO" as const, status: "ACTIVE" as const, trainer: { name: "Ana" } };
  assert.equal(membershipEmailItem(subscription, now)?.notice, "Vence hoy");
  assert.equal(membershipEmailItem({ ...subscription, nextDueAt: new Date("2026-10-28T03:00:00Z") }, now)?.notice, "Vence en 1 día");
});
test("endpoint exige secreto Bearer y falla cerrado", () => {
  const secret = "x".repeat(32);
  for (const authorization of ["", secret, `Bearer ${secret}x`, `Bearer ${"y".repeat(32)}`]) assert.equal(authorizedMasterCron(new Request("https://bm.test", { headers: { authorization } }), secret), false);
  const request = new Request("https://bm.test", { headers: { authorization: `Bearer ${secret}` } });
  assert.equal(authorizedMasterCron(request, secret), true);
  assert.equal(authorizedMasterCron(request, undefined), false);
  assert.equal(authorizedMasterCron(request, "short"), false);
});
test("envíos desactivados por defecto, local y preview; valida configuración", () => {
  const env = { MASTER_EMAIL_ENABLED: "true", VERCEL_ENV: "production", RESEND_API_KEY: "test-key", MASTER_EMAIL_FROM: "master@bm.test", MASTER_APP_URL: "https://bm.test/foo" };
  assert.equal(masterEmailConfig({}), null);
  assert.equal(masterEmailConfig({ ...env, VERCEL_ENV: "preview" }), null);
  assert.equal(masterEmailConfig({ ...env, VERCEL_ENV: undefined }), null);
  assert.equal(masterEmailConfig({ ...env, MASTER_EMAIL_ENABLED: "false" }), null);
  assert.equal(masterEmailConfig(env)?.masterUrl, "https://bm.test/master");
  assert.throws(() => masterEmailConfig({ ...env, RESEND_API_KEY: "" }));
  assert.throws(() => masterEmailConfig({ ...env, MASTER_APP_URL: "http://bm.test" }));
  assert.throws(() => masterEmailConfig({ ...env, MASTER_EMAIL_FROM: "evil\r\nbcc: a@b.test" }));
});
test("HTML y texto incluyen identidad, datos y acceso; escapan contenido", () => {
  const payload = renderMasterEmail([{ trainer: '<script>alert("x")</script>', plan: "PRO", dueAt: now.toISOString(), state: "Al día", notice: "Vence hoy" }], "2026-10-27", "BM Training <test@bm.test>", "https://bm.test/master");
  assert.deepEqual(payload.to, ["briiianm36@gmail.com"]);
  assert.doesNotMatch(payload.html, /<script>/);
  for (const content of ["#0a0a0a", "#ffffff", "#c9a44c", "Plan:", "Estado:", "Vencimiento:", "https://bm.test/master", "27/10/2026"]) assert.ok(payload.html.includes(content));
  assert.match(payload.text, /Entrenador:/);
});
test("Resend usa payload fijo, key idempotente y timeout; clasifica fallos sin filtrar secretos", async () => {
  const payload = renderMasterEmail([], "2026-10-27", "test@bm.test", "https://bm.test/master");
  const transport: typeof fetch = async (url, init) => {
    assert.equal(url, "https://api.resend.com/emails");
    assert.equal(new Headers(init?.headers).get("Idempotency-Key"), "bm-master/id");
    assert.equal(init?.body, JSON.stringify(payload));
    assert.ok(init?.signal);
    return Response.json({ id: "email-id" });
  };
  assert.equal(await sendMasterEmail(payload, "bm-master/id", "fake", transport), "email-id");
  const alteredPayload = { ...payload, to: ["trainer@bm.test"], cc: ["student@bm.test"], bcc: ["other@bm.test"] };
  assert.equal(await sendMasterEmail(alteredPayload, "bm-master/id", "fake", transport), "email-id");
  for (const status of [400, 401, 403, 409, 429, 500, 503]) {
    await assert.rejects(sendMasterEmail(payload, "key", "fake", async () => new Response("secret detail", { status })), { message: `RESEND_HTTP_${status}`, retryable: [409, 429, 500, 503].includes(status) });
  }
  await assert.rejects(sendMasterEmail(payload, "key", "fake", async () => { throw new Error("secret"); }), { message: "RESEND_NETWORK", retryable: true });
  await assert.rejects(sendMasterEmail(payload, "key", "fake", async () => Response.json({})), { message: "RESEND_INVALID_RESPONSE" });
});

test("suspensión sin fecha y seguimiento de invitaciones sin alertas obsoletas", () => {
 const sub = { nextDueAt:null, plan:"PRO" as const, status:"SUSPENDED" as const, trainer:{id:"trainer",name:"Prueba"} };
 assert.equal(membershipEmailItem(sub, now)?.state, "Suspendida");
 const invitation = {firstName:"Prueba",lastName:"Invitada",createdAt:new Date(now.getTime()-86400000),expiresAt:new Date(now.getTime()+86400000),status:"PENDING",acceptedAt:null};
 assert.equal(invitationEmailItem(invitation,now)?.destination,"invitations");
 assert.equal(invitationEmailItem({...invitation,acceptedAt:now},now),null);
 assert.equal(invitationEmailItem({...invitation,status:"CANCELLED"},now),null);
 assert.equal(invitationEmailItem({...invitation,expiresAt:new Date(now.getTime()-10*86400000)},now),null);
 assert.equal(invitationEmailItem({...invitation,createdAt:new Date(now.getTime()+1)},now),null);
 const payload=renderMasterEmail([membershipEmailItem(sub,now)!],"2026-10-27","test@bm.test","https://bm.test/master");
 assert.match(payload.text,/https:\/\/bm.test\/platform\/trainers\/trainer/);
 assert.match(payload.text,/Sin definir/);
});
