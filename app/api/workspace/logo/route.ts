import { randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";
import type { Prisma } from "@prisma/client";
import { requireAdminApiResponse } from "@/lib/admin-api-auth";
import { validRequestOrigin } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { requireTrainerWorkspace } from "@/lib/trainer-workspace";
import { normalizeCustomLogoUrl, resolveWorkspaceBranding } from "@/lib/workspace-branding";
import { loadWorkspaceBrandingPlan } from "@/lib/workspace-branding-server";
import { validateWorkspaceLogoBytes, workspaceLogoMetadataError } from "@/lib/workspace-logo-upload";

export const runtime = "nodejs";

async function removeOwnedLogo(url: string) {
  const safeUrl = normalizeCustomLogoUrl(url);
  if (safeUrl) await del(safeUrl).catch((error) => console.error("No se pudo retirar el logo anterior", error));
}

async function authorize(request: Request) {
  if (!validRequestOrigin(request)) return { response: Response.json({ error: "Origen no permitido." }, { status: 403 }), workspace: null, plan: null };
  const authError = await requireAdminApiResponse();
  if (authError) return { response: authError, workspace: null, plan: null };
  const workspace = await requireTrainerWorkspace();
  const plan = await loadWorkspaceBrandingPlan(workspace.workspaceId);
  if (plan !== "PREMIUM") return { response: Response.json({ error: "El logo personalizado está disponible únicamente en el plan PREMIUM." }, { status: 403 }), workspace: null, plan: null };
  return { response: null, workspace, plan };
}

export async function POST(request: Request) {
  const auth = await authorize(request);
  if (auth.response || !auth.workspace || !auth.plan) return auth.response!;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({ error: "El almacenamiento de imágenes no está configurado." }, { status: 503 });

  const form = await request.formData();
  const file = form.get("logo");
  if (!(file instanceof File)) return Response.json({ error: "Seleccioná un logo." }, { status: 400 });
  const metadataError = workspaceLogoMetadataError(file);
  if (metadataError) return Response.json({ error: metadataError }, { status: metadataError.includes("3 MB") ? 413 : metadataError === "Seleccioná un logo." ? 400 : 415 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = validateWorkspaceLogoBytes(bytes, file.type);
  if (!type) return Response.json({ error: "El archivo no contiene una imagen PNG, JPG o WEBP válida." }, { status: 415 });

  const currentRecord = await prisma.coachSettingsRecord.findFirst({ where: { workspaceId: auth.workspace.workspaceId }, orderBy: { updatedAt: "desc" }, select: { id: true, data: true } });
  if (!currentRecord) return Response.json({ error: "Guardá primero la configuración general del workspace." }, { status: 409 });
  const current = currentRecord.data as Prisma.JsonObject;
  const previousUrl = normalizeCustomLogoUrl(current.customLogoUrl);
  let uploadedUrl = "";
  try {
    const blob = await put(`workspace-branding/${auth.workspace.workspaceId}/${randomUUID()}.${type.extension}`, Buffer.from(bytes), { access: "public", contentType: type.mime, addRandomSuffix: false });
    uploadedUrl = blob.url;
    const next = { ...current, customLogoUrl: blob.url, logoMode: "CUSTOM" } satisfies Prisma.InputJsonObject;
    await prisma.coachSettingsRecord.update({ where: { id: currentRecord.id }, data: { data: next } });
    if (previousUrl && previousUrl !== blob.url) await removeOwnedLogo(previousUrl);
    return Response.json({ ok: true, branding: resolveWorkspaceBranding(next, auth.plan) });
  } catch (error) {
    if (uploadedUrl) await removeOwnedLogo(uploadedUrl);
    console.error("No se pudo guardar el logo del workspace", error);
    return Response.json({ error: "No se pudo guardar el logo. Intentá nuevamente." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await authorize(request);
  if (auth.response || !auth.workspace || !auth.plan) return auth.response!;
  const currentRecord = await prisma.coachSettingsRecord.findFirst({ where: { workspaceId: auth.workspace.workspaceId }, orderBy: { updatedAt: "desc" }, select: { id: true, data: true } });
  if (!currentRecord) return Response.json({ ok: true, branding: resolveWorkspaceBranding(null, auth.plan) });
  const current = currentRecord.data as Prisma.JsonObject;
  const previousUrl = normalizeCustomLogoUrl(current.customLogoUrl);
  const next = { ...current, customLogoUrl: "", logoMode: "DEFAULT" } satisfies Prisma.InputJsonObject;
  await prisma.coachSettingsRecord.update({ where: { id: currentRecord.id }, data: { data: next } });
  if (previousUrl) await removeOwnedLogo(previousUrl);
  return Response.json({ ok: true, branding: resolveWorkspaceBranding(next, auth.plan) });
}
