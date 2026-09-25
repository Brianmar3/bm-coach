import { get } from "@vercel/blob";
import { activeStudentInvitation, invitationUnavailableMessage, studentInvitationWorkspaceAccess } from "@/lib/student-invitations-server";
import { loadWorkspaceBranding } from "@/lib/workspace-branding-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<"/api/student-invitations/[token]/logo">) {
  const { token } = await context.params;
  const invitation = await activeStudentInvitation(token);
  if (invitationUnavailableMessage(invitation) || !invitation || !await studentInvitationWorkspaceAccess(invitation.workspaceId, invitation.inviterId)) return new Response(null, { status: 404 });
  const branding = await loadWorkspaceBranding(invitation.workspaceId);
  if (branding.logoMode !== "CUSTOM" || !branding.customLogoUrl || !process.env.BLOB_READ_WRITE_TOKEN) return new Response(null, { status: 404 });
  try {
    const blob = await get(branding.customLogoUrl, { access: "private" });
    if (!blob?.stream) return new Response(null, { status: 404 });
    return new Response(blob.stream, { headers: { "Cache-Control": "private, no-store", "Content-Type": blob.blob.contentType ?? "application/octet-stream", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response(null, { status: 404 }); }
}
