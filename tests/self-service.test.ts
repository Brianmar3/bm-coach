import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as selfService from "../lib/self-service.ts";
import { onboardingValidation } from "../lib/student-onboarding.ts";

const nativeRequire = createRequire(import.meta.url);
function load(file: string, mocks: Record<string, unknown>) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, { module: loaded, exports: loaded.exports, require: (name: string) => name in mocks ? mocks[name] : nativeRequire(name), Response, Request, Date, Buffer, console, process });
  return loaded.exports as Record<string, (...args: any[]) => any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}
const input = { firstName: " Ana ", lastName: " Pérez ", email: " ANA@example.com ", phone: "+54 9 3404 123456", password: "Segura12345", confirmPassword: "Segura12345" };
const preferences = { availableDays: [1, 3, 5], sessionMinutes: 45, trainingLocation: "Casa", equipment: ["Peso corporal"] };
test("el copy público usa lenguaje natural sin cambiar rutas ni clasificación interna", () => {
  const login = readFileSync("componentes/portal-login-form.tsx", "utf8");
  assert.match(login, /href="\/portal\/crear-cuenta"[^>]*>Crear una cuenta nueva</);
  for (const file of ["componentes/portal-login-form.tsx", "componentes/portal-registration-form.tsx", "app/portal/autogestion/page.tsx", "componentes/student-onboarding.tsx"]) {
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visible: string[] = [];
    function visit(node: ts.Node) {
      if (ts.isJsxText(node)) visible.push(node.text);
      ts.forEachChild(node, visit);
    }
    visit(source);
    assert.doesNotMatch(visible.join(" "), /autogestionad[oa]|SELF_SERVICE|usuario independiente|cuenta (?:es )?independiente/i, file);
  }
  assert.match(readFileSync("app/portal/autogestion/perfil/page.tsx", "utf8"), /Mi cuenta/);
  assert.equal(selfService.isSelfService({ accountType: "SELF_SERVICE" }), true);
});
test("registro normaliza identidad y rechaza roles, IDs, servicios y datos inválidos", () => {
  assert.equal(selfService.parseRegistration(input)?.email, "ana@example.com");
  for (const key of ["accountType", "role", "studentId", "serviceType", "trainerId"]) assert.equal(selfService.parseRegistration({ ...input, [key]: "admin" }), null);
  for (const update of [{ phone: "abc" }, { email: "invalid" }, { confirmPassword: "other" }, { firstName: " " }]) assert.equal(selfService.parseRegistration({ ...input, ...update }), null);
  assert.equal(selfService.isSelfService({ serviceType: "PERSONALIZED" }), false);
  assert.equal(selfService.isSelfService({ accountType: "SELF_SERVICE" }), true);
});
test("preferencias autogestionadas: días, duración, ubicación y equipo reales", () => {
  assert.equal(selfService.selfServicePreferencesError(preferences), "");
  for (const update of [{ availableDays: [] }, { availableDays: [1, 1] }, { availableDays: [8] }, { sessionMinutes: 0 }, { trainingLocation: "inventado" }, { equipment: [] }]) assert.notEqual(selfService.selfServicePreferencesError({ ...preferences, ...update }), "");
});
test("datos físicos rechazan fechas inexistentes y valores no finitos", () => {
  const data = { birthDate: "2000-02-30", height: 175, weight: 70, goal: "Ganar fuerza", experienceLevel: "Principiante", trainingExperience: "Nunca entrené", hasLimitations: false, limitations: "", onboardingCompleted: false, onboardingUpdatedAt: "" };
  assert.notEqual(onboardingValidation(data, 1), "");
  assert.notEqual(onboardingValidation({ ...data, birthDate: "2000-01-01", height: NaN }, 1), "");
});

function registrationHarness(options: { duplicate?: boolean; fail?: boolean; recent?: number; origin?: boolean; weak?: boolean } = {}) {
  const writes: Array<Record<string, any>> = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  const cookieWrites: unknown[] = [];
  let locks = 0;
  const tx = {
    $executeRaw: async () => { locks++; },
    studentRecord: { count: async () => options.recent ?? 0, findMany: async () => options.duplicate ? [{ data: { email: "ANA@EXAMPLE.COM" }, phoneNormalized: null }] : [], create: async (value: Record<string, unknown>) => { if (options.fail) throw new Error("database unavailable"); writes.push(value); } },
    studentPortalCredential: { findUnique: async () => null },
  };
  const route = load("app/api/portal/registro/route.ts", {
    "next/headers": { cookies: async () => ({ set: (...args: unknown[]) => cookieWrites.push(args) }) },
    "@/lib/prisma": { prisma: { $transaction: async (callback: (value: typeof tx) => unknown) => callback(tx) } },
    "@/lib/portal-auth": { validRequestOrigin: () => options.origin !== false, passwordValidationError: () => options.weak ? "Contraseña insegura" : "", hashPassword: async () => "scrypt$hash", sessionTokenHash: () => "token-hash", portalCookieOptions: () => ({ httpOnly: true }), PORTAL_COOKIE: "portal" },
    "@/lib/portal-experience": { LAST_PORTAL_COOKIE: "last", portalExperienceCookieOptions: () => ({}) },
    "@/lib/self-service": selfService,
  });
  return { writes, cookieWrites, locks: () => locks, post: () => route.POST(new Request("http://localhost/api/portal/registro", { method: "POST", body: JSON.stringify(input) })) };
}
test("registro crea cuenta, credencial y sesión atómicamente y envía a onboarding", async () => {
  const h = registrationHarness(); const response = await h.post();
  assert.equal(response.status, 201);
  assert.equal((await response.json()).next, "/portal/onboarding");
  assert.equal(h.locks(), 1);
  assert.equal(h.writes.length, 1);
  const data = h.writes[0].data;
  assert.equal(data.data.accountType, "SELF_SERVICE"); assert.equal(data.data.trainerId, null);
  assert.equal(data.data.monthlyFee, 0); assert.equal(data.data.plan, ""); assert.equal(data.data.onboardingCompleted, false);
  assert.equal(data.portalCredential.create.username, "ana@example.com");
  assert.equal(data.portalCredential.create.passwordHash, "scrypt$hash");
  assert.equal(data.portalCredential.create.sessions.create.tokenHash, "token-hash");
  assert.equal(h.cookieWrites.length, 2);
});
test("duplicado, origen inválido, clave débil, límite o fallo DB no inician sesión", async () => {
  for (const [options, status] of [[{ duplicate: true }, 409], [{ origin: false }, 403], [{ weak: true }, 400], [{ recent: 10 }, 429], [{ fail: true }, 503]] as const) {
    const h = registrationHarness(options); assert.equal((await h.post()).status, status); assert.equal(h.cookieWrites.length, 0); assert.equal(h.writes.length, 0);
  }
});
test("sesión SELF_SERVICE requiere permiso explícito; alumnos actuales conservan acceso", async () => {
  let data: Record<string, string> = { accountType: "SELF_SERVICE" };
  const auth = load("lib/portal-auth.ts", {
    "server-only": {}, "next/headers": { cookies: async () => ({ get: () => ({ value: "token" }) }) }, "next/navigation": { redirect: () => {} },
    "@/lib/self-service": selfService,
    "@/lib/prisma": { prisma: { studentPortalSession: { findUnique: async () => ({ expiresAt: new Date(Date.now() + 60000), credential: { active: true, student: { data } } }) } } },
  });
  assert.equal(await auth.getPortalSession(), null);
  assert.ok(await auth.getPortalSession({ allowSelfService: true }));
  data = { serviceType: "CLASSES" }; assert.ok(await auth.getPortalSession());
  const hash = await auth.hashPassword("Segura12345");
  assert.notEqual(hash, "Segura12345");
  assert.equal(await auth.verifyPassword("Segura12345", hash), true);
  assert.equal(await auth.verifyPassword("incorrecta", hash), false);
});
test("onboarding usa ID de sesión y conserva clasificación aunque se envíen privilegios", async () => {
  let update: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const route = load("app/api/portal/onboarding/route.ts", {
    "@/lib/prisma": { prisma: { studentRecord: { findUnique: async () => ({ data: { accountType: "SELF_SERVICE", trainerId: null, monthlyFee: 0 } }), update: async (value: unknown) => { update = value; } } } },
    "@/lib/portal-auth": { validRequestOrigin: () => true, getPortalSession: async () => ({ studentId: "own-id", credential: { mustChangePassword: false } }) },
    "@/lib/self-service": selfService,
    "@/lib/student-onboarding": load("lib/student-onboarding.ts", {}),
  });
  const data = { ...preferences, birthDate: "2000-01-01", height: 175, weight: 70, goal: "Mantenerme activo", experienceLevel: "Principiante", trainingExperience: "Nunca entrené", hasLimitations: false, accountType: "COACHED", trainerId: "admin", monthlyFee: 999, studentId: "other" };
  const response = await route.PATCH(new Request("http://localhost/api/portal/onboarding", { method: "PATCH", body: JSON.stringify({ step: 4, complete: true, data }) }));
  assert.equal(response.status, 200); assert.equal(update.where.id, "own-id");
  assert.equal(update.data.data.accountType, "SELF_SERVICE"); assert.equal(update.data.data.trainerId, null); assert.equal(update.data.data.monthlyFee, 0);
  assert.equal(update.data.data.onboardingCompleted, true); assert.equal(update.data.data.goal, "Mantenerme activo"); assert.equal(update.data.data.sessionMinutes, 45);
});
test("las listas del entrenador y asignaciones excluyen autogestión; el store conserva esas cuentas", () => {
  for (const file of ["app/api/alumnos/route.ts", "app/api/dashboard/route.ts", "lib/payments.ts", "lib/monthly-summary.ts", "lib/point-ranking.ts", "lib/weekly-attendance-data.ts", "lib/weekly-classes.ts", "app/api/asistencias/route.ts", "app/api/rutinas/route.ts", "app/api/rutinas/[id]/asignaciones/route.ts"]) {
    assert.match(readFileSync(file, "utf8"), /where: (?:coachedStudentsWhere|\{[^}]*coachedStudentsWhere)/, file);
  }
  const store = readFileSync("app/api/store/[collection]/route.ts", "utf8");
  assert.match(store, /studentRecord\.deleteMany\(\{ where: coachedStudentsWhere \}\)/);
  assert.match(store, /if \(reserved\) return false/);
  assert.match(readFileSync("lib/coached-students.ts", "utf8"), /Prisma.AnyNull/);
});
