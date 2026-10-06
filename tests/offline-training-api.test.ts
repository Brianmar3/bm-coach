import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { Prisma } from "@prisma/client";
import { signOfflineProgram, verifyOfflineProgram, offlineWorkoutServerId } from "../lib/offline-training-proof.ts";
import { validateWorkoutSessionInput } from "../lib/workout-session-validation.ts";
import { getWeekKey, getWorkoutWeekRange, weeklySessionLockKey } from "../lib/workout-week.ts";
import { argentinaDateKey, databaseDateKey, dateKeyToDatabase } from "../lib/payment-dates.ts";

// Execute the real route with in-memory persistence and authenticated synthetic accounts.
// This checks response/retry semantics without changing any local or production DB.
const compiled = ts.transpileModule(readFileSync(new URL("../app/api/portal/entrenamientos/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const identity = { studentId: "student-a", workspaceId: "workspace-a", sessionId: "session-a" };
const exercise = { id: "exercise-a", name: "Nombre original", active: true, sets: 2, repetitions: "10", weight: 20, effortType: "RIR", effortValue: 2, restSeconds: 60, observations: "Instrucción original", order: 1 };
const day = { id: "day-a", active: true, archivedAt: null, dayNumber: 1, name: "Día original", estimatedMinutes: 30, exercises: [exercise], blocks: [{ id: "block-a", active: true, archivedAt: null, type: "STRENGTH", name: "Fuerza", order: 1, exercises: [exercise] }] };
const assignment = { studentId: identity.studentId, routineId: "routine-a", active: true, archivedAt: null, routine: { id: "routine-a", workspaceId: identity.workspaceId, kind: "ASSIGNED", status: "ACTIVA", archivedAt: null, name: "Rutina original", trainerNotificationsEnabled: false, days: [day] } };
const payload = { routineId: "routine-a", routineName: "Rutina original", dayId: "day-a", dayNumber: 1, date: "2026-09-25", startTime: "06:30", durationMinutes: 30, finalComment: "", generalFeeling: "Buena", hasPain: false, painDetails: "", status: "finalizado", exercises: [{ exerciseId: "exercise-a", exerciseName: "Client cannot replace program", observation: "Hecho sin internet", sets: [{ setNumber: 1, weight: 24, repetitions: 12, effort: 2, completed: true, observation: "" }] }] };
type Row = Record<string, unknown> & { id: string; studentId: string; routineId: string | null; dayId: string | null; date: Date; status: string };
function setup(live: typeof assignment | null = assignment, workspaceId = identity.workspaceId, serviceType = "PERSONALIZED") {
  const rows = new Map<string, Row>();
  const find = async ({ where }: { where: { id?: string; studentId?: string; routineId?: string; dayId?: string; status?: string; date?: { gte: Date; lt: Date } } }) => [...rows.values()].find((row) => (!where.id || row.id === where.id) && (!where.studentId || row.studentId === where.studentId) && (where.routineId === undefined || row.routineId === where.routineId) && (where.dayId === undefined || row.dayId === where.dayId) && (!where.status || row.status === where.status) && (!where.date || row.date >= where.date.gte && row.date < where.date.lt)) ?? null;
  const save = (data: Record<string, unknown>, id: string) => { const row = { ...data, id, exercises: (data.exercises as { create: unknown[] }).create, blocks: (data.blocks as { create: unknown[] }).create } as Row; rows.set(id, row); return row; };
  const db = { trainingRoutineAssignment: { findUnique: async () => live }, workoutSession: { findFirst: find, create: async ({ data }: { data: Record<string, unknown> & { id: string } }) => save(data, data.id), update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => save(data, where.id) }, workoutExerciseLog: { deleteMany: async () => {} }, workoutBlockLog: { deleteMany: async () => {} }, $executeRaw: async () => 1 };
  const dependencies: Record<string, unknown> = {
    "@prisma/client": { Prisma }, "@/lib/prisma": { prisma: { ...db, $transaction: async (work: (tx: typeof db) => Promise<unknown>) => work(db) } },
    "@/lib/portal-auth": { validRequestOrigin: () => true, getPortalSession: async () => ({ id: "new-authenticated-session", studentId: identity.studentId, credential: { mustChangePassword: false, student: { workspaceId, serviceType, data: {} } } }) },
    "@/lib/payment-dates": { argentinaDateKey, databaseDateKey, dateKeyToDatabase }, "@/lib/strength-achievements": { loadStrengthAchievements: async () => [] }, "@/lib/bm-training": { bmTrainingActivityStart: () => "2026-01-01" },
    "@/lib/push-notifications": { achievementCelebrationPayload: async () => [], notifyNewAchievements: async () => [] }, "@/lib/student-points": { reconcileStudentPointsAfterMutation: async () => null },
    "@/lib/workout-session-validation": { validateWorkoutSessionInput }, "@/lib/workout-week": { getWeekKey, getWorkoutWeekRange, weeklySessionLockKey }, "next/server": { after: () => {} },
    "@/lib/trainer-notifications": {}, "@/lib/workout-completion-notification": { shouldNotifyTrainerOfWorkout: () => false }, "@/lib/self-service": { isSelfService: () => false },
    "@/lib/offline-training-proof": { signOfflineProgram, verifyOfflineProgram, offlineWorkoutServerId },
  };
  const exported: { POST?: (request: Request) => Promise<Response> } = {};
  new Function("require", "exports", compiled)((name: string) => { if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`); return dependencies[name]; }, exported);
  return { rows, send: (body: unknown) => exported.POST!(new Request("http://localhost/api/portal/entrenamientos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })) };
}
test("real API: signed original program survives deletion, syncs prior week and acknowledges retries exactly once", async () => {
  const previous = process.env.BM_COACH_ADMIN_TOKEN; process.env.BM_COACH_ADMIN_TOKEN = "unit-test-secret-only-0123456789abcdef";
  try {
    const proof = signOfflineProgram({ ...identity, issuedAt: "2026-09-24T10:00:00Z", expiresAt: "2026-10-01T10:00:00Z", assignment });
    const offline = { clientSessionId: "ef6b00d3-9fab-4e54-bc0a-6c91a97c895b", proof };
    const server = setup(null);
    const response = await server.send({ ...payload, offline }); assert.equal(response.status, 200);
    const body = await response.json() as { id: string };
    const row = server.rows.get(body.id)!; assert.equal(row.routineId, null); assert.equal(row.dayId, null); assert.equal(row.routineNameSnapshot, "Rutina original");
    const logs = row.exercises as Array<{ exerciseId: string | null; exerciseName: string; targetSets: number; coachInstructions: string }>;
    assert.equal(logs[0].exerciseId, null); assert.equal(logs[0].exerciseName, "Nombre original"); assert.equal(logs[0].targetSets, 2); assert.equal(logs[0].coachInstructions, "Instrucción original");
    assert.equal(databaseDateKey(row.date), payload.date); assert.equal(row.startTime, "06:30");
    assert.equal((await server.send({ ...payload, offline })).status, 200);
    assert.equal((await server.send({ ...payload, id: body.id, offline })).status, 200);
    assert.equal(server.rows.size, 1);
    assert.equal((await server.send({ ...payload, id: body.id, status: "en_progreso", offline })).status, 409);
    assert.equal((await server.send({ ...payload })).status, 409); // Standard online week restriction remains.
    assert.equal((await setup().send({ ...payload, date: "2026-10-02", offline })).status, 200); // Receipt's original login expiry does not discard a late workout.
    assert.equal((await setup().send({ ...payload, date: "2099-01-01", offline })).status, 400);
    assert.equal((await setup(assignment, "workspace-b").send({ ...payload, offline })).status, 403);
    assert.equal((await setup(assignment, identity.workspaceId, "CLASSES").send({ ...payload, offline })).status, 403);
    assert.equal((await server.send({ ...payload, offline: { ...offline, proof: `${proof}tampered` } })).status, 403);
  } finally { if (previous === undefined) delete process.env.BM_COACH_ADMIN_TOKEN; else process.env.BM_COACH_ADMIN_TOKEN = previous; }
});
