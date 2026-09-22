import { Prisma } from "@prisma/client";
import { platformOwnerApiAccess } from "@/lib/platform-auth";
import { prisma } from "@/lib/prisma";
import { validRequestOrigin } from "@/lib/portal-auth";
import { parseTrainerInvitation, studentEmailConflict, trainerInvitationDisplayStatus, trainerInvitationToken, trainerInvitationTokenHash } from "@/lib/trainer-invitations";
import { loadPlatformSettings } from "@/lib/platform-settings-server";

export const runtime = "nodejs";
class IdentityConflict extends Error {}

export async function GET() {
  const access = await platformOwnerApiAccess();
  if (!access.ok) return access.response;
  const invitations = await prisma.trainerInvitation.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, firstName: true, lastName: true, email: true, status: true, expiresAt: true, acceptedAt: true, createdAt: true } });
  const now = new Date();
  return Response.json({ invitations: invitations.map((invitation) => ({ ...invitation, displayStatus: trainerInvitationDisplayStatus(invitation, now) })) });
}

export async function POST(request: Request) {
  const access = await platformOwnerApiAccess();
  if (!access.ok) return access.response;
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen de solicitud inválido." }, { status: 403 });
  const raw = await request.text();
  if (raw.length > 4096) return Response.json({ error: "Solicitud demasiado grande." }, { status: 413 });
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return Response.json({ error: "Datos inválidos." }, { status: 400 }); }
  const input = parseTrainerInvitation(value);
  if (!input) return Response.json({ error: "Revisá nombre, apellido, email y datos opcionales." }, { status: 400 });
  const [token, settings] = await Promise.all([Promise.resolve(trainerInvitationToken()), loadPlatformSettings()]);
  const expiresAt = new Date(Date.now() + settings.invitationDays * 86400000);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(78341210)`;
      const [user, credential, students, pending] = await Promise.all([
        tx.user.findFirst({ where: { email: { equals: input.email, mode: "insensitive" } }, select: { id: true } }),
        tx.studentPortalCredential.findFirst({ where: { username: { equals: input.email, mode: "insensitive" } }, select: { studentId: true } }),
        tx.studentRecord.findMany({ select: { data: true } }),
        tx.trainerInvitation.findFirst({ where: { email: { equals: input.email, mode: "insensitive" }, status: "PENDING", expiresAt: { gt: new Date() } }, select: { id: true } }),
      ]);
      if (user || credential || studentEmailConflict(students, input.email) || pending) throw new IdentityConflict();
      await tx.trainerInvitation.create({ data: { ...input, inviterId: access.user.id, tokenHash: trainerInvitationTokenHash(token), expiresAt } });
    });
  } catch (error) {
    if (error instanceof IdentityConflict || error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ error: "Ese email ya pertenece a una cuenta o invitación existente." }, { status: 409 });
    console.error("No se pudo crear la invitación", error instanceof Error ? error.name : "Error");
    return Response.json({ error: "No se pudo crear la invitación." }, { status: 500 });
  }
  return Response.json({ invitationUrl: new URL(`/trainer/invite/${token}`, request.url).toString(), expiresAt: expiresAt.toISOString() }, { status: 201 });
}

export async function PATCH(request: Request) {
  const access = await platformOwnerApiAccess();
  if (!access.ok) return access.response;
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen de solicitud inválido." }, { status: 403 });
  const body = await request.json().catch(() => null) as { id?: unknown; action?: unknown } | null;
  if (!body || typeof body.id !== "string" || !["REGENERATE", "CANCEL"].includes(String(body.action))) return Response.json({ error: "Acción inválida." }, { status: 400 });
  const invitation = await prisma.trainerInvitation.findUnique({ where: { id: body.id } });
  if (!invitation) return Response.json({ error: "Invitación no encontrada." }, { status: 404 });
  if (invitation.status === "ACCEPTED" || invitation.acceptedAt) return Response.json({ error: "La invitación ya fue utilizada." }, { status: 409 });

  if (body.action === "CANCEL") {
    const cancelled = await prisma.trainerInvitation.updateMany({ where: { id: invitation.id, status: "PENDING", acceptedAt: null }, data: { status: "REVOKED" } });
    if (cancelled.count !== 1) return Response.json({ error: "La invitación ya no está pendiente." }, { status: 409 });
    return Response.json({ ok: true, displayStatus: "CANCELLED" });
  }

  const settings = await loadPlatformSettings();
  const token = trainerInvitationToken();
  const expiresAt = new Date(Date.now() + settings.invitationDays * 86400000);
  await prisma.trainerInvitation.update({ where: { id: invitation.id }, data: { tokenHash: trainerInvitationTokenHash(token), status: "PENDING", acceptedAt: null, expiresAt } });
  return Response.json({ invitationUrl: new URL(`/trainer/invite/${token}`, request.url).toString(), expiresAt: expiresAt.toISOString(), displayStatus: "PENDING" });
}
