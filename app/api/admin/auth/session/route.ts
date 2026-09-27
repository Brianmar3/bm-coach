import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, adminAuthError, verifyAdminSessionValue } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { trainerIdentityHasWorkspaceAccess } from "@/lib/trainer-session-access";

export async function GET() {
  const result = verifyAdminSessionValue((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if (!result.ok) {
    const failure = adminAuthError(result);
    return Response.json({ authenticated: false, error: failure.error }, { status: failure.status });
  }
  let user = result.userId ? await prisma.user.findUnique({ where: { id: result.userId }, include: { memberships: { include: { workspace: true } } } }) : null;
  if (!result.userId) {
    const owners = await prisma.workspaceMembership.findMany({ where: { role: "OWNER", status: "ACTIVE", user: { status: "ACTIVE" }, workspace: { slug: "bm-fuerza-funcional", status: "ACTIVE" } }, include: { user: { include: { memberships: { include: { workspace: true } } } } } });
    user = owners.length === 1 ? owners[0].user : null;
  }
  if (!user || !trainerIdentityHasWorkspaceAccess(user)) return Response.json({ authenticated: false, error: "La cuenta no tiene acceso a un workspace de entrenador." }, { status: 403 });
  return Response.json({ authenticated: true, role: result.role, platformOwner: false, onboardingCompleted: user.onboardingCompleted, expiresAt: result.expiresAt.toISOString() });
}
