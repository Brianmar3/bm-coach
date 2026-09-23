import { get } from "@vercel/blob";
import { requireAdminApiResponse } from "@/lib/admin-api-auth";
import { getPortalSession } from "@/lib/portal-auth";
import { requireTrainerWorkspace } from "@/lib/trainer-workspace";
import { normalizeCustomLogoUrl } from "@/lib/workspace-branding";
import { loadWorkspaceBranding } from "@/lib/workspace-branding-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function canReadLogo(source: string) {
  const portalSession = await getPortalSession({ allowSelfService: true });
  if (portalSession) {
    const branding = await loadWorkspaceBranding(portalSession.credential.student.workspaceId);
    if (branding.logoMode === "CUSTOM" && branding.customLogoUrl === source) return true;
  }

  const adminError = await requireAdminApiResponse();
  if (!adminError) {
    try {
      const workspace = await requireTrainerWorkspace();
      const branding = await loadWorkspaceBranding(workspace.workspaceId);
      if (branding.logoMode === "CUSTOM" && branding.customLogoUrl === source) return true;
    } catch {
      return false;
    }
  }
  return false;
}

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("source") ?? "";
  const source = normalizeCustomLogoUrl(requested);
  if (!source || source !== requested || !await canReadLogo(source)) return Response.json({ error: "Logo no disponible." }, { status: 404 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({ error: "El almacenamiento de imágenes no está configurado." }, { status: 503 });

  try {
    const result = await get(source, { access: "private" });
    if (!result || !result.stream) return Response.json({ error: "Logo no disponible." }, { status: 404 });
    return new Response(result.stream, {
      headers: {
        "Cache-Control": "private, max-age=300",
        "Content-Type": result.blob.contentType ?? "application/octet-stream",
        "Vary": "Cookie",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("No se pudo leer el logo privado del workspace", error instanceof Error ? error.message : "Error");
    return Response.json({ error: "Logo no disponible." }, { status: 503 });
  }
}
