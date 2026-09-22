import { PlatformInvitations, type PlatformInvitation } from "@/componentes/platform-invitations";
import { requirePlatformOwnerPage } from "@/lib/platform-auth";
import { prisma } from "@/lib/prisma";
import { trainerInvitationDisplayStatus } from "@/lib/trainer-invitations";

export default async function PlatformInvitationsPage() {
  await requirePlatformOwnerPage();
  const invitations = await prisma.trainerInvitation.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, firstName: true, lastName: true, email: true, status: true, createdAt: true, expiresAt: true, acceptedAt: true } });
  const serialized: PlatformInvitation[] = invitations.map((item) => ({ id: item.id, firstName: item.firstName, lastName: item.lastName, email: item.email, createdAt: item.createdAt.toISOString(), expiresAt: item.expiresAt.toISOString(), displayStatus: trainerInvitationDisplayStatus(item) }));
  return <main className="px-4 py-5 sm:px-6 lg:px-10"><div className="mx-auto max-w-7xl"><PlatformInvitations invitations={serialized} /></div></main>;
}
