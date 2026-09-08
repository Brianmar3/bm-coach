/** Explicit integration check: creates two synthetic SELF_SERVICE accounts, then removes only those accounts. */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import process from "node:process";
import nextEnv from "@next/env";
import { PrismaClient, Prisma } from "@prisma/client";

if (!process.argv.includes("--run")) throw new Error("Use --run explicitly against a local Next production preview.");
const base = process.env.SELF_SERVICE_TEST_URL || "http://localhost:3012";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname)) throw new Error("Only a local HTTP preview is allowed.");
nextEnv.loadEnvConfig(process.cwd());
const db = new PrismaClient();
const marker = randomBytes(8).toString("hex");
const start = new Date();
const accounts = [0, 1].map((index) => ({ firstName: "E2E Autogestion", lastName: `Prueba ${marker}`, email: `bm-e2e-${marker}-${index}@example.invalid`, phone: `999${Array.from(randomBytes(12), (byte) => byte % 10).join("")}`, password: `TestA9-${randomBytes(18).toString("hex")}` }));
const coachedWhere = { OR: [{ data: { path: ["accountType"], equals: Prisma.AnyNull } }, { data: { path: ["accountType"], not: "SELF_SERVICE" } }] };
const clients = accounts.map(() => ({ cookie: "", id: "" }));
const checks = [];
function passed(name) { checks.push(name); console.log(`PASS ${name}`); }
async function request(path, { method = "GET", body, cookie = "" } = {}) {
  return fetch(base + path, { method, redirect: "manual", headers: { origin: base, ...(cookie ? { cookie } : {}), ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
function responseCookies(response) { return response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; "); }
let baseline;
try {
  baseline = await db.studentRecord.count({ where: coachedWhere });
  for (const [index, account] of accounts.entries()) {
    const response = await request("/api/portal/registro", { method: "POST", body: { ...account, confirmPassword: account.password } });
    assert.equal(response.status, 201, `registration ${index}: ${await response.clone().text()}`);
    assert.equal((await response.json()).next, "/portal/onboarding");
    clients[index].cookie = responseCookies(response);
    const session = await request("/api/portal/session", { cookie: clients[index].cookie });
    assert.equal(session.status, 200);
    const payload = await session.json();
    assert.equal(payload.student.accountType, "SELF_SERVICE");
    clients[index].id = payload.student.id;
    const record = await db.studentRecord.findUniqueOrThrow({ where: { id: payload.student.id }, include: { portalCredential: true, _count: { select: { routineAssignments: true, weeklyClasses: true, attendances: true, payments: true, monthlyObligations: true, membershipHistory: true, classResponses: true } } } });
    assert.equal(record.data.accountType, "SELF_SERVICE"); assert.equal(record.data.trainerId, null); assert.equal(record.data.monthlyFee, 0); assert.equal(record.data.plan, "");
    assert.match(record.portalCredential.passwordHash, /^scrypt\$v1\$/);
    assert.ok(Object.values(record._count).every((count) => count === 0));
  }
  passed("dos registros reales crean identidad, credencial y sesión sin relaciones de alumnos");
  const duplicate = await request("/api/portal/registro", { method: "POST", body: { ...accounts[0], email: accounts[0].email.toUpperCase(), confirmPassword: accounts[0].password } });
  assert.equal(duplicate.status, 409); passed("email duplicado rechazado sin distinguir mayúsculas");
  const [owner, other] = clients;
  const profile = { birthDate: "1995-05-20", height: 178, weight: 73.5, goal: "Mantenerme activo", experienceLevel: "Principiante", trainingExperience: "Menos de 6 meses", hasLimitations: true, limitations: "Dato sintético de prueba", availableDays: [1, 3, 5], sessionMinutes: 45, trainingLocation: "Casa", equipment: ["Peso corporal", "Bandas"] };
  for (const step of [1, 2, 3, 4]) {
    const response = await request("/api/portal/onboarding", { method: "PATCH", cookie: owner.cookie, body: { step, complete: step === 4, data: { ...profile, studentId: other.id, accountType: "COACHED", trainerId: "test-escalation", monthlyFee: 999 } } });
    assert.equal(response.status, 200, `onboarding ${step}: ${await response.clone().text()}`);
  }
  const ownRecord = await db.studentRecord.findUniqueOrThrow({ where: { id: owner.id } });
  const otherRecord = await db.studentRecord.findUniqueOrThrow({ where: { id: other.id } });
  for (const [key, value] of Object.entries(profile)) assert.deepEqual(ownRecord.data[key], value, key);
  assert.equal(ownRecord.data.onboardingCompleted, true); assert.equal(ownRecord.data.accountType, "SELF_SERVICE"); assert.equal(ownRecord.data.trainerId, null); assert.equal(ownRecord.data.monthlyFee, 0);
  assert.equal(otherRecord.data.onboardingCompleted, false); assert.equal(otherRecord.data.birthDate, "");
  passed("los cuatro pasos persisten en la ficha propia y no alteran otra cuenta ni privilegios");
  const accountPage = await request("/portal/autogestion", { cookie: owner.cookie });
  assert.equal(accountPage.status, 200); const html = await accountPage.text(); assert.ok(html.includes("Usuario autogestionado")); assert.ok(html.includes(accounts[0].email)); assert.ok(!html.includes(accounts[1].email));
  passed("la cuenta autenticada muestra sólo el perfil propio");
  for (const path of ["/api/portal/data", "/api/portal/clases", "/api/portal/asistencias", "/api/portal/progreso", "/api/portal/ranking", "/api/dashboard", "/api/alumnos", `/api/alumnos/${other.id}`, "/api/pagos"]) {
    const response = await request(path, { cookie: owner.cookie }); assert.ok([401, 403].includes(response.status), `${path}: ${response.status}`);
  }
  for (const path of ["/api/portal/entrenamientos", "/api/rutinas", "/api/asistencias"]) {
    const response = await request(path, { method: "POST", cookie: owner.cookie, body: {} }); assert.ok([401, 403].includes(response.status), `${path}: ${response.status}`);
  }
  const dashboard = await request("/dashboard", { cookie: owner.cookie }); assert.equal(dashboard.status, 307); assert.ok(dashboard.headers.get("location").includes("/admin/login"));
  assert.equal(await db.studentRecord.count({ where: { AND: [coachedWhere], id: { in: clients.map((client) => client.id) } } }), 0);
  assert.equal(await db.studentRecord.count({ where: coachedWhere }), baseline);
  passed("SELF_SERVICE aislado de entrenador, clases, asistencia, cuotas y asignación de rutinas; alumnos previos conservados");
  const oldCookie = owner.cookie;
  assert.equal((await request("/api/portal/logout", { method: "POST", cookie: oldCookie })).status, 200);
  assert.equal((await request("/api/portal/session", { cookie: oldCookie })).status, 401);
  const login = await request("/api/portal/login", { method: "POST", body: { username: accounts[0].email, password: accounts[0].password } });
  assert.equal(login.status, 200); owner.cookie = responseCookies(login);
  const restored = await request("/api/portal/session", { cookie: owner.cookie }); assert.equal((await restored.json()).student.id, owner.id);
  assert.equal((await request("/portal/autogestion", { cookie: owner.cookie })).status, 200);
  assert.equal((await request("/api/portal/login", { method: "POST", body: { username: accounts[0].email, password: "ClaveIncorrecta123" } })).status, 401);
  passed("logout revoca la sesión; login restaura la misma identidad y rechaza contraseña incorrecta");
} finally {
  // Exact run-specific emails + account type + creation timestamp prevent touching existing accounts.
  const scope = { AND: [{ createdAt: { gte: start } }, { data: { path: ["accountType"], equals: "SELF_SERVICE" } }, { OR: accounts.map((account) => ({ data: { path: ["email"], equals: account.email } })) }] };
  try {
    const synthetic = await db.studentRecord.findMany({ where: scope, select: { id: true, data: true } });
    assert.ok(synthetic.length <= 2);
    for (const record of synthetic) assert.equal(record.data.lastName, `Prueba ${marker}`);
    const removed = await db.studentRecord.deleteMany({ where: { AND: [scope], id: { in: synthetic.map((record) => record.id) } } });
    assert.equal(await db.studentRecord.count({ where: scope }), 0);
    console.log(`CLEANUP ${removed.count} cuentas sintéticas eliminadas; alumnos del entrenador: ${await db.studentRecord.count({ where: coachedWhere })}`);
  } finally { await db.$disconnect(); }
}
console.log(`ETAPA A: ${checks.length} comprobaciones integrales aprobadas.`);
