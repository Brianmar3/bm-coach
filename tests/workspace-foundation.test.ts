import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { INITIAL_WORKSPACE, isSelfServiceRecord, ownerIdentity, runWorkspaceFoundation } from "../scripts/workspace-foundation-core.mjs";
import { accessibleContentWhere, authorizedTrainerWorkspace, assertSameWorkspace, studentWorkspaceWhere, type TrainerMembership } from "../lib/workspace-access.ts";

type Student = { id: string; workspaceId: string | null; data: Record<string, unknown> };
function fakePrisma() {
  const state = {
    students: [
      { id: "coached-1", workspaceId: null, data: { firstName: "Ana" } },
      { id: "coached-2", workspaceId: null, data: { accountType: "COACHED" } },
      { id: "self-1", workspaceId: null, data: { accountType: "SELF_SERVICE" } },
    ] as Student[],
    settings: [{ id: "main", workspaceId: null, data: { email: "brian@example.com", coachName: "Brian" }, updatedAt: new Date() }],
    workspaces: [] as Array<Record<string, any>>, // eslint-disable-line @typescript-eslint/no-explicit-any
    users: [] as Array<Record<string, any>>, // eslint-disable-line @typescript-eslint/no-explicit-any
    memberships: [] as Array<Record<string, any>>, // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  const db: any = { // eslint-disable-line @typescript-eslint/no-explicit-any
    $transaction: async (callback: (tx: any) => unknown) => callback(db), // eslint-disable-line @typescript-eslint/no-explicit-any
    studentRecord: {
      findMany: async (args: any) => args?.where?.workspaceId === null ? state.students.filter((item) => item.workspaceId === null) : state.students, // eslint-disable-line @typescript-eslint/no-explicit-any
      updateMany: async ({ where, data }: any) => { const ids = new Set(where.id.in); let count = 0; for (const item of state.students) if (ids.has(item.id) && item.workspaceId === null) { item.workspaceId = data.workspaceId; count++; } return { count }; }, // eslint-disable-line @typescript-eslint/no-explicit-any
    },
    coachSettingsRecord: {
      findMany: async () => state.settings,
      findUnique: async () => state.settings[0] ?? null,
      updateMany: async ({ where, data }: any) => { let count = 0; for (const item of state.settings) if (item.id === where.id && item.workspaceId === null) { item.workspaceId = data.workspaceId; count++; } return { count }; }, // eslint-disable-line @typescript-eslint/no-explicit-any
    },
    workspace: {
      count: async (args: any) => state.workspaces.filter((row) => !args?.where?.type || row.type === args.where.type).length, // eslint-disable-line @typescript-eslint/no-explicit-any
      upsert: async ({ where, update, create }: any) => { let item = state.workspaces.find((row) => row.slug === where.slug); if (item) Object.assign(item, update); else { item = { id: `workspace-${state.workspaces.length + 1}`, ...create }; state.workspaces.push(item!); } return item; }, // eslint-disable-line @typescript-eslint/no-explicit-any
    },
    user: {
      count: async () => state.users.length,
      upsert: async ({ where, create }: any) => { let item = state.users.find((row) => row.email === where.email); if (!item) { item = { id: "user-1", ...create }; state.users.push(item!); } return item; }, // eslint-disable-line @typescript-eslint/no-explicit-any
    },
    workspaceMembership: {
      count: async () => state.memberships.length,
      upsert: async ({ where, update, create }: any) => { const key = where.workspaceId_userId; let item = state.memberships.find((row) => row.workspaceId === key.workspaceId && row.userId === key.userId); if (item) Object.assign(item, update); else { item = { id: "membership-1", ...create }; state.memberships.push(item!); } return item; }, // eslint-disable-line @typescript-eslint/no-explicit-any
    },
  };
  return { db, state };
}

test("la fundación crea workspace, owner y membership una sola vez", async () => {
  const { db, state } = fakePrisma();
  const first = await runWorkspaceFoundation(db, {});
  const second = await runWorkspaceFoundation(db, {});
  assert.equal(first.workspace.slug, INITIAL_WORKSPACE.slug);
  assert.equal(first.user.passwordHash, null);
  assert.equal(first.membership.role, "OWNER");
  assert.equal(state.workspaces.length, 2);
  assert.equal(state.users.length, 1);
  assert.equal(state.memberships.length, 1);
  assert.equal(second.studentsUpdated, 0);
  assert.equal(second.settingsUpdated, 0);
});

const membership = (userId: string, workspaceId: string): TrainerMembership => ({ userId, workspaceId, role: "OWNER", status: "ACTIVE", user: { status: "ACTIVE" }, workspace: { status: "ACTIVE", type: "PROFESSIONAL" } });

test("Coach A resuelve sólo A; no puede elegir B ni acceder a Student B", () => {
  const rows = [membership("coach-a", "a"), membership("coach-b", "b")];
  const actor = authorizedTrainerWorkspace("coach-a", rows);
  assert.equal(actor.workspaceId, "a");
  assert.doesNotThrow(() => assertSameWorkspace(actor.workspaceId, { workspaceId: "a" }));
  assert.throws(() => assertSameWorkspace(actor.workspaceId, { workspaceId: "b" }));
  assert.throws(() => assertSameWorkspace(actor.workspaceId, { workspaceId: null }));
  assert.throws(() => authorizedTrainerWorkspace("unknown", rows));
  assert.throws(() => studentWorkspaceWhere(""));
});

test("membresías ambiguas o suspendidas no autorizan", () => {
  assert.throws(() => authorizedTrainerWorkspace("a", [membership("a", "a"), membership("a", "b")]));
  for (const scope of ["membership", "user", "workspace"]) {
    const row = membership("a", "a");
    if (scope === "membership") row.status = "SUSPENDED";
    else if (scope === "user") row.user.status = "SUSPENDED";
    else row.workspace.status = "SUSPENDED";
    assert.throws(() => authorizedTrainerWorkspace("a", [row]));
  }
});

test("contenido global es visible para A y B, pero el privado sólo para su workspace", () => {
  const visible = (workspaceId: string, item: { workspaceId: string | null; scope: "GLOBAL" | "WORKSPACE" }) =>
    item.scope === "GLOBAL" || item.scope === "WORKSPACE" && item.workspaceId === workspaceId;
  const items = [
    { workspaceId: null, scope: "GLOBAL" as const },
    { workspaceId: "a", scope: "WORKSPACE" as const },
    { workspaceId: "b", scope: "WORKSPACE" as const },
  ];
  assert.deepEqual(items.filter((item) => visible("a", item)), items.slice(0, 2));
  assert.deepEqual(items.filter((item) => visible("b", item)), [items[0], items[2]]);
  assert.deepEqual(accessibleContentWhere("a"), { OR: [{ scope: "GLOBAL" }, { scope: "WORKSPACE", workspaceId: "a" }] });
});

test("el backfill conserva ownership previo y no reactiva al owner", async () => {
  const { db, state } = fakePrisma();
  await runWorkspaceFoundation(db, {});
  state.students[0].workspaceId = "other";
  await runWorkspaceFoundation(db, {});
  assert.equal(state.students[0].workspaceId, "other");
  state.memberships[0].status = "SUSPENDED";
  await assert.rejects(() => runWorkspaceFoundation(db, {}), /no reactiva permisos/);
  assert.equal(state.memberships[0].status, "SUSPENDED");
});

test("el backfill rechaza inferir ownership ambiguo", async () => {
  const { db, state } = fakePrisma();
  state.workspaces.push({ id: "b", slug: "b", type: "PROFESSIONAL" });
  await assert.rejects(() => runWorkspaceFoundation(db, {}), /no se puede inferir/);
});

test("search, ranking y notificaciones exigen scope en sus consultas", () => {
  for (const file of ["app/api/admin/command-search/route.ts", "app/api/admin/notifications/route.ts", "app/api/admin/push/diagnostics/route.ts", "app/api/admin/ranking/route.ts"]) {
    assert.match(readFileSync(file, "utf8"), /await requireTrainerWorkspace\(\)/);
  }
  assert.match(readFileSync("lib/point-ranking.ts", "utf8"), /AND: \[coachedStudentsWhere\], workspaceId/);
  assert.match(readFileSync("app/api/portal/ranking/route.ts", "utf8"), /loadPointRanking\("month", workspaceId\)/);
});

test("asigna alumnos gestionados al workspace inicial y SELF_SERVICE a PERSONAL", async () => {
  const { db, state } = fakePrisma();
  const beforeIds = state.students.map((student) => student.id);
  const result = await runWorkspaceFoundation(db, {});
  assert.equal(result.studentsUpdated, 2);
  assert.equal(result.settingsUpdated, 1);
  assert.deepEqual(state.students.map((student) => student.id), beforeIds);
  assert.ok(state.students.filter((student) => !isSelfServiceRecord(student.data)).every((student) => student.workspaceId === "workspace-1"));
  assert.equal(state.students.find((student) => isSelfServiceRecord(student.data))?.workspaceId, "workspace-2");
  assert.equal(state.workspaces[1].type, "PERSONAL");
  assert.equal(result.personalStudentsUpdated, 1);
  assert.equal(state.settings[0].workspaceId, "workspace-1");
});

test("owner usa configuración existente o variable explícita, nunca una contraseña inventada", () => {
  assert.deepEqual(ownerIdentity({ email: " Brian@Example.com ", coachName: "Brian" }, {}), { email: "brian@example.com", name: "Brian" });
  assert.deepEqual(ownerIdentity({}, { BM_INITIAL_OWNER_EMAIL: "owner@example.com", BM_INITIAL_OWNER_NAME: "Dueño" }), { email: "owner@example.com", name: "Dueño" });
  assert.throws(() => ownerIdentity({}, {}), /BM_INITIAL_OWNER_EMAIL/);
});

test("schema refleja CONTRACT y la cadena conserva el EXPAND seguro", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const expandMigration = readFileSync("prisma/migrations/20260909120000_workspace_foundation/migration.sql", "utf8");
  const contractMigration = readFileSync("prisma/migrations/20260916104324_workspace_foundation_contract/migration.sql", "utf8");
  const backfill = readFileSync("scripts/backfill-initial-workspace.mjs", "utf8");
  const verification = readFileSync("scripts/verify-workspace-foundation.mjs", "utf8");
  for (const model of ["User", "Workspace", "WorkspaceMembership"]) assert.match(schema, new RegExp(`model ${model} \\{`));
  for (const model of [
    "StudentRecord",
    "MonthlySummary",
    "TrainerPushSubscription",
    "TrainerNotification",
    "PaymentRecord",
    "EventRecord",
    "CoachEvent",
    "RoutineRecord",
    "TrainingRoutine",
    "TrainingLibraryFolder",
    "TrainingLibraryTag",
    "TrainingBlockTemplate",
    "EvaluationRecord",
    "CoachSettingsRecord",
    "WeeklyClassSchedule",
    "ClassOccurrence",
    "ClassSession",
  ]) {
    const block = schema.match(new RegExp(`model ${model} \\{[\\s\\S]*?\\n\\}`))?.[0] ?? "";
    assert.match(block, /^\s*workspaceId\s+String\s*$/m);
    assert.match(block, /^\s*workspace\s+Workspace\s+@relation\(fields: \[workspaceId\],/m);
  }
  assert.match(schema, /@@unique\(\[workspaceId, userId\]\)/);
  assert.doesNotMatch(expandMigration, /^\s*(?:DROP\s+TABLE|DELETE|TRUNCATE)\s/im);
  assert.match(expandMigration, /ALTER TABLE "students" ADD COLUMN "workspaceId" TEXT;/);
  assert.match(expandMigration, /ALTER TABLE "coach_settings" ADD COLUMN "workspaceId" TEXT;/);
  for (const table of ["monthly_summaries", "trainer_notifications", "payments", "events", "coach_events", "routines", "training_routines", "training_library_folders", "training_library_tags", "training_block_templates", "evaluations", "weekly_class_schedules", "class_occurrences", "classes"]) {
    assert.match(expandMigration, new RegExp(`ALTER TABLE "${table}" ADD COLUMN "workspaceId" TEXT`));
  }
  for (const table of ["students", "monthly_summaries", "trainer_push_subscriptions", "trainer_notifications", "payments", "events", "coach_events", "routines", "training_routines", "training_library_folders", "training_library_tags", "training_block_templates", "evaluations", "coach_settings", "weekly_class_schedules", "class_occurrences", "classes"]) {
    assert.match(contractMigration, new RegExp(`ALTER TABLE "${table}" ALTER COLUMN "workspaceId" SET NOT NULL`));
  }
  assert.doesNotMatch(contractMigration, /^\s*(?:DROP\s+TABLE|DELETE|TRUNCATE)\s/im);
  assert.match(schema, /enum WorkspaceContentScope \{[\s\S]*?GLOBAL[\s\S]*?WORKSPACE/);
  assert.match(backfill, /process\.argv\.includes\("--apply"\)/);
  assert.doesNotMatch(backfill, /deleteMany|delete\(/);
  assert.match(verification, /noCrossWorkspaceRelations/);
});

test("endpoints críticos resuelven workspace y filtran sus agregados", () => {
  for (const file of [
    "app/api/dashboard/route.ts",
    "app/api/resumen-mensual/route.ts",
    "app/api/eventos/route.ts",
    "app/api/clases/route.ts",
    "app/api/rutinas/route.ts",
    "app/api/training-library/blocks/route.ts",
    "app/api/admin/push/route.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /requireTrainerWorkspace/);
    assert.match(source, /workspaceId/);
  }
  assert.match(readFileSync("app/api/dashboard/route.ts", "utf8"), /ensureClassOccurrences\(35, workspaceId\)/);
  assert.match(readFileSync("lib/monthly-summary.ts", "utf8"), /workspaceId_year_month/);
  assert.match(readFileSync("scripts/workspace-foundation-core.mjs", "utf8"), /cruza workspaces/);
});

test("el auth administrativo continúa dependiendo sólo del token y la cookie actuales", () => {
  const auth = readFileSync("lib/admin-auth.ts", "utf8");
  const login = readFileSync("app/api/admin/auth/login/route.ts", "utf8");
  assert.match(auth, /BM_COACH_ADMIN_TOKEN/);
  assert.match(auth, /bm_coach_admin_session/);
  assert.doesNotMatch(auth, /workspace|WorkspaceMembership|passwordHash/);
  assert.match(login, /verifyAdminCredential/);
  assert.doesNotMatch(login, /prisma|WorkspaceMembership/);
});
