import { prisma } from "@/lib/prisma";
import { getPortalSession } from "@/lib/portal-auth";
import { GET as portalData } from "@/app/api/portal/data/route";
import { loadWorkspaceBranding } from "@/lib/workspace-branding-server";
import { offlineScope, type OfflineTrainingSnapshot } from "@/lib/offline-training-types";
import { signOfflineProgram } from "@/lib/offline-training-proof";
import type { PortalData } from "@/types/portal";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const session = await getPortalSession();
  if (!session) return Response.json({ error: "Sesión no válida." }, { status: 401 });
  if (session.credential.mustChangePassword || !["PERSONALIZED", "MIXED"].includes(session.credential.student.serviceType)) return Response.json({ error: "Sin rutina offline disponible." }, { status: 403 });
  const url = new URL(request.url); url.pathname = "/api/portal/data"; url.search = "?section=rutina";
  const response = await portalData(new Request(url));
  if (!response.ok) return response;
  const data = await response.json() as PortalData;
  const workspaceId = session.credential.student.workspaceId;
  if (!workspaceId || !data.routine) return Response.json({ error: "No tenés una rutina activa para guardar." }, { status: 404 });
  const assignment = await prisma.trainingRoutineAssignment.findUnique({ where: { routineId_studentId: { routineId: data.routine.id, studentId: session.studentId } }, include: { routine: { include: { days: { include: { exercises: true, blocks: { include: { exercises: true } } } } } } } });
  if (!assignment || assignment.routine.workspaceId !== workspaceId || !assignment.active || assignment.archivedAt || assignment.routine.archivedAt || assignment.routine.kind !== "ASSIGNED" || assignment.routine.status !== "ACTIVA" || assignment.routine.updatedAt.toISOString() !== data.routine.updatedAt) return Response.json({ error: "La rutina cambió. Reintentá." }, { status: 409 });
  const savedAt = new Date().toISOString();
  const expiresAt = session.expiresAt.toISOString();
  // Not a bearer credential: syncing requires an authenticated account in this workspace.
  const proof = signOfflineProgram({ studentId: session.studentId, workspaceId, sessionId: session.id, issuedAt: savedAt, expiresAt, assignment, sessionIds: data.workoutSessions.filter((s) => s.routineId === data.routine!.id && s.id).map((s) => s.id!) });
  const { studentIds: _ids, students: _students, historicalStudents: _historical, managementSummary: _summary, ...routine } = data.routine;
  void _ids; void _students; void _historical; void _summary;
  const snapshot: OfflineTrainingSnapshot = { version: 1, scope: offlineScope(session.studentId, workspaceId, session.id), studentId: session.studentId, workspaceId, sessionId: session.id, savedAt, expiresAt, proof, branding: await loadWorkspaceBranding(workspaceId), data: { profile: { id: session.studentId, serviceType: data.profile.serviceType }, routine: { ...routine, studentIds: [], students: [], historicalStudents: [] }, exerciseMediaEnabled: false, workoutSessions: data.workoutSessions.filter((s) => s.routineId === routine.id).slice(0, 8) } };
  return Response.json(snapshot, { headers: { "Cache-Control": "private, no-store" } });
}
