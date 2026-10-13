import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { Prisma } from "@prisma/client";
const require = createRequire(import.meta.url);

type Handler = (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
function setup(edit: boolean, serviceType: string, scheduleId: string, conflict = false) {
  let isolation = "";
  let writes = 0;
  const schedules = [{ id: "schedule-a", workspaceId: "a" }, { id: "schedule-b", workspaceId: "b" }];
  const student = { id: "student-a", workspaceId: "a", data: {}, serviceType };
  const tx = {
    weeklyClassSchedule: { findMany: async ({ where }: { where: { workspaceId?: string; id: { in: string[] } } }) => schedules.filter(s => where.id.in.includes(s.id) && (!where.workspaceId || s.workspaceId === where.workspaceId)).map(s => ({ ...s, active: true, capacity: 10, assignments: [], _count: { assignments: 0 } })) },
    studentRecord: { findUnique: async () => student, findUniqueOrThrow: async () => student, create: async () => { writes++; return student; }, update: async () => { writes++; return student; } },
    weeklyClassAssignment: { createMany: async () => { writes++; }, updateMany: async () => { writes++; }, upsert: async () => { writes++; } },
  };
  const deps: Record<string, unknown> = {
    "@/lib/prisma": { prisma: { $transaction: async (run: (value: unknown) => Promise<unknown>, options: { isolationLevel: string }) => { isolation = options.isolationLevel; if (conflict) throw new Prisma.PrismaClientKnownRequestError("conflict", { code: "P2034", clientVersion: "test" }); return run(tx); } } },
    "@/lib/trainer-workspace": { requireTrainerWorkspace: async () => ({ workspaceId: "a" }) },
    "@/lib/coached-students": { coachedStudentsWhere: {} },
    "@/lib/student-enrollment": { getStudentPlanOptions: async () => [], parseStudentInput: () => ({ data: { scheduleIds: [scheduleId], serviceType, phone: "", status: "activo" } }), normalizePhone: () => "", studentJsonData: () => ({}), serializeStudent: (s: unknown) => s, studentInclude: {} },
    "@/lib/student-history": { recordInitialStudentHistory: async () => {}, recordStudentHistoryChange: async () => {} },
    "@/lib/student-points": { reconcileStudentPointsAfterMutation: async () => {} },
    "@/lib/trainer-plan-limits-server": { assertTrainerCanAddStudent: async () => {}, TrainerStudentLimitError: class extends Error {} },
    "@/lib/payment-dates": {}, "@prisma/client": { Prisma },
  };
  const code = ts.transpileModule(readFileSync(edit ? "app/api/alumnos/[id]/route.ts" : "app/api/alumnos/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {} as Record<string, Handler>;
  new Function("require", "exports", "console", code)((name: string) => name in deps ? deps[name] : require(name), exports, { error() {} });
  return { run: () => exports[edit ? "PUT" : "POST"](new Request("https://test.local/api/alumnos", { method: edit ? "PUT" : "POST", body: "{}" }), { params: Promise.resolve({ id: student.id }) }), writes: () => writes, isolation: () => isolation };
}
for (const edit of [false, true]) for (const service of ["CLASSES", "PERSONALIZED", "MIXED"]) {
  test((edit ? "editar" : "crear") + " " + service + ": rechaza horario de B sin escribir en A ni B", async () => {
    const fixture = setup(edit, service, "schedule-b");
    assert.equal((await fixture.run()).status, 400);
    assert.equal(fixture.writes(), 0);
  });
  test((edit ? "editar" : "crear") + " " + service + ": conserva horario propio", async () => {
    const fixture = setup(edit, service, "schedule-a");
    assert.equal((await fixture.run()).status, edit ? 200 : 201);
    assert.ok(fixture.writes() > 0);
    assert.equal(fixture.isolation(), "Serializable");
  });
}

for (const edit of [false, true]) test((edit ? "editar" : "crear") + ": conflicto concurrente es 409 sin escrituras", async () => {
  const fixture = setup(edit, "CLASSES", "schedule-a", true);
  assert.equal((await fixture.run()).status, 409);
  assert.equal(fixture.writes(), 0);
});
