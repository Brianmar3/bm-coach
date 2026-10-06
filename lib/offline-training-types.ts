import type { PortalData, PortalWorkoutSession } from "@/types/portal";
import type { WorkspaceBranding } from "@/lib/workspace-branding";

export type OfflineWorkoutData = Pick<PortalData, "routine" | "workoutSessions" | "exerciseMediaEnabled"> & { profile: Pick<PortalData["profile"], "id" | "serviceType"> };
export type OfflineTrainingSnapshot = {
  version: 1; scope: string; studentId: string; workspaceId: string; sessionId: string;
  expiresAt: string; savedAt: string; proof: string; branding: WorkspaceBranding; data: OfflineWorkoutData;
};
export type OfflineWorkoutRecord = {
  key: string; scope: string; clientId: string; proof: string; payload: PortalWorkoutSession;
  revision: number; pending: boolean; updatedAt: string; serverId?: string; error?: string;
};
export function offlineScope(studentId: string, workspaceId: string, sessionId: string) {
  return JSON.stringify([workspaceId, studentId, sessionId]);
}
export function offlineRecordKey(scope: string, payload: PortalWorkoutSession) {
  // Same per-day/per-week identity as the existing backend. Never use a student's name as a key.
  const day = new Date(`${payload.date}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return JSON.stringify([scope, payload.routineId, payload.dayId, day.toISOString().slice(0, 10)]);
}
export function nextOfflineRecord(previous: OfflineWorkoutRecord | undefined, snapshot: OfflineTrainingSnapshot, payload: PortalWorkoutSession, clientId: string): OfflineWorkoutRecord {
  if (previous?.payload.status === "finalizado") return previous;
  if (previous && JSON.stringify({ ...previous.payload, id: undefined }) === JSON.stringify({ ...payload, id: undefined })) return previous;
  return { key: offlineRecordKey(snapshot.scope, payload), scope: snapshot.scope, clientId: previous?.clientId ?? clientId, proof: previous?.proof ?? snapshot.proof, payload: structuredClone(payload), revision: (previous?.revision ?? 0) + 1, pending: true, updatedAt: new Date().toISOString(), serverId: previous?.serverId ?? payload.id };
}
