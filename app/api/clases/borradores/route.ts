import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validRequestOrigin } from "@/lib/portal-auth";
import { requireTrainerWorkspace } from "@/lib/trainer-workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DraftContent = { name: string; modality: string; text: string };
const validKey = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9:_-]{1,180}$/.test(value);
const validContent = (value: unknown): value is DraftContent => {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<DraftContent>;
  return typeof draft.name === "string" && draft.name.length <= 120
    && typeof draft.modality === "string" && draft.modality.length <= 65
    && typeof draft.text === "string" && draft.text.length <= 36000;
};

export async function GET(request: Request) {
  try {
    const { workspaceId, userId } = await requireTrainerWorkspace();
    const key = new URL(request.url).searchParams.get("key");
    if (!validKey(key)) return Response.json({ error: "Borrador inválido." }, { status: 400 });
    const draft = await prisma.groupClassDraft.findUnique({ where: { workspaceId_trainerId_draftKey: { workspaceId, trainerId: userId, draftKey: key } } });
    return Response.json({ owner: `${workspaceId}:${userId}`, draft: draft ? { content: draft.content, updatedAt: draft.updatedAt } : null });
  } catch {
    return Response.json({ error: "No se pudo recuperar el borrador." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  try {
    const { workspaceId, userId } = await requireTrainerWorkspace();
    const { key, content } = await request.json() as { key?: unknown; content?: unknown };
    if (!validKey(key) || !validContent(content)) return Response.json({ error: "Borrador inválido." }, { status: 400 });
    const draft = await prisma.groupClassDraft.upsert({
      where: { workspaceId_trainerId_draftKey: { workspaceId, trainerId: userId, draftKey: key } },
      create: { workspaceId, trainerId: userId, draftKey: key, content: content as unknown as Prisma.InputJsonValue },
      update: { content: content as unknown as Prisma.InputJsonValue },
      select: { updatedAt: true },
    });
    return Response.json({ updatedAt: draft.updatedAt });
  } catch {
    return Response.json({ error: "No se pudo sincronizar el borrador." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  try {
    const { workspaceId, userId } = await requireTrainerWorkspace();
    const { key } = await request.json() as { key?: unknown };
    if (!validKey(key)) return Response.json({ error: "Borrador inválido." }, { status: 400 });
    await prisma.groupClassDraft.deleteMany({ where: { workspaceId, trainerId: userId, draftKey: key } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "No se pudo retirar el borrador." }, { status: 500 });
  }
}
