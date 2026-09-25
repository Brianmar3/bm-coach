import { StudentInvitationForm } from "@/componentes/student-invitation-form";
import { activeStudentInvitation, invitationUnavailableMessage, studentInvitationWorkspaceAccess } from "@/lib/student-invitations-server";
import { loadWorkspaceBranding } from "@/lib/workspace-branding-server";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function StudentInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await activeStudentInvitation(token);
  let unavailable = invitationUnavailableMessage(invitation);
  if (!unavailable && invitation && !await studentInvitationWorkspaceAccess(invitation.workspaceId, invitation.inviterId)) unavailable = "Este espacio no está disponible para nuevas altas.";
  if (unavailable || !invitation) return <main className="grid min-h-screen place-items-center bg-black p-4 text-white"><section className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6"><p className="text-xs font-black uppercase tracking-widest text-yellow-400">BM Training</p><h1 className="mt-3 text-2xl font-black">Invitación no disponible</h1><p className="mt-3 text-zinc-300">{unavailable}</p></section></main>;
  const branding = await loadWorkspaceBranding(invitation.workspaceId);
  return <StudentInvitationForm token={token} branding={{ accentColor: branding.accentColor, logoMode: branding.logoMode, displayName: branding.displayName }} />;
}
