import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import {
  WORKSPACE_RESOURCE_NOT_FOUND,
  assertWritableWorkspaceContent,
  isWorkspaceResourceNotFound,
} from "../lib/workspace-access.ts";

const nativeRequire = createRequire(import.meta.url);

function load(file: string, mocks: Record<string, unknown>, testConsole: Pick<Console, "error">) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, {
    module: loaded,
    exports: loaded.exports,
    require: (name: string) => name in mocks ? mocks[name] : nativeRequire(name),
    Response,
    Request,
    Date,
    console: testConsole,
  });
  return loaded.exports as Record<string, (...args: any[]) => any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

function routeHarness() {
  const logged: unknown[] = [];
  const records = new Map([
    ["own-routine", { id: "own-routine", workspaceId: "workspace-a", scope: "WORKSPACE", name: "Propia" }],
    ["other-routine", { id: "other-routine", workspaceId: "workspace-b", scope: "WORKSPACE", name: "Privada ajena" }],
  ]);
  const accessError = () => Object.assign(new Error("internal ownership detail"), { code: WORKSPACE_RESOURCE_NOT_FOUND });
  const assertRoutineInWorkspace = async (id: string, workspaceId: string) => {
    const record = records.get(id);
    if (!record || record.workspaceId !== workspaceId) throw accessError();
    return record;
  };
  class PrismaClientKnownRequestError extends Error { code = "UNKNOWN"; }
  const route = load("app/api/rutinas/[id]/route.ts", {
    "@/lib/coached-students": { coachedStudentsWhere: {} },
    "@prisma/client": { Prisma: { PrismaClientKnownRequestError, prismaVersion: { client: "test" }, TransactionIsolationLevel: { Serializable: "Serializable" } } },
    "@/lib/rutinas": {
      databaseUnavailable: () => false,
      serializeRoutine: (record: unknown) => record,
      routineInclude: {},
    },
    "@/lib/prisma": { prisma: { trainingRoutine: { findUnique: async ({ where }: { where: { id: string } }) => records.get(where.id) ?? null } } },
    "@/lib/admin-api-auth": { requireAdminApiResponse: async () => null },
    "@/lib/trainer-workspace": { assertRoutineInWorkspace, requireTrainerWorkspace: async () => ({ workspaceId: "workspace-a" }) },
    "@/lib/workspace-access": {
      isWorkspaceResourceNotFound: (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === WORKSPACE_RESOURCE_NOT_FOUND,
    },
  }, { error: (...args: unknown[]) => logged.push(args) });
  const get = (id: string) => route.GET(new Request(`http://localhost/api/rutinas/${id}`), { params: Promise.resolve({ id }) });
  return { get, logged };
}

test("la rutina propia continúa accesible", async () => {
  const { get } = routeHarness();
  const response = await get("own-routine");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).id, "own-routine");
});

test("una rutina de otro workspace y una inexistente comparten un 404 sin filtrar existencia", async () => {
  const { get, logged } = routeHarness();
  const other = await get("other-routine");
  const missing = await get("missing-routine");
  assert.equal(other.status, 404);
  assert.equal(missing.status, 404);
  assert.notEqual(other.status, 500);
  assert.notEqual(missing.status, 500);
  assert.deepEqual(await other.json(), { error: "Rutina no encontrada." });
  assert.deepEqual(await missing.json(), { error: "Rutina no encontrada." });
  assert.equal(logged.length, 0);
});

test("el guard de escritura usa un error de acceso reconocible y no revela ownership", () => {
  for (const record of [null, { workspaceId: "workspace-b", scope: "WORKSPACE" }, { workspaceId: null, scope: "GLOBAL" }]) {
    assert.throws(
      () => assertWritableWorkspaceContent("workspace-a", record),
      (error) => isWorkspaceResourceNotFound(error) && error instanceof Error && error.message === "Recurso no disponible.",
    );
  }
});

test("todas las rutas hermanas de rutina convierten el error de workspace al contrato seguro", () => {
  for (const file of [
    "app/api/rutinas/[id]/route.ts",
    "app/api/rutinas/[id]/asignaciones/route.ts",
    "app/api/rutinas/[id]/ejercicios/route.ts",
    "app/api/rutinas/[id]/ejercicios/[exerciseId]/route.ts",
    "app/api/rutinas/[id]/duplicar/route.ts",
    "app/api/rutinas/[id]/versiones/route.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    const assertions = source.match(/assertRoutineInWorkspace\(/g)?.length ?? 0;
    const safeCatches = source.match(/isWorkspaceResourceNotFound\(error\)/g)?.length ?? 0;
    assert.equal(safeCatches, assertions, file);
  }
});
