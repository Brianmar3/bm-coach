import { hashPassword, passwordValidationError, validRequestOrigin } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { consumeTrainerPasswordResetToken, TrainerPasswordResetRejected } from "@/lib/trainer-password-reset";

export async function POST(request: Request, context: RouteContext<"/api/trainer/password-reset/[token]">) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen de solicitud inválido." }, { status: 403 });
  const body = await request.json().catch(() => null) as { password?: unknown; confirmPassword?: unknown } | null;
  if (!body || typeof body.password !== "string" || body.password !== body.confirmPassword) return Response.json({ error: "Las contraseñas no coinciden." }, { status: 400 });
  const passwordError = passwordValidationError(body.password);
  if (passwordError) return Response.json({ error: passwordError }, { status: 400 });
  const { token } = await context.params;
  if (!token || token.length > 128) return Response.json({ error: "El enlace no es válido." }, { status: 410 });
  const passwordHash = await hashPassword(body.password);
  const now = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      await consumeTrainerPasswordResetToken({
        findByTokenHash: (tokenHash) => tx.trainerPasswordResetToken.findUnique({ where: { tokenHash }, select: { id: true, trainerUserId: true, expiresAt: true, usedAt: true, trainer: { select: { platformRole: true } } } }),
        claim: async (id, claimedAt) => (await tx.trainerPasswordResetToken.updateMany({ where: { id, usedAt: null, expiresAt: { gt: claimedAt } }, data: { usedAt: claimedAt } })).count === 1,
        updateTrainerPassword: async (trainerUserId, nextPasswordHash) => { await tx.user.update({ where: { id: trainerUserId }, data: { passwordHash: nextPasswordHash } }); },
      }, token, passwordHash, now);
    });
  } catch (error) {
    if (error instanceof TrainerPasswordResetRejected) return Response.json({ error: "El enlace venció o ya fue utilizado." }, { status: 410 });
    throw error;
  }
  return Response.json({ ok: true });
}
