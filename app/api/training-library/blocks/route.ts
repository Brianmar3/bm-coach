import { Prisma } from "@prisma/client";
import { requireAdminApiResponse } from "@/lib/admin-api-auth";
import { cleanLibraryBlockPayload, normalizedLibraryTags, serializeLibraryBlock, validateLibraryBlockPayload } from "@/lib/training-library";
import { prisma } from "@/lib/prisma";
import type { TrainingLibraryBlockPayload } from "@/types/training-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const include = { folder: { select: { id: true, name: true } }, tags: { include: { tag: { select: { name: true } } } } } as const;

export async function GET() {
  const unauthorized = await requireAdminApiResponse(); if (unauthorized) return unauthorized;
  const records = await prisma.trainingBlockTemplate.findMany({ include, orderBy: { updatedAt: "desc" } });
  return Response.json(records.map(serializeLibraryBlock));
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminApiResponse(); if (unauthorized) return unauthorized;
  try {
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
      return transaction.trainingBlockTemplate.create({ data: { name: clean.name, type: clean.block.type, content: clean.block as unknown as Prisma.InputJsonValue, folderId: clean.folderId || null, tags: { create: tags.map((tag) => ({ tagId: tag.id })) } }, include });
    });
    return Response.json(serializeLibraryBlock(record), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "FOLDER_NOT_FOUND") return Response.json({ error: "La carpeta ya no está disponible." }, { status: 404 });
    console.error("Error al crear bloque de Biblioteca", error);
    return Response.json({ error: "No se pudo guardar el bloque de Biblioteca." }, { status: 500 });
  }
}
