import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, adminAuthError, verifyAdminSessionValue } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const result = verifyAdminSessionValue((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if (!result.ok) {
    const failure = adminAuthError(result);
    return Response.json({ authenticated: false, error: failure.error }, { status: failure.status });
  }
  let user = result.userId ? await prisma.user.findUnique({ where: { id: result.userId }, select: { platformRole: true, onboardingCompleted: true } }) : null;
  if (!result.userId) {
    const owners = await prisma.workspaceMembership.findMany({ where: { role: "OWNER", status: "ACTIVE", user: { status: "ACTIVE" }, workspace: { slug: "bm-fuerza-funcional", status: "ACTIVE" } }, select: { user: { select: { platformRole: true, onboardingCompleted: true } } } });
    user = owners.length === 1 ? owners[0].user : null;
  }
  return Response.json({ authenticated: true, role: result.role, platformOwner: user?.platformRole === "PLATFORM_OWNER", onboardingCompleted: user?.onboardingCompleted ?? true, expiresAt: result.expiresAt.toISOString() });
}
