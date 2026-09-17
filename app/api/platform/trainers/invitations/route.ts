import { Prisma } from "@prisma/client";
import { platformOwnerApiAccess } from "@/lib/platform-auth";
import { prisma } from "@/lib/prisma";
import { validRequestOrigin } from "@/lib/portal-auth";
import { parseTrainerInvitation, studentEmailConflict, TRAINER_INVITATION_DAYS, trainerInvitationToken, trainerInvitationTokenHash } from "@/lib/trainer-invitations";

export const runtime = "nodejs";
class IdentityConflict extends Error {}

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
  const token = trainerInvitationToken();
  const expiresAt = new Date(Date.now() + TRAINER_INVITATION_DAYS * 86400000);
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
