import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { accountDeletionRequestId, ACCOUNT_DELETION_BODY, isAccountDeletionRequest } from "../lib/account-deletion-request.ts";

const nativeRequire = createRequire(import.meta.url);
type Comment = { id: string; studentId: string; author: string; context: string; category: string; status: string; body: string; private: boolean; parentId?: string; createdAt: Date; updatedAt: Date };
const students = [
  { id: "student-a", workspaceId: "workspace-a", data: { firstName: "Ana", lastName: "López" } },
  { id: "student-a2", workspaceId: "workspace-a", data: { firstName: "Carla", lastName: "Ríos" } },
  { id: "student-b", workspaceId: "workspace-b", data: { firstName: "Beto", lastName: "Pérez" } },
];

function fixture() {
  const comments: Comment[] = [];
  const pushes: Array<{ workspaceId: string; payload: { title: string; body: string; url: string; tag: string } }> = [];
  let clock = 0;
  const stamp = () => new Date(Date.UTC(2026, 8, 30, 12, clock++));
  function matches(comment: Comment, where: Record<string, unknown>) {
    const student = students.find((item) => item.id === comment.studentId);
    const id = where.id as string | { startsWith?: string } | undefined;
    if (typeof id === "string" && comment.id !== id) return false;
    if (id && typeof id === "object" && id.startsWith && !comment.id.startsWith(id.startsWith)) return false;
    for (const key of ["studentId", "author", "context", "category", "status"] as const) if (where[key] && comment[key] !== where[key]) return false;
    if (where.student && student?.workspaceId !== (where.student as { workspaceId: string }).workspaceId) return false;
    return true;
  }
  const followUpComment = {
    findFirst: async ({ where }: { where: Record<string, unknown> }) => comments.find((item) => matches(item, where)) ?? null,
    findMany: async ({ where }: { where: Record<string, unknown> }) => comments.filter((item) => matches(item, where)).map((item) => ({ ...item, student: students.find((student) => student.id === item.studentId) })),
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const id = typeof data.id === "string" ? data.id : `audit-${comments.length}`;
      if (comments.some((item) => item.id === id)) throw new Error("duplicate id");
      const date = stamp();
      const record = { id, studentId: data.studentId as string, author: data.author as string, context: data.context as string, category: data.category as string, status: data.status as string, body: data.body as string, private: data.private as boolean, parentId: data.parentId as string | undefined, createdAt: date, updatedAt: date };
      comments.push(record);
      return record;
    },
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const selected = comments.filter((item) => matches(item, where));
      for (const item of selected) Object.assign(item, data, { updatedAt: stamp() });
      return { count: selected.length };
    },
  };
  const prisma = {
    studentRecord: { findFirst: async ({ where }: { where: { id: string; workspaceId: string } }) => students.find((item) => item.id === where.id && item.workspaceId === where.workspaceId) ?? null },
    followUpComment,
    $transaction: async <T>(callback: (transaction: { followUpComment: typeof followUpComment }) => Promise<T>) => callback({ followUpComment }),
  };
  function route(path: string, workspaceId = "workspace-a", options: { authenticated?: boolean; pushFails?: boolean } = {}) {
    const loaded = { exports: {} };
    const code = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const mocks: Record<string, unknown> = {
      "@/lib/prisma": { prisma },
      "@/lib/account-deletion-request": { accountDeletionRequestId, ACCOUNT_DELETION_BODY, isAccountDeletionRequest },
      "@/lib/portal-auth": { getPortalSession: async () => options.authenticated === false ? null : { studentId: workspaceId === "workspace-a" ? "student-a" : "student-b", credential: { mustChangePassword: false, student: { workspaceId } } }, validRequestOrigin: () => true },
      "@/lib/native-push-notifications": { sendTrainerNativePush: async (target: string, payload: unknown) => { pushes.push({ workspaceId: target, payload: payload as typeof pushes[number]["payload"] }); if (options.pushFails) throw new Error("sin dispositivos"); return { configured: false, delivered: false, results: [] }; } },
      "@/lib/admin-api-auth": { requireAdminApiResponse: async () => options.authenticated === false ? Response.json({ error: "No autorizado" }, { status: 401 }) : null },
      "@/lib/trainer-workspace": { requireTrainerWorkspace: async () => ({ workspaceId }) },
      "@prisma/client": { Prisma: { PrismaClientKnownRequestError: class extends Error {} } },
    };
    runInNewContext(code, { module: loaded, exports: loaded.exports, require: (name: string) => name in mocks ? mocks[name] : nativeRequire(name), Response, Request, Date, console });
    return loaded.exports as { GET: () => Promise<Response>; POST: (request: Request) => Promise<Response>; PATCH: (request: Request) => Promise<Response> };
  }
  return { comments, pushes, portal: (workspaceId?: string, options?: { authenticated?: boolean; pushFails?: boolean }) => route("app/api/portal/account-deletion/route.ts", workspaceId, options), admin: (workspaceId?: string, options?: { authenticated?: boolean }) => route("app/api/admin/account-deletion/route.ts", workspaceId, options) };
}

const post = () => new Request("http://localhost/api/portal/account-deletion", { method: "POST" });
const patch = (id: string) => new Request("http://localhost/api/admin/account-deletion", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: id }) });

test("creación y repetición: badge correcto, fecha conservada y push sólo una vez al workspace A", async () => {
  const state = fixture();
  const portal = state.portal();
  const id = accountDeletionRequestId("student-a");
  assert.equal((await portal.POST(post())).status, 201);
  assert.equal(state.comments.length, 1);
  assert.equal(state.comments[0].id, id);
  assert.equal(state.comments[0].studentId, "student-a");
  assert.equal(state.comments[0].body, ACCOUNT_DELETION_BODY);
  assert.equal(state.pushes.length, 1);
  assert.equal(state.pushes[0].workspaceId, "workspace-a");
  assert.match(state.pushes[0].payload.body, /Ana López solicitó eliminar/);
  const firstDate = state.comments[0].updatedAt.toISOString();
  assert.equal((await portal.POST(post())).status, 200);
  assert.equal(state.comments.length, 1);
  assert.equal(state.pushes.length, 1);
  assert.equal(state.comments[0].updatedAt.toISOString(), firstDate);
  const own = await state.admin().GET();
  assert.deepEqual((await own.json() as { requests: Comment[] }).requests.map((item) => item.id), [id]);
  assert.equal((await portal.GET().then((response) => response.json()) as { requestedAt: string }).requestedAt, firstDate);
});

test("entrenador B no ve ni resuelve solicitud de A por ID directo", async () => {
  const state = fixture();
  await state.portal().POST(post());
  const id = accountDeletionRequestId("student-a");
  assert.equal((await state.admin("workspace-b").GET().then((response) => response.json()) as { requests: unknown[] }).requests.length, 0);
  assert.equal((await state.admin("workspace-b").PATCH(patch(id))).status, 404);
  assert.equal(state.comments[0].status, "PENDING");
  assert.equal((await state.admin("workspace-a", { authenticated: false }).PATCH(patch(id))).status, 401);
});

test("contador incluye sólo solicitudes auténticas y pendientes del workspace", async () => {
  const state = fixture();
  await state.portal().POST(post());
  const base = state.comments[0];
  state.comments.push({ ...base, id: accountDeletionRequestId("student-a2"), studentId: "student-a2" });
  state.comments.push({ ...base, id: accountDeletionRequestId("student-b"), studentId: "student-b" });
  state.comments.push({ ...base, id: "account-deletion-falso", studentId: "student-a" });
  state.comments.push({ ...base, id: "audit-reviewed", status: "REVIEWED" });
  const response = await state.admin().GET();
  const body = await response.json() as { requests: Array<{ id: string }> };
  assert.equal(body.requests.length, 2);
  assert.deepEqual(body.requests.map((item) => item.id).sort(), [accountDeletionRequestId("student-a"), accountDeletionRequestId("student-a2")].sort());
});

test("resolver conserva trazabilidad, desaparece de pendientes y permite nueva solicitud sin nuevo ID", async () => {
  const state = fixture();
  const portal = state.portal();
  await portal.POST(post());
  const id = accountDeletionRequestId("student-a");
  const createdAt = state.comments[0].createdAt.toISOString();
  const reviewed = await state.admin().PATCH(patch(id));
  assert.equal(reviewed.status, 200);
  assert.equal((await reviewed.json() as { accountDeleted: boolean }).accountDeleted, false);
  assert.equal(state.comments[0].status, "REVIEWED");
  assert.equal(state.comments[0].createdAt.toISOString(), createdAt);
  assert.notEqual(state.comments[0].updatedAt.toISOString(), createdAt);
  assert.equal(state.comments[1].parentId, id);
  assert.equal(state.comments[1].private, true);
  assert.equal((await state.admin().GET().then((response) => response.json()) as { requests: unknown[] }).requests.length, 0);
  assert.equal((await portal.GET().then((response) => response.json()) as { requested: boolean }).requested, false);
  assert.equal((await portal.POST(post())).status, 201);
  assert.equal(state.comments[0].id, id);
  assert.equal(state.comments[0].status, "PENDING");
  assert.equal(state.pushes.length, 2);
});

test("sin Native Push la solicitud persiste; sin sesión no se crea", async () => {
  const state = fixture();
  assert.equal((await state.portal("workspace-a", { authenticated: false }).POST(post())).status, 401);
  assert.equal(state.comments.length, 0);
  assert.equal((await state.portal("workspace-a", { pushFails: true }).POST(post())).status, 201);
  assert.equal((await state.admin().GET().then((response) => response.json()) as { requests: unknown[] }).requests.length, 1);
});

test("panel muestra contador discreto y los textos conservan UTF-8", () => {
  const panel = readFileSync("componentes/student-account-deletion-requests.tsx", "utf8");
  const student = readFileSync("componentes/student-profile-settings-page.tsx", "utf8");
  const portal = readFileSync("app/api/portal/account-deletion/route.ts", "utf8");
  assert.match(panel, /requests\.length/);
  assert.match(panel, /Ver alumno/);
  assert.match(panel, /Gestionar solicitud/);
  assert.match(panel, /Marcar como resuelta \/ procesada/);
  assert.match(student, /requestedAt/);
  assert.match(student, /Solicitar eliminación de cuenta/);
  assert.doesNotMatch([panel, student, portal].join("\n"), /eliminaciÃ|SesiÃ|DebÃ/);
});
