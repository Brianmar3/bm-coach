import { getPortalSession } from "@/lib/portal-auth";
import { saveLatestExercises } from "@/lib/offline-classes";
import { offlineScope } from "@/lib/offline-training-types";
import { loadScopedExerciseCandidates } from "@/lib/unified-exercise-records";

export async function GET() {
  const session = await getPortalSession();
  if (!session) return new Response(null, { status: 401 });
  const { student, mustChangePassword } = session.credential;
  if (mustChangePassword || student.serviceType !== "CLASSES" || !student.workspaceId) {
    return new Response(null, { status: 403 });
  }
  const records = await loadScopedExerciseCandidates(session.studentId, student.workspaceId);
  return Response.json(saveLatestExercises(records), {
    headers: {
      "Cache-Control": "private, no-store",
      "X-BM-Offline-Scope": offlineScope(session.studentId, student.workspaceId, session.id),
    },
  });
}
