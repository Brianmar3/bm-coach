import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { ADMIN_SESSION_COOKIE, adminSessionCookieOptions, createAdminSessionValue } from "@/lib/admin-auth";
import { invitationIsUsable, trainerWorkspaceSlug } from "@/lib/platform-access";
import { prisma } from "@/lib/prisma";
import { hashPassword, passwordValidationError, validRequestOrigin } from "@/lib/portal-auth";
import { studentEmailConflict, trainerInvitationTokenHash } from "@/lib/trainer-invitations";
import { loadPlatformSettings } from "@/lib/platform-settings-server";
import { addUtcMonths } from "@/lib/trainer-subscription";

export const runtime = "nodejs";
class InvitationRejected extends Error {}
class IdentityConflict extends Error {}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen de solicitud inválido." }, { status: 403 });
  const body = await request.json().catch(() => null) as { password?: string; confirmPassword?: string } | null;
  if (!body || Object.keys(body).some((key) => !["password", "confirmPassword"].includes(key)) || body.password !== body.confirmPassword) return Response.json({ error: "Las contraseñas no coinciden." }, { status: 400 });
  const password = body.password ?? "";
  const passwordError = passwordValidationError(password);
  if (passwordError) return Response.json({ error: passwordError }, { status: 400 });
  const { token } = await params;
  if (!token || token.length > 128) return Response.json({ error: "Invitación inválida." }, { status: 404 });
  const passwordHash = await hashPassword(password);
  const settings = await loadPlatformSettings();
  let userId = "";
  try {
    await prisma.$transaction(async (tx) => {
      const tokenHash = trainerInvitationTokenHash(token);
      const invitation = await tx.trainerInvitation.findUnique({ where: { tokenHash } });
      if (!invitation || !invitationIsUsable(invitation)) throw new InvitationRejected();
      const [user, credential, students] = await Promise.all([
        tx.user.findFirst({ where: { email: { equals: invitation.email, mode: "insensitive" } }, select: { id: true } }),
        tx.studentPortalCredential.findFirst({ where: { username: { equals: invitation.email, mode: "insensitive" } }, select: { studentId: true } }),
        tx.studentRecord.findMany({ select: { data: true } }),
      ]);
      if (user || credential || studentEmailConflict(students, invitation.email)) throw new IdentityConflict();
      const claimed = await tx.trainerInvitation.updateMany({ where: { id: invitation.id, status: "PENDING", acceptedAt: null, expiresAt: { gt: new Date() } }, data: { status: "ACCEPTED", acceptedAt: new Date() } });
      if (claimed.count !== 1) throw new InvitationRejected();
      const displayName = `${invitation.firstName} ${invitation.lastName}`;
      const workspaceName = invitation.brandName || `Workspace ${displayName}`;
      const account = await tx.user.create({ data: { name: displayName, email: invitation.email, passwordHash, phone: invitation.phone, brandName: invitation.brandName, platformRole: "TRAINER", status: "ACTIVE", onboardingCompleted: false } });
      const workspace = await tx.workspace.create({ data: { name: workspaceName, slug: trainerWorkspaceSlug(workspaceName, randomBytes(6).toString("hex")), type: "PROFESSIONAL", status: "ACTIVE", timeZone: "America/Argentina/Buenos_Aires" } });
      const startedAt = new Date();
      const nextDueAt = addUtcMonths(startedAt, settings.initialPeriodMonths);
      await Promise.all([
        tx.workspaceMembership.create({ data: { userId: account.id, workspaceId: workspace.id, role: "OWNER", status: "ACTIVE" } }),
        tx.trainerSubscription.create({ data: { trainerUserId: account.id, plan: settings.defaultTrainerPlan, status: "ACTIVE", startedAt, currentPeriodEnd: nextDueAt, nextDueAt } }),
      ]);
      userId = account.id;
    }, { timeout: 15000 });
  } catch (error) {
    if (error instanceof InvitationRejected) return Response.json({ error: "La invitación es inválida, ya fue usada o venció." }, { status: 410 });
    if (error instanceof IdentityConflict || error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ error: "Ese email ya pertenece a otra cuenta." }, { status: 409 });
    console.error("No se pudo aceptar la invitación", error instanceof Error ? error.name : "Error");
    return Response.json({ error: "No se pudo completar la cuenta." }, { status: 500 });
  }
  const session = createAdminSessionValue(userId);
  if (!session) return Response.json({ error: "La autenticación administrativa no está configurada." }, { status: 503 });
  (await cookies()).set(ADMIN_SESSION_COOKIE, session.value, adminSessionCookieOptions(session.expiresAt));
  return Response.json({ next: "/trainer/onboarding" }, { status: 201 });
}
