import { Prisma } from "@prisma/client";
import { requireAdminApiResponse } from "@/lib/admin-api-auth";
import { cleanLibraryBlockPayload, normalizedLibraryTags, serializeLibraryBlock, validateLibraryBlockPayload } from "@/lib/training-library";
import { prisma } from "@/lib/prisma";
import type { TrainingLibraryBlockPayload } from "@/types/training-library";

export const runtime = "nodejs";
const include = { folder: { select: { id: true, name: true } }, tags: { include: { tag: { select: { name: true } } } } } as const;

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdminApiResponse(); if (unauthorized) return unauthorized;
  try {
    const { id } = await context.params;
    const input = await request.json() as TrainingLibraryBlockPayload;
    const validationError = validateLibraryBlockPayload(input);
    if (validationError) return Response.json({ error: validationError }, { status: 400 });
    const clean = cleanLibraryBlockPayload(input);
    const record = await prisma.$transaction(async (transaction) => {
      if (clean.folderId) {
        const folder = await transaction.trainingLibraryFolder.findFirst({ where: { id: clean.folderId, status: "ACTIVE" }, select: { id: true } });
        if (!folder) throw new Error("FOLDER_NOT_FOUND");
      }
      const tags = await Promise.all(normalizedLibraryTags(clean.tags).map((tag) => transaction.trainingLibraryTag.upsert({ where: { normalizedName: tag.normalizedName }, update: {}, create: tag, select: { id: true } })));
      await transaction.trainingBlockTemplateTag.deleteMany({ where: { blockTemplateId: id } });
      return transaction.trainingBlockTemplate.update({ where: { id }, data: { name: clean.name, type: clean.block.type, content: clean.block as unknown as Prisma.InputJsonValue, folderId: clean.folderId || null, tags: { create: tags.map((tag) => ({ tagId: tag.id })) } }, include });
    });
    return Response.json(serializeLibraryBlock(record));
  } catch (error) {
    if (error instanceof Error && error.message === "FOLDER_NOT_FOUND") return Response.json({ error: "La carpeta ya no está disponible." }, { status: 404 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return Response.json({ error: "El bloque ya no existe." }, { status: 404 });
    console.error("Error al editar bloque de Biblioteca", error);
    return Response.json({ error: "No se pudo actualizar el bloque de Biblioteca." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdminApiResponse(); if (unauthorized) return unauthorized;
  try {
    const { id } = await context.params;
    const { action } = await request.json() as { action?: "archive" | "restore" };
    if (action !== "archive" && action !== "restore") return Response.json({ error: "Acción no válida." }, { status: 400 });
    const archived = action === "archive";
    const record = await prisma.trainingBlockTemplate.update({ where: { id }, data: { status: archived ? "ARCHIVED" : "ACTIVE", archivedAt: archived ? new Date() : null }, include });
    return Response.json(serializeLibraryBlock(record));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return Response.json({ error: "El bloque ya no existe." }, { status: 404 });
    console.error("Error al cambiar estado de bloque de Biblioteca", error);
    return Response.json({ error: "No se pudo cambiar el estado del bloque." }, { status: 500 });
  }
}
