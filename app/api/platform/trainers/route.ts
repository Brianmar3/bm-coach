import { platformOwnerApiAccess } from "@/lib/platform-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const access = await platformOwnerApiAccess();
  if (!access.ok) return access.response;
  const [trainers, invitations] = await Promise.all([
    prisma.user.findMany({
      where: { memberships: { some: { role: "OWNER", workspace: { type: "PROFESSIONAL" } } } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, status: true, platformRole: true, createdAt: true, memberships: { where: { role: "OWNER", workspace: { type: "PROFESSIONAL" } }, select: { workspace: { select: { id: true, name: true, _count: { select: { students: true } } } } } } },
    }),
    prisma.trainerInvitation.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, select: { id: true, firstName: true, lastName: true, email: true, expiresAt: true, createdAt: true } }),
  ]);
  return Response.json({ trainers, invitations });
}
