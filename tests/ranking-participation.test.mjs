import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

const records = [
  { id: "private", data: { name: "Privada", rankingParticipation: false }, serviceType: "PERSONALIZED" },
  { id: "legacy", data: { name: "Anterior" }, serviceType: "CLASSES" },
  { id: "public", data: { name: "Visible", rankingParticipation: true }, serviceType: "MIXED" },
];
globalThis.rankingTestRecords = records;
const fixture = {
  "server-only": "",
  "@/lib/sports-point-policy": 'export const activeSportsPointStart = () => "2026-12-01";',
  "@/lib/payment-dates": 'export const argentinaMonthBounds = () => ({ nextMonthStart: "2027-01-01" }); export const argentinaDateTimeBoundary = value => new Date(value);',
  "@/lib/student-media": 'export const studentProfilePhoto = id => "/photo/" + id;',
  "@/lib/coached-students": 'export const coachedStudentsWhere = {};',
  "@/lib/prisma": `const movement = (studentId, points) => ({ studentId, points, eventKey: "sports:" + studentId, occurredAt: new Date("2026-12-02") });
    export const prisma = { studentRecord: { findMany: async () => globalThis.rankingTestRecords },
      studentPointTransaction: { findMany: async ({ where }) => [movement("private", 99), movement("legacy", 2), movement("public", 7)].filter(row => where.studentId.in.includes(row.studentId)) },
      studentMembershipHistory: { findMany: async () => [] } };`,
  "@/lib/attendance": 'export const studentName = data => data.name;',
  "@/lib/point-period": 'export const pointPeriodStart = () => new Date("2026-12-01");',
  "@/lib/student-service": 'export const isCompetitiveGamificationEligible = () => true; export const wasCompetitiveDuringMembership = () => true;',
  "@/lib/quick-log-point-reconciliation": 'export const reconcileInformativeQuickLogPoints = async () => {};',
  "@/lib/portal-auth": 'export const getPortalSession = async () => ({ studentId: "private", credential: { student: { workspaceId: "gym", data: globalThis.rankingTestRecords[0].data } } });',
  "@/lib/student-points": 'export const loadStudentPointSummary = async () => ({ monthlyTotal: 99 });',
};
const hook = registerHooks({ resolve(specifier, context, next) {
  if (specifier === "@/lib/point-ranking") return { url: new URL("../lib/point-ranking.ts", import.meta.url).href, shortCircuit: true };
  if (!Object.hasOwn(fixture, specifier)) return next(specifier, context);
  return { url: "data:text/javascript," + encodeURIComponent(fixture[specifier]), shortCircuit: true };
} });
const { GET } = await import("../app/api/portal/ranking/route.ts");
hook.deregister();

test("el ranking excluye la identidad y la puntuación pública, conserva los puntos propios y reordena la tabla", async () => {
  const response = await GET();
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const result = await response.json();
  assert.equal(result.currentPosition, null);
  assert.equal(result.currentPoints, 99);
  assert.deepEqual(result.ranking, [
    { studentId: "public", studentName: "Visible", profileImageUrl: "/photo/public", total: 7 },
    { studentId: "legacy", studentName: "Anterior", profileImageUrl: "/photo/legacy", total: 2 },
  ]);
  records[0].data.rankingParticipation = true;
  const restored = await (await GET()).json();
  assert.equal(restored.currentPosition, 1);
  assert.equal(restored.ranking[0].total, 99);
});

test("solo el entrenador del workspace puede cambiar la preferencia y se conserva el resto de la ficha", async () => {
  const state = { rankingParticipation: true, plan: "Semipersonalizado", monthlyFee: 55000 };
  globalThis.rankingTrainerWorkspace = null;
  globalThis.rankingStudentState = state;
  const mocks = {
    "@prisma/client": 'export const Prisma = { TransactionIsolationLevel: { Serializable: "Serializable" } };',
    "@/lib/coached-students": 'export const coachedStudentsWhere = { coached: true };',
    "@/lib/portal-auth": 'export const validRequestOrigin = request => request.headers.get("origin") === "http://localhost";',
    "@/lib/trainer-workspace": 'export const requireTrainerWorkspace = async () => globalThis.rankingTrainerWorkspace;',
    "@/lib/prisma": `export const prisma = { $transaction: async (fn, options) => {
      if (options.isolationLevel !== "Serializable") throw Error("Expected serializable transaction");
      return fn({ studentRecord: {
        findUnique: async ({ where }) => where.workspaceId === "gym" && where.id === "private" && where.AND[0].coached
          ? { data: globalThis.rankingStudentState } : null,
        update: async ({ data }) => Object.assign(globalThis.rankingStudentState, data.data),
      } });
    } };`,
  };
  const hooks = registerHooks({ resolve(specifier, context, next) {
    if (context.parentURL?.includes("ranking-participation/route.ts") && Object.hasOwn(mocks, specifier)) {
      return { url: "data:text/javascript," + encodeURIComponent(mocks[specifier]), shortCircuit: true };
    }
    return next(specifier, context);
  } });
  const { PATCH } = await import("../app/api/alumnos/[id]/ranking-participation/route.ts").finally(() => hooks.deregister());
  const submit = (rankingParticipation, origin = "http://localhost") => PATCH(new Request("http://localhost", {
    method: "PATCH", headers: { origin }, body: JSON.stringify({ rankingParticipation }),
  }), { params: Promise.resolve({ id: "private" }) });

  assert.equal((await submit(false)).status, 403);
  globalThis.rankingTrainerWorkspace = { workspaceId: "other-gym" };
  assert.equal((await submit(false)).status, 404);
  globalThis.rankingTrainerWorkspace = { workspaceId: "gym" };
  assert.equal((await submit("false")).status, 400);
  assert.equal((await submit(false, "http://external.test")).status, 403);
  assert.equal(state.rankingParticipation, true);
  assert.deepEqual(await (await submit(false)).json(), { rankingParticipation: false });
  assert.deepEqual(state, { rankingParticipation: false, plan: "Semipersonalizado", monthlyFee: 55000 });
});
