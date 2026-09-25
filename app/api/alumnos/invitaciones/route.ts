import { requireTrainerWorkspace } from "@/lib/trainer-workspace";
import { prisma } from "@/lib/prisma";
import { assertTrainerCanAddStudent, TrainerStudentLimitError } from "@/lib/trainer-plan-limits-server";
import { validRequestOrigin } from "@/lib/portal-auth";
import { decryptStudentInvitationToken, encryptStudentInvitationToken, STUDENT_INVITATION_DAYS, studentInvitationDisplayStatus, studentInvitationToken, studentInvitationTokenHash } from "@/lib/student-invitations";
import { studentInvitationWorkspaceAccess } from "@/lib/student-invitations-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { workspaceId } = await requireTrainerWorkspace();
    const invitations = await prisma.studentInvitation.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 30 });
    return Response.json({ invitations: invitations.map((item) => ({ id: item.id, createdAt: item.createdAt, expiresAt: item.expiresAt, status: studentInvitationDisplayStatus(item), url: item.status === "PENDING" && item.expiresAt > new Date() ? new URL(`/join/student/${decryptStudentInvitationToken(item.tokenCiphertext)}`, request.url).toString() : null })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("No se pudieron listar invitaciones de alumnos", error instanceof Error ? error.name : "Error");
    return Response.json({ error: "No se pudieron cargar las invitaciones." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  try {
    const { workspaceId, userId } = await requireTrainerWorkspace();
    if (!await studentInvitationWorkspaceAccess(workspaceId, userId)) return Response.json({ error: "No podés invitar alumnos a este espacio." }, { status: 403 });
    await assertTrainerCanAddStudent(workspaceId);
    const token = studentInvitationToken();
    const expiresAt = new Date(Date.now() + STUDENT_INVITATION_DAYS * 86400000);
    await prisma.studentInvitation.create({ data: { workspaceId, inviterId: userId, tokenHash: studentInvitationTokenHash(token), tokenCiphertext: encryptStudentInvitationToken(token), expiresAt } });
    return Response.json({ url: new URL(`/join/student/${token}`, request.url).toString(), expiresAt }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof TrainerStudentLimitError) return Response.json({ error: error.message }, { status: 409 });
    console.error("No se pudo crear invitación de alumno", error instanceof Error ? error.name : "Error");
    return Response.json({ error: "No se pudo crear la invitación." }, { status: 403 });
  }
}

export async function PATCH(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  try {
    const { workspaceId } = await requireTrainerWorkspace();
    const body = await request.json().catch(() => null) as { id?: unknown } | null;
    if (typeof body?.id !== "string") return Response.json({ error: "Invitación inválida." }, { status: 400 });
    const updated = await prisma.studentInvitation.updateMany({ where: { id: body.id, workspaceId, status: "PENDING", expiresAt: { gt: new Date() } }, data: { status: "REVOKED", revokedAt: new Date() } });
    if (updated.count !== 1) return Response.json({ error: "La invitación ya no está pendiente." }, { status: 409 });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("No se pudo revocar invitación de alumno", error instanceof Error ? error.name : "Error");
    return Response.json({ error: "No se pudo revocar la invitación." }, { status: 403 });
  }
}
