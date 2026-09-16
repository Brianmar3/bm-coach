import assert from "node:assert/strict";
import test from "node:test";
import { runWorkspaceFoundation, WORKSPACE_BACKFILL_BATCH_SIZE } from "../scripts/workspace-foundation-core.mjs";

type Student = { id: string; workspaceId: string | null; data: Record<string, unknown> };
type Routine = { id: string; workspaceId: string | null; assignmentStudentIds: string[]; scope?: string };

function phasedFake() {
  const state = {
    students: [
      { id: "coached-1", workspaceId: null, data: { firstName: "Ana" } },
      { id: "coached-2", workspaceId: null, data: { accountType: "COACHED" } },
      { id: "self-1", workspaceId: null, data: { accountType: "SELF_SERVICE" } },
    ] as Student[],
    settings: [{ id: "main", workspaceId: null, data: { email: "owner@example.com", coachName: "Owner" } }],
    workspaces: [] as Array<Record<string, any>>, // eslint-disable-line @typescript-eslint/no-explicit-any
    users: [] as Array<Record<string, any>>, // eslint-disable-line @typescript-eslint/no-explicit-any
    memberships: [] as Array<Record<string, any>>, // eslint-disable-line @typescript-eslint/no-explicit-any
    routines: [{ id: "routine-1", workspaceId: null, assignmentStudentIds: ["coached-1"] }] as Routine[],
    relationChecks: 0,
    batchSizes: [] as number[],
  };

  const emptyRoot = {
    findMany: async () => [],
    updateMany: async () => ({ count: 0 }),
  };
  const db: any = { // eslint-disable-line @typescript-eslint/no-explicit-any
    $transaction: async (callback: (tx: any) => unknown) => callback(db), // eslint-disable-line @typescript-eslint/no-explicit-any
    $queryRawUnsafe: async () => { state.relationChecks += 1; return [{ count: 0 }]; },
    studentRecord: {
      findMany: async (args?: any) => args?.where?.workspaceId === null ? state.students.filter((item) => item.workspaceId === null) : state.students, // eslint-disable-line @typescript-eslint/no-explicit-any
      updateMany: async ({ where, data }: any) => { const ids = new Set(where.id.in); let count = 0; for (const item of state.students) if (ids.has(item.id) && item.workspaceId === null) { item.workspaceId = data.workspaceId; count += 1; } return { count }; }, // eslint-disable-line @typescript-eslint/no-explicit-any
    },
    coachSettingsRecord: {
      findMany: async () => state.settings,
      findUnique: async () => state.settings[0] ?? null,
      updateMany: async ({ data }: any) => { const item = state.settings[0]; if (!item || item.workspaceId !== null) return { count: 0 }; item.workspaceId = data.workspaceId; return { count: 1 }; }, // eslint-disable-line @typescript-eslint/no-explicit-any
    },
    workspace: {
      count: async (args?: any) => state.workspaces.filter((row) => !args?.where?.type || row.type === args.where.type).length, // eslint-disable-line @typescript-eslint/no-explicit-any
      findUnique: async ({ where }: any) => state.workspaces.find((row) => row.slug === where.slug) ?? null, // eslint-disable-line @typescript-eslint/no-explicit-any
      upsert: async ({ where, update, create }: any) => { let row = state.workspaces.find((item) => item.slug === where.slug); if (row) Object.assign(row, update); else { row = { id: `workspace-${state.workspaces.length + 1}`, ...create }; state.workspaces.push(row); } return row; }, // eslint-disable-line @typescript-eslint/no-explicit-any
    },
    user: {
      count: async () => state.users.length,
      findUnique: async ({ where }: any) => state.users.find((row) => row.email === where.email) ?? null, // eslint-disable-line @typescript-eslint/no-explicit-any
      upsert: async ({ where, create }: any) => { let row = state.users.find((item) => item.email === where.email); if (!row) { row = { id: `user-${state.users.length + 1}`, ...create }; state.users.push(row); } return row; }, // eslint-disable-line @typescript-eslint/no-explicit-any
    },
    workspaceMembership: {
      count: async () => state.memberships.length,
      findUnique: async ({ where }: any) => state.memberships.find((row) => row.workspaceId === where.workspaceId_userId.workspaceId && row.userId === where.workspaceId_userId.userId) ?? null, // eslint-disable-line @typescript-eslint/no-explicit-any
      upsert: async ({ where, create }: any) => { const key = where.workspaceId_userId; let row = state.memberships.find((item) => item.workspaceId === key.workspaceId && item.userId === key.userId); if (!row) { row = { id: `membership-${state.memberships.length + 1}`, ...create }; state.memberships.push(row); } return row; }, // eslint-disable-line @typescript-eslint/no-explicit-any
    },
    trainingRoutine: {
      findMany: async () => state.routines.filter((routine) => routine.workspaceId === null).map((routine) => ({ id: routine.id, assignments: routine.assignmentStudentIds.map((studentId) => ({ student: { workspaceId: state.students.find((student) => student.id === studentId)?.workspaceId ?? null } })) })),
      updateMany: async ({ where, data }: any) => { state.batchSizes.push(where.id.in.length); const ids = new Set(where.id.in); let count = 0; for (const routine of state.routines) if (ids.has(routine.id) && routine.workspaceId === null) { routine.workspaceId = data.workspaceId; routine.scope = data.scope; count += 1; } return { count }; }, // eslint-disable-line @typescript-eslint/no-explicit-any
    },
    trainingLibraryFolder: emptyRoot,
    trainingLibraryTag: emptyRoot,
    trainingBlockTemplate: emptyRoot,
    weeklyClassSchedule: emptyRoot,
    classOccurrence: emptyRoot,
    routineRecord: emptyRoot,
    classSession: emptyRoot,
    eventRecord: emptyRoot,
    paymentRecord: emptyRoot,
    evaluationRecord: emptyRoot,
    coachEvent: emptyRoot,
    monthlySummary: emptyRoot,
    trainerPushSubscription: emptyRoot,
    trainerNotification: emptyRoot,
  };
  return { db, state };
}

test("1. backfill desde estado legacy completa la base", async () => {
  const { db, state } = phasedFake();
  const result = await runWorkspaceFoundation(db, {});
  assert.equal(result.studentsUpdated, 2);
  assert.equal(result.personalStudentsUpdated, 1);
  assert.ok(state.students.every((student) => student.workspaceId));
});

test("2. segunda ejecución produce cero cambios", async () => {
  const { db } = phasedFake();
  await runWorkspaceFoundation(db, {});
  const second = await runWorkspaceFoundation(db, {});
  assert.equal(second.studentsUpdated, 0);
  assert.equal(second.personalStudentsUpdated, 0);
  assert.ok(Object.values(second.operationalUpdated).every((count) => count === 0));
});

test("3. una ejecución detenida después de una fase puede reanudarse", async () => {
  const { db, state } = phasedFake();
  await assert.rejects(() => runWorkspaceFoundation(db, {}, { afterPhase: (phase) => { if (phase === 3) throw new Error("stop"); } }), /stop/);
  assert.ok(state.students.every((student) => student.workspaceId));
  assert.equal(state.routines[0].workspaceId, null);
  await runWorkspaceFoundation(db, {});
  assert.ok(state.routines[0].workspaceId);
});

test("4. PERSONAL no se duplica", async () => {
  const { db, state } = phasedFake();
  await runWorkspaceFoundation(db, {});
  await runWorkspaceFoundation(db, {});
  assert.equal(state.workspaces.filter((workspace) => workspace.type === "PERSONAL").length, 1);
});

test("5. BM workspace y membership no se duplican", async () => {
  const { db, state } = phasedFake();
  await runWorkspaceFoundation(db, {});
  await runWorkspaceFoundation(db, {});
  assert.equal(state.workspaces.filter((workspace) => workspace.slug === "bm-fuerza-funcional").length, 1);
  assert.equal(state.memberships.length, 1);
});

test("6. assignments determinan el ownership de la rutina", async () => {
  const { db, state } = phasedFake();
  await runWorkspaceFoundation(db, {});
  const student = state.students.find((item) => item.id === "coached-1")!;
  assert.equal(state.routines[0].workspaceId, student.workspaceId);
});

test("7. una rutina con assignments cross-workspace se rechaza", async () => {
  const { db, state } = phasedFake();
  state.students[0].workspaceId = "workspace-a";
  state.students[1].workspaceId = "workspace-b";
  state.routines[0].assignmentStudentIds = ["coached-1", "coached-2"];
  await assert.rejects(() => runWorkspaceFoundation(db, {}), /cross-workspace/);
  assert.equal(state.routines[0].workspaceId, null);
});

test("8. un fallo tardío conserva las fases confirmadas", async () => {
  const { db, state } = phasedFake();
  db.trainingRoutine.updateMany = async () => { throw new Error("phase four failed"); };
  await assert.rejects(() => runWorkspaceFoundation(db, {}), /phase four failed/);
  assert.equal(state.workspaces.filter((workspace) => workspace.slug === "bm-fuerza-funcional").length, 1);
  assert.ok(state.students.every((student) => student.workspaceId));
});

test("9. rerun completa ownership pendiente después de un fallo", async () => {
  const { db, state } = phasedFake();
  const updateMany = db.trainingRoutine.updateMany;
  db.trainingRoutine.updateMany = async () => { throw new Error("temporary"); };
  await assert.rejects(() => runWorkspaceFoundation(db, {}), /temporary/);
  db.trainingRoutine.updateMany = updateMany;
  const rerun = await runWorkspaceFoundation(db, {});
  assert.equal(rerun.operationalUpdated.trainingRoutines, 1);
  assert.ok(state.routines[0].workspaceId);
});

test("10. la validación final queda en cero y usa batches acotados", async () => {
  const { db, state } = phasedFake();
  const progress: string[] = [];
  state.routines = Array.from({ length: 205 }, (_, index) => ({ id: `routine-${index}`, workspaceId: null, assignmentStudentIds: ["coached-1"] }));
  const result = await runWorkspaceFoundation(db, {}, { onProgress: (message) => progress.push(message) });
  assert.equal(result.after.studentsWithoutWorkspace, 0);
  assert.equal(result.after.coachSettingsWithoutWorkspace, 0);
  assert.equal(state.relationChecks, 5);
  assert.equal(WORKSPACE_BACKFILL_BATCH_SIZE, 100);
  assert.deepEqual(state.batchSizes, [100, 100, 5]);
  assert.equal(progress.length, 10);
  assert.ok(progress.every((message, index) => message.startsWith(`[${index + 1}/10]`) && /inspected=\d+ updated=\d+ skipped=\d+ durationMs=\d+/.test(message)));
  assert.ok(progress.every((message) => !message.includes("@")));
});
