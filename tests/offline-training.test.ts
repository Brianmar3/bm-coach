import assert from "node:assert/strict";
import test from "node:test";
import { nextOfflineRecord, offlineScope, offlineRecordKey, type OfflineTrainingSnapshot, type OfflineWorkoutRecord } from "../lib/offline-training-types.ts";
import { syncOfflineQueue } from "../lib/offline-training-sync.ts";
import { signOfflineProgram, verifyOfflineProgram, offlineWorkoutServerId } from "../lib/offline-training-proof.ts";
import type { PortalWorkoutSession } from "../types/portal.ts";

const identity = { studentId: "student-a", workspaceId: "workspace-a", sessionId: "session-a" };
const scope = offlineScope(identity.studentId, identity.workspaceId, identity.sessionId);
const snapshot = { ...identity, scope, proof: "signed-original", version: 1 } as OfflineTrainingSnapshot;
const payload: PortalWorkoutSession = { routineId: "routine-a", routineName: "Original", dayId: "day-a", dayNumber: 1, date: "2026-10-06", startTime: "06:30", durationMinutes: null, finalComment: "", hasPain: false, painDetails: "", status: "en_progreso", exercises: [] };
const uuid = "ef6b00d3-9fab-4e54-bc0a-6c91a97c895b";
function memory(initial: OfflineWorkoutRecord[]) {
  const map = new Map(initial.map((record) => [record.key, record]));
  return { map, records: async () => [...map.values()], updateRecord: async (key: string, update: (value: OfflineWorkoutRecord | undefined) => OfflineWorkoutRecord | undefined) => { const next = update(map.get(key)); if (next) map.set(key, next); } };
}
test("scope isolates student, workspace and original session; weekly keys remain stable", () => {
  for (const changed of [offlineScope("student-b", identity.workspaceId, identity.sessionId), offlineScope(identity.studentId, "workspace-b", identity.sessionId), offlineScope(identity.studentId, identity.workspaceId, "session-b")]) assert.notEqual(scope, changed);
  assert.equal(offlineRecordKey(scope, payload), offlineRecordKey(scope, { ...payload, date: "2026-10-11" }));
  assert.notEqual(offlineRecordKey(scope, payload), offlineRecordKey(scope, { ...payload, date: "2026-10-12" }));
});
test("receipt rejects tampering and other accounts/workspaces; same-account reauthentication can recover", () => {
  const previous = process.env.BM_COACH_ADMIN_TOKEN; process.env.BM_COACH_ADMIN_TOKEN = "unit-test-secret-only-0123456789abcdef";
  try {
    const original = { ...identity, issuedAt: "2026-10-06T10:00:00Z", expiresAt: "2026-10-13T10:00:00Z", assignment: { routine: { name: "Original" } } };
    const signed = signOfflineProgram(original);
    assert.deepEqual(verifyOfflineProgram(signed, identity), original);
    assert.deepEqual(verifyOfflineProgram(signed, { ...identity, sessionId: "new-session" }), original);
    assert.equal(verifyOfflineProgram(signed, { ...identity, studentId: "student-b" }), null);
    assert.equal(verifyOfflineProgram(signed, { ...identity, workspaceId: "workspace-b" }), null);
    assert.equal(verifyOfflineProgram(`x${signed}`, identity), null);
    assert.equal(verifyOfflineProgram(signOfflineProgram({ ...original, issuedAt: "invalid" }), identity), null);
    assert.equal(JSON.stringify(original).includes("token"), false);
  } finally { if (previous === undefined) delete process.env.BM_COACH_ADMIN_TOKEN; else process.env.BM_COACH_ADMIN_TOKEN = previous; }
});
test("server identity is deterministic across retries, isolated across accounts and validates client ID", () => {
  assert.equal(offlineWorkoutServerId(identity, uuid), offlineWorkoutServerId(identity, uuid));
  assert.notEqual(offlineWorkoutServerId(identity, uuid), offlineWorkoutServerId({ ...identity, workspaceId: "other" }, uuid));
  assert.throws(() => offlineWorkoutServerId(identity, "invalid"));
});
test("editing preserves original program proof and timestamps; identical ACK payload does not become pending again", () => {
  const first = nextOfflineRecord(undefined, snapshot, payload, uuid);
  const edited = nextOfflineRecord(first, { ...snapshot, proof: "new-program" }, { ...payload, finalComment: "saved offline" }, "other");
  assert.equal(edited.proof, "signed-original"); assert.equal(edited.clientId, uuid); assert.equal(edited.payload.startTime, "06:30");
  const acknowledged = { ...edited, pending: false, serverId: "server-a", payload: { ...edited.payload, id: "server-a" } };
  assert.equal(nextOfflineRecord(acknowledged, snapshot, edited.payload, uuid), acknowledged);
  const final = nextOfflineRecord(edited, snapshot, { ...edited.payload, status: "finalizado" }, uuid);
  assert.equal(nextOfflineRecord(final, snapshot, payload, uuid), final);
});
test("reconnection sends only current scope in chronological order and retains records", async () => {
  const later = nextOfflineRecord(undefined, snapshot, { ...payload, dayId: "day-b", startTime: "08:00" }, uuid);
  const first = nextOfflineRecord(undefined, snapshot, payload, uuid);
  const foreign = nextOfflineRecord(undefined, { ...snapshot, scope: "other" }, payload, uuid);
  const store = memory([later, foreign, first]); const sent: string[] = [];
  await syncOfflineQueue(snapshot, store, async (record) => { sent.push(record.payload.startTime); return { id: record.clientId }; });
  assert.deepEqual(sent, ["06:30", "08:00"]);
  assert.equal(store.map.get(first.key)?.pending, false); assert.equal(store.map.get(foreign.key)?.pending, true);
  assert.equal(store.map.size, 3);
});
test("failed sync and lost acknowledgement preserve queue; retry uses same identifier", async () => {
  const record = nextOfflineRecord(undefined, snapshot, payload, uuid); const store = memory([record]); const persisted = new Set<string>();
  await assert.rejects(syncOfflineQueue(snapshot, store, async (sent) => { persisted.add(sent.clientId); throw new Error("connection lost after save"); }));
  assert.equal(store.map.get(record.key)?.pending, true);
  await syncOfflineQueue(snapshot, store, async (sent) => { persisted.add(sent.clientId); return { id: "server-a" }; });
  assert.equal(persisted.size, 1); assert.equal(store.map.get(record.key)?.pending, false);
});
test("a late response cannot acknowledge edits made while request was in flight", async () => {
  const record = nextOfflineRecord(undefined, snapshot, payload, uuid); const store = memory([record]);
  await syncOfflineQueue(snapshot, store, async () => { store.map.set(record.key, nextOfflineRecord(record, snapshot, { ...payload, finalComment: "new change" }, uuid)); return { id: "server-a" }; });
  assert.equal(store.map.get(record.key)?.pending, true); assert.equal(store.map.get(record.key)?.payload.finalComment, "new change");
  await syncOfflineQueue(snapshot, store, async () => ({ id: "server-a" }));
  assert.equal(store.map.get(record.key)?.pending, false);
});
