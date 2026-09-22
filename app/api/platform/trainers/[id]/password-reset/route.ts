import { platformOwnerApiAccess } from "@/lib/platform-auth";
import { prisma } from "@/lib/prisma";
import { validRequestOrigin } from "@/lib/portal-auth";
import { trainerPasswordResetExpiresAt, trainerPasswordResetToken, trainerPasswordResetTokenHash } from "@/lib/trainer-password-reset";

export async function POST(request: Request, context: RouteContext<"/api/platform/trainers/[id]/password-reset">) {
  const access = await platformOwnerApiAccess();
  if (!access.ok) return access.response;
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen de solicitud inválido." }, { status: 403 });
  const { id } = await context.params;
  const trainer = await prisma.user.findFirst({
    where: { id, platformRole: "TRAINER", memberships: { some: { role: "OWNER", workspace: { type: "PROFESSIONAL" } } } },
    select: { id: true },
  });
  if (!trainer) return Response.json({ error: "Entrenador no encontrado." }, { status: 404 });

  const token = trainerPasswordResetToken();
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.trainerPasswordResetToken.updateMany({ where: { trainerUserId: trainer.id, usedAt: null }, data: { usedAt: now } });
    await tx.trainerPasswordResetToken.create({ data: { trainerUserId: trainer.id, tokenHash: trainerPasswordResetTokenHash(token), expiresAt: trainerPasswordResetExpiresAt(now) } });
  });
  return Response.json({ resetUrl: new URL(`/trainer/reset-password/${token}`, request.url).toString(), expiresInMinutes: 30 }, { status: 201 });
}
