import { prisma } from "@/lib/prisma";
import { getPortalSession } from "@/lib/portal-auth";
import { requireAdminApiResponse } from "@/lib/admin-api-auth";
import { requireTrainerWorkspace } from "@/lib/trainer-workspace";
import { isSelfService } from "@/lib/self-service";
import { loadPointRanking } from "@/lib/point-ranking";
import { isCompetitiveGamificationEligible } from "@/lib/student-service";
import { canReadStudentMedia, missingStudentImage, STUDENT_MEDIA_HEADERS, type MediaActor } from "@/lib/student-media";
import { readStudentPhoto } from "@/lib/student-media-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ kind: string; id: string }> };
const unavailable = () => Response.json({ error: "Imagen no disponible." }, { status: 404, headers: STUDENT_MEDIA_HEADERS });

export async function GET(_request: Request, context: Context) {
  const { kind, id } = await context.params;
  if (!["profile", "ranking", "progress"].includes(kind) || !/^[\w-]{1,128}$/.test(id)) return unavailable();
  try {
    let actor: MediaActor | null = null;
    const session = await getPortalSession({ allowSelfService: true });
    if (session) {
      if (session.credential.mustChangePassword) return unavailable();
      actor = { type: "student", studentId: session.studentId, workspaceId: session.credential.student.workspaceId, selfService: isSelfService(session.credential.student.data) };
    } else if (!await requireAdminApiResponse()) {
      try {
        const workspace = await requireTrainerWorkspace();
        actor = { type: "trainer", workspaceId: workspace.workspaceId };
      } catch { return unavailable(); }
    }
    if (!actor) return unavailable();
    const workspace = await prisma.workspace.findUnique({ where: { id: actor.workspaceId }, select: { status: true } });
    if (workspace?.status !== "ACTIVE") return unavailable();
    const photo = kind === "progress" ? await prisma.quickLogPhoto.findUnique({ where: { id }, include: { quickLog: { select: { id: true, studentId: true } } } }) : null;
    if (kind === "progress" && !photo) return unavailable();
    const student = await prisma.studentRecord.findUnique({ where: { id: photo?.quickLog.studentId ?? id }, select: { id: true, workspaceId: true, data: true } });
    if (!student || student.workspaceId !== actor.workspaceId) return unavailable();
    let rankingVisible = false;
    if (kind === "ranking" && session && actor.type === "student" && !actor.selfService && isCompetitiveGamificationEligible(session.credential.student.serviceType)) {
      const ranking = await loadPointRanking("month", actor.workspaceId);
      rankingVisible = ranking.some(entry => entry.studentId === session.studentId) && ranking.some(entry => entry.studentId === student.id);
    }
    const mediaKind = kind as "profile" | "ranking" | "progress";
    if (!canReadStudentMedia(actor, { ...student, selfService: isSelfService(student.data) }, mediaKind, rankingVisible)) return unavailable();
    const data = student.data as { profileImageUrl?: string };
    const image = await readStudentPhoto(photo?.blobUrl ?? data.profileImageUrl ?? "", student.id, photo ? "progress" : "profile", photo?.quickLogId);
    if (!image) return missingStudentImage();
    return new Response(image.bytes, { headers: { ...STUDENT_MEDIA_HEADERS, "Content-Type": image.contentType } });
  } catch {
    // Never log the URL, token or SDK error (which may contain them).
    return Response.json({ error: "No se pudo cargar la imagen. Intentá nuevamente." }, { status: 503, headers: STUDENT_MEDIA_HEADERS });
  }
}

export async function HEAD(request: Request, context: Context) {
  const response = await GET(request, context);
  await response.body?.cancel();
  return new Response(null, { status: response.status, headers: response.headers });
}
