import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { accountDeletionRequestId, ACCOUNT_DELETION_BODY, isAccountDeletionRequest } from "../lib/account-deletion-request.ts";

const nativeRequire = createRequire(import.meta.url);

function loadRoute(prisma: unknown, options: { authenticated?: boolean; origin?: boolean; push?: (workspaceId: string, payload: unknown) => Promise<unknown> } = {}) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(readFileSync("app/api/portal/account-deletion/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const session = options.authenticated === false ? null : { studentId: "student-a", credential: { mustChangePassword: false, student: { workspaceId: "workspace-a" } } };
  const mocks: Record<string, unknown> = {
    "@/lib/prisma": { prisma },
    "@/lib/portal-auth": { getPortalSession: async () => session, validRequestOrigin: () => options.origin !== false },
    "@/lib/account-deletion-request": { accountDeletionRequestId, ACCOUNT_DELETION_BODY, isAccountDeletionRequest },
    "@/lib/native-push-notifications": { sendTrainerNativePush: options.push ?? (async () => ({ configured: false, delivered: false, results: [] })) },
    "@prisma/client": { Prisma: { PrismaClientKnownRequestError: class extends Error {} } },
  };
  runInNewContext(code, {
    module: loaded,
    exports: loaded.exports,
    require: (name: string) => name in mocks ? mocks[name] : nativeRequire(name),
    Response,
    Request,
    Date,
    console,
  });
  return loaded.exports as { POST: (request: Request) => Promise<Response>; GET: () => Promise<Response> };
}

test("la solicitud ignora IDs del cliente y usa alumno y workspace de la sesión", async () => {
  let createData: Record<string, unknown> | null = null;
  const prisma = {
    studentRecord: {
      findFirst: async ({ where }: { where: { id: string; workspaceId: string } }) => {
        assert.equal(where.id, "student-a");
        assert.equal(where.workspaceId, "workspace-a");
        return { id: "student-a", workspaceId: "workspace-a" };
      },
    },
    followUpComment: {
      findFirst: async () => null,
      create: async (input: Record<string, unknown>) => {
        createData = input;
        return { id: accountDeletionRequestId("student-a"), status: "PENDING", updatedAt: new Date("2026-09-30T12:00:00.000Z") };
      },
    },
  };
  const route = loadRoute(prisma);
  const response = await route.POST(new Request("http://localhost/api/portal/account-deletion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId: "student-b", workspaceId: "workspace-b" }) }));
  assert.equal(response.status, 201);
  assert.equal((createData?.data as { studentId: string }).studentId, "student-a");
  assert.doesNotMatch(readFileSync("app/api/portal/account-deletion/route.ts", "utf8"), /request\.json|searchParams/);
});

test("sin sesión o sin pertenencia al workspace no se crea ninguna solicitud", async () => {
  let created = false;
  const prisma = {
    studentRecord: { findFirst: async () => null },
    followUpComment: { create: async () => { created = true; } },
  };
  assert.equal((await loadRoute(prisma, { authenticated: false }).POST(new Request("http://localhost/api/portal/account-deletion", { method: "POST" }))).status, 401);
  assert.equal((await loadRoute(prisma).POST(new Request("http://localhost/api/portal/account-deletion", { method: "POST" }))).status, 401);
  assert.equal(created, false);
});

test("la UI confirma antes de solicitar y la página pública queda fuera del login", () => {
  const settings = readFileSync("componentes/student-profile-settings-page.tsx", "utf8");
  const publicPage = readFileSync("app/eliminar-cuenta/page.tsx", "utf8");
  const proxy = readFileSync("proxy.ts", "utf8");
  const frame = readFileSync("componentes/app-frame.tsx", "utf8");
  assert.match(settings, /Solicitar eliminación de cuenta/);
  assert.match(settings, /role="alertdialog"/);
  assert.match(settings, /puede ser irreversible/);
  assert.match(settings, /onClick=\{\(\) => setConfirming\(true\)\}/);
  assert.match(settings, /confirming &&[\s\S]*onClick=\{requestDeletion\}/);
  assert.match(publicPage, /Cómo solicitar la eliminación/);
  assert.match(publicPage, /Qué datos se eliminan/);
  assert.match(publicPage, /Conservación temporal/);
  assert.match(publicPage, /Contactar soporte/);
  assert.match(proxy, /path === "\/eliminar-cuenta"/);
  assert.match(frame, /pathname === "\/eliminar-cuenta"/);
});
