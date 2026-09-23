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
import { persistUploadedWorkspaceLogo, WorkspaceLogoPersistenceError } from "@/lib/workspace-logo-persistence";

export const runtime = "nodejs";

async function removeOwnedLogo(url: string) {
  const safeUrl = normalizeCustomLogoUrl(url);
  if (safeUrl) await del(safeUrl).catch((error) => console.error("No se pudo retirar el logo anterior", error instanceof Error ? error.message : "Error"));
}

async function authorize(request: Request) {
  if (!validRequestOrigin(request)) return { response: Response.json({ error: "Origen no permitido.", code: "LOGO_ORIGIN_FORBIDDEN" }, { status: 403 }), workspace: null, plan: null };
  const authError = await requireAdminApiResponse();
  if (authError) return { response: authError, workspace: null, plan: null };
  const workspace = await requireTrainerWorkspace();
  const plan = await loadWorkspaceBrandingPlan(workspace.workspaceId);
  if (plan !== "PREMIUM") return { response: Response.json({ error: "El logo personalizado está disponible únicamente en el plan PREMIUM.", code: "LOGO_PLAN_FORBIDDEN" }, { status: 403 }), workspace: null, plan: null };
  return { response: null, workspace, plan };
}

export async function POST(request: Request) {
  const auth = await authorize(request);
  if (auth.response || !auth.workspace || !auth.plan) return auth.response!;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({ error: "El almacenamiento de imágenes no está configurado.", code: "LOGO_STORAGE_NOT_CONFIGURED" }, { status: 503 });

  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: "No se pudo leer el archivo seleccionado.", code: "LOGO_FORM_INVALID" }, { status: 400 });
  const file = form.get("logo");
  if (!(file instanceof File)) return Response.json({ error: "Seleccioná un logo.", code: "LOGO_FILE_MISSING" }, { status: 400 });
  const metadataError = workspaceLogoMetadataError(file);
  if (metadataError) return Response.json({ error: metadataError, code: metadataError.includes("3 MB") ? "LOGO_FILE_TOO_LARGE" : metadataError === "Seleccioná un logo." ? "LOGO_FILE_MISSING" : "LOGO_FILE_TYPE_INVALID" }, { status: metadataError.includes("3 MB") ? 413 : metadataError === "Seleccioná un logo." ? 400 : 415 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = validateWorkspaceLogoBytes(bytes, file.type);
  if (!type) return Response.json({ error: "El archivo no contiene una imagen PNG, JPG o WEBP válida.", code: "LOGO_FILE_SIGNATURE_INVALID" }, { status: 415 });

  const currentRecord = await prisma.coachSettingsRecord.findFirst({ where: { workspaceId: auth.workspace.workspaceId }, orderBy: { updatedAt: "desc" }, select: { id: true, data: true } });
  if (!currentRecord) return Response.json({ error: "Guardá primero la configuración general del workspace.", code: "LOGO_SETTINGS_MISSING" }, { status: 409 });
  const current = currentRecord.data as Prisma.JsonObject;
  const previousUrl = normalizeCustomLogoUrl(current.customLogoUrl);
  try {
    const { next } = await persistUploadedWorkspaceLogo({
      current,
      previousUrl,
      upload: () => put(`workspace-branding/${auth.workspace.workspaceId}/${randomUUID()}.${type.extension}`, Buffer.from(bytes), { access: "private", contentType: type.mime, addRandomSuffix: false }),
      persist: async (nextSettings) => { await prisma.coachSettingsRecord.update({ where: { id: currentRecord.id }, data: { data: nextSettings as Prisma.InputJsonObject } }); },
      remove: removeOwnedLogo,
    });
    return Response.json({ ok: true, branding: resolveWorkspaceBranding(next, auth.plan) });
  } catch (error) {
    const code = error instanceof WorkspaceLogoPersistenceError ? error.code : "SETTINGS_PERSISTENCE_FAILED";
    console.error("No se pudo guardar el logo del workspace", code, error instanceof Error && error.cause instanceof Error ? error.cause.message : "Error");
    return code === "STORAGE_UPLOAD_FAILED"
      ? Response.json({ error: "No se pudo subir el logo al almacenamiento. Verificá la configuración de Blob.", code: "LOGO_STORAGE_UPLOAD_FAILED" }, { status: 503 })
      : Response.json({ error: "El archivo se subió, pero no se pudo guardar la configuración. El logo anterior se conservó.", code: "LOGO_PERSISTENCE_FAILED" }, { status: 500 });
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
