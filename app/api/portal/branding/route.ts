import { getPortalSession } from "@/lib/portal-auth";
import { loadWorkspaceAccentColor } from "@/lib/workspace-branding-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getPortalSession();
  if (!session) return Response.json({ error: "Sesión no válida." }, { status: 401 });
  const accentColor = await loadWorkspaceAccentColor(session.credential.student.workspaceId);
  return Response.json({ accentColor }, { headers: { "Cache-Control": "private, no-store" } });
}
