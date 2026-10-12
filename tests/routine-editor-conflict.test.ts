import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

test("el PUT real rechaza una revisión vieja dentro de la transacción antes de escribir", async () => {
  const code = ts.transpileModule(readFileSync("app/api/rutinas/[id]/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const latest = "2026-10-10T14:00:00.000Z";
  const record = { id: "routine", updatedAt: new Date(latest), status: "BORRADOR", kind: "ASSIGNED", level: "INTERMEDIO", assignments: [], days: [] };
  let writes = 0, reads = 0, isolation = "";
  const database = { studentRecord: { count: async () => 0 }, $transaction: async (run: (tx: unknown) => Promise<unknown>, options: { isolationLevel: string }) => {
    isolation = options.isolationLevel;
    return run({ trainingRoutine: { findUnique: async () => { reads++; return record; }, findUniqueOrThrow: async () => record, update: async () => { writes++; throw new Error("Unexpected write"); } } });
  } };
  const helpers = { validateRoutine: () => null, routineFingerprint: () => "same", serializeRoutine: (value: unknown) => value, databaseUnavailable: () => false };
  const loaded = { exports: {} as { PUT: (request: Request, context: unknown) => Promise<Response> } };
  runInNewContext(code, { module: loaded, exports: loaded.exports, Response, Error, console, require: (name: string) => {
    if (name === "@/lib/prisma") return { prisma: database };
    if (name === "@/lib/rutinas") return helpers;
    if (name === "@/lib/trainer-workspace") return { requireTrainerWorkspace: async () => ({ workspaceId: "w" }), assertRoutineInWorkspace: async () => {} };
    if (name === "@/lib/workspace-access") return { isWorkspaceResourceNotFound: () => false };
    if (name === "@prisma/client") return { Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" }, PrismaClientKnownRequestError: class extends Error {} } };
    return {};
  } });
  for (const [revision, status] of [["2026-10-10T13:59:59.000Z", 409], [latest, 200], [undefined, 200]] as const) {
    const response = await loaded.exports.PUT(new Request("http://local/api/rutinas/routine", { method: "PUT", body: JSON.stringify({ kind: "assigned", studentIds: [], expectedUpdatedAt: revision }) }), { params: Promise.resolve({ id: "routine" }) });
    assert.equal(response.status, status);
    if (status === 409) assert.match((await response.json()).error, /Otra edición/);
  }
  assert.equal(reads, 3); assert.equal(writes, 0); assert.equal(isolation, "Serializable");
});
