import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as onboarding from "../lib/student-onboarding.ts";

const nativeRequire = createRequire(import.meta.url);
function routeAt(path: string, mocks: Record<string, unknown>) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, { module: loaded, exports: loaded.exports, require: (name: string) => name in mocks ? mocks[name] : nativeRequire(name), Request, Response, Date, console });
  return loaded.exports as { PATCH: (request: Request) => Promise<Response> };
}

const data = { birthDate: "2000-01-01", height: null, weight: null, goal: "Ganar fuerza", experienceLevel: "Principiante", trainingExperience: "1 a 3 años", trainingCurrently: true, hasLimitations: false, limitations: "" };

function onboardingRoute() {
  const writes: Array<Record<string, unknown>> = [];
  const route = routeAt("app/api/portal/onboarding/route.ts", {
    "@prisma/client": { Prisma: {} },
    "@/lib/prisma": { prisma: { studentRecord: { findUnique: async (query: unknown) => { assert.deepEqual(JSON.parse(JSON.stringify(query)), { where: { id: "own" }, select: { data: true } }); return { data: { trainingExperience: "Nunca entrené", workspaceMarker: "original" } }; }, update: async (value: Record<string, unknown>) => { writes.push(value); } } } },
    "@/lib/portal-auth": { validRequestOrigin: () => true, getPortalSession: async () => ({ studentId: "own", credential: { mustChangePassword: false } }) },
    "@/lib/student-onboarding": onboarding,
    "@/lib/self-service": { isSelfService: () => false },
  });
  return { writes, patch: (payload: Record<string, unknown>) => route.PATCH(new Request("http://localhost/api/portal/onboarding", { method: "PATCH", body: JSON.stringify(payload) })) };
}

test("onboarding permite completar sin ninguna medida y guarda null, experiencia y estado actual", async () => {
  const { writes, patch } = onboardingRoute();
  const response = await patch({ step: 4, complete: true, data: { ...data, studentId: "foreign", workspaceId: "foreign" } });
  assert.equal(response.status, 200);
  assert.equal(writes.length, 1);
  assert.equal((writes[0].where as { id: string }).id, "own");
  const saved = (writes[0].data as { data: Record<string, unknown> }).data;
  assert.equal(saved.height, null);
  assert.equal(saved.weight, null);
  assert.equal(saved.trainingCurrently, true);
  assert.equal(saved.trainingExperience, "1 a 3 años");
  assert.equal(saved.workspaceMarker, "original");
  assert.equal(saved.workspaceId, undefined);
});

test("onboarding también permite dejar vacía sólo una de las dos medidas", async () => {
  for (const measurements of [{ height: 178, weight: null }, { height: null, weight: 70 }]) {
    const { writes, patch } = onboardingRoute();
    assert.equal((await patch({ step: 4, complete: true, data: { ...data, ...measurements } })).status, 200);
    const saved = (writes[0].data as { data: Record<string, unknown> }).data;
    assert.equal(saved.height, measurements.height);
    assert.equal(saved.weight, measurements.weight);
  }
});

test("onboarding rechaza medidas inválidas sin escribir", async () => {
  for (const measurement of [{ height: 79 }, { weight: 351 }, { height: "180" }, { weight: 0 }]) {
    const { writes, patch } = onboardingRoute();
    const response = await patch({ step: 4, complete: true, data: { ...data, ...measurement } });
    assert.equal(response.status, 400);
    assert.equal(writes.length, 0);
  }
});

function profileRoute() {
  const writes: Array<Record<string, unknown>> = [];
  const workspaceChecks: string[] = [];
  const route = routeAt("app/api/portal/profile/route.ts", {
    "@prisma/client": { Prisma: { PrismaClientKnownRequestError: class extends Error {} } },
    "@/lib/prisma": { prisma: { studentRecord: { findUnique: async () => ({ data: { workspaceMarker: "original" }, workspaceId: "workspace-own" }) }, $transaction: async (action: (transaction: unknown) => Promise<unknown>) => action({ studentRecord: { update: async (value: Record<string, unknown>) => { writes.push(value); } } }) } },
    "@/lib/portal-auth": { validRequestOrigin: () => true, getPortalSession: async () => ({ studentId: "own" }) },
    "@/lib/student-enrollment": { normalizePhone: (value: string) => value.replace(/\D/g, ""), duplicatePhone: async (_transaction: unknown, workspaceId: string) => { workspaceChecks.push(workspaceId); return null; } },
    "@/lib/payment-dates": { isDateKey: () => true },
    "@/lib/student-onboarding": onboarding,
  });
  return { writes, workspaceChecks, patch: (payload: Record<string, unknown>) => route.PATCH(new Request("http://localhost/api/portal/profile", { method: "PATCH", body: JSON.stringify(payload) })) };
}

const profileData = { phone: "3415551234", email: "", birthDate: "2000-01-01", goal: "Ganar fuerza", height: null, weight: null, experienceLevel: "Principiante", trainingExperience: "1 a 3 años", trainingCurrently: false, hasLimitations: false, limitations: "" };

test("perfil permite medidas vacías, conserva experiencia y aísla alumno y workspace", async () => {
  const { writes, workspaceChecks, patch } = profileRoute();
  const response = await patch(profileData);
  assert.equal(response.status, 200);
  assert.equal(writes.length, 1);
  assert.equal((writes[0].where as { id: string }).id, "own");
  assert.deepEqual(workspaceChecks, ["workspace-own"]);
  const saved = (writes[0].data as { data: Record<string, unknown> }).data;
  assert.equal(saved.height, null);
  assert.equal(saved.weight, null);
  assert.equal(saved.trainingCurrently, false);
  assert.equal(saved.trainingExperience, "1 a 3 años");
  assert.equal(saved.workspaceMarker, "original");
});

test("perfil rechaza medidas inválidas y campos fuera de la lista", async () => {
  for (const change of [{ height: 0 }, { weight: 351 }, { weight: "70" }, { workspaceId: "foreign" }]) {
    const { writes, patch } = profileRoute();
    assert.equal((await patch({ ...profileData, ...change })).status, 400);
    assert.equal(writes.length, 0);
  }
});
