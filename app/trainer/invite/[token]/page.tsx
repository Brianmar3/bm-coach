import { TrainerInvitationAccept } from "@/componentes/trainer-invitation-accept";
import { invitationIsUsable } from "@/lib/platform-access";
import { prisma } from "@/lib/prisma";
import { trainerInvitationTokenHash } from "@/lib/trainer-invitations";

export default async function TrainerInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = token && token.length <= 128 ? await prisma.trainerInvitation.findUnique({ where: { tokenHash: trainerInvitationTokenHash(token) } }) : null;
  return <main className="grid min-h-screen place-items-center bg-zinc-950 p-5 text-white"><TrainerInvitationAccept token={token} name={invitation ? invitation.firstName : "Entrenador"} usable={Boolean(invitation && invitationIsUsable(invitation))}/></main>;
}
