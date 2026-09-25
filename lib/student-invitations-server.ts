import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { studentInvitationDisplayStatus, studentInvitationTokenHash, validStudentInvitationToken } from "@/lib/student-invitations";

type Client = typeof prisma | Prisma.TransactionClient;

export async function activeStudentInvitation(token: string, client: Client = prisma) {
  if (!validStudentInvitationToken(token)) return null;
  const invitation = await client.studentInvitation.findUnique({
    where: { tokenHash: studentInvitationTokenHash(token) },
    include: { workspace: { select: { id: true, type: true, status: true } }, inviter: { select: { id: true, status: true } } },
  });
  return invitation;
}

export async function studentInvitationWorkspaceAccess(workspaceId: string, inviterId: string, client: Client = prisma) {
  const [inviterMembership, ownerMembership] = await Promise.all([
    client.workspaceMembership.findFirst({ where: { workspaceId, userId: inviterId, status: "ACTIVE", role: { in: ["OWNER", "COACH"] }, workspace: { type: "PROFESSIONAL", status: "ACTIVE" }, user: { status: "ACTIVE" } }, select: { id: true } }),
    client.workspaceMembership.findFirst({ where: { workspaceId, role: "OWNER", status: "ACTIVE", user: { status: "ACTIVE" } }, select: { user: { select: { trainerSubscription: { select: { status: true } } } } } }),
  ]);
  return Boolean(inviterMembership && ownerMembership && !["SUSPENDED", "CANCELLED"].includes(ownerMembership.user.trainerSubscription?.status ?? "ACTIVE"));
}

export function invitationUnavailableMessage(invitation: Awaited<ReturnType<typeof activeStudentInvitation>>, now = new Date()) {
  if (!invitation) return "Este enlace no existe o ya no está disponible.";
  const status = studentInvitationDisplayStatus(invitation, now);
  if (status === "USED") return "Este enlace ya fue utilizado.";
  if (status === "REVOKED") return "Esta invitación fue revocada.";
  if (status === "EXPIRED") return "Esta invitación venció. Pedile un enlace nuevo a tu entrenador.";
  if (invitation.workspace.type !== "PROFESSIONAL" || invitation.workspace.status !== "ACTIVE" || invitation.inviter.status !== "ACTIVE") return "Este espacio no está disponible para nuevas altas.";
  return null;
}
