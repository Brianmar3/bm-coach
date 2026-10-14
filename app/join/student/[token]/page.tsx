import { StudentInvitationOutcome } from "@/componentes/student-invitation-outcome";
import { studentInvitationDisplayStatus } from "@/lib/student-invitations";
import { StudentInvitationForm } from "@/componentes/student-invitation-form";
import { activeStudentInvitation, invitationUnavailableMessage, studentInvitationWorkspaceAccess } from "@/lib/student-invitations-server";
import { loadWorkspaceBranding } from "@/lib/workspace-branding-server";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function StudentInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await activeStudentInvitation(token);
  const status = invitation ? studentInvitationDisplayStatus(invitation) : "INVALID";
  if (status === "USED" && invitation) {
    const accessible = await studentInvitationWorkspaceAccess(invitation.workspaceId, invitation.inviterId);
    const branding = accessible ? await loadWorkspaceBranding(invitation.workspaceId) : undefined;
    return <StudentInvitationOutcome status="USED" branding={branding ? { displayName: branding.displayName, accentColor: branding.accentColor } : undefined} />;
  }
  if (status !== "PENDING") return <StudentInvitationOutcome status={status} />;
  const unavailable = invitationUnavailableMessage(invitation);
  if (unavailable || !invitation || !await studentInvitationWorkspaceAccess(invitation.workspaceId, invitation.inviterId)) return <StudentInvitationOutcome status="UNAVAILABLE" />;
  const branding = await loadWorkspaceBranding(invitation.workspaceId);
  return <StudentInvitationForm token={token} branding={{ accentColor: branding.accentColor, logoMode: branding.logoMode, displayName: branding.displayName }} />;
}
