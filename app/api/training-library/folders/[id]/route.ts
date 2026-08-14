import { Prisma } from "@prisma/client";
import { requireAdminApiResponse } from "@/lib/admin-api-auth";
import { normalizeLibraryText, serializeLibraryFolder, validateLibraryFolderName } from "@/lib/training-library";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdminApiResponse(); if (unauthorized) return unauthorized;
  try {
    const { id } = await context.params;
    const input = await request.json() as { action?: "rename" | "archive" | "restore"; name?: string };
    if (!input.action || !["rename", "archive", "restore"].includes(input.action)) return Response.json({ error: "Acción no válida." }, { status: 400 });
    if (input.action === "rename") {
      const validationError = validateLibraryFolderName(input.name);
      if (validationError) return Response.json({ error: validationError }, { status: 400 });
    }
    if (input.action === "archive") {
      const blockCount = await prisma.trainingBlockTemplate.count({ where: { folderId: id } });
      if (blockCount) return Response.json({ error: "Mové los bloques a Sin carpeta antes de archivar esta carpeta." }, { status: 409 });
    }
    const data = input.action === "rename" ? { name: input.name!.trim(), normalizedName: normalizeLibraryText(input.name!) } : input.action === "archive" ? { status: "ARCHIVED" as const, archivedAt: new Date() } : { status: "ACTIVE" as const, archivedAt: null };
    const folder = await prisma.trainingLibraryFolder.update({ where: { id }, data, include: { _count: { select: { blockTemplates: true } } } });
    return Response.json(serializeLibraryFolder(folder));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ error: "Ya existe una carpeta con ese nombre." }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return Response.json({ error: "La carpeta ya no existe." }, { status: 404 });
    console.error("Error al actualizar carpeta de Biblioteca", error);
    return Response.json({ error: "No se pudo actualizar la carpeta." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdminApiResponse(); if (unauthorized) return unauthorized;
  try {
    const { id } = await context.params;
    const blockCount = await prisma.trainingBlockTemplate.count({ where: { folderId: id } });
    if (blockCount) return Response.json({ error: "La carpeta contiene bloques y no puede eliminarse." }, { status: 409 });
    await prisma.trainingLibraryFolder.delete({ where: { id } });
    return Response.json({ message: "Carpeta eliminada." });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return Response.json({ error: "La carpeta ya no existe." }, { status: 404 });
    console.error("Error al eliminar carpeta de Biblioteca", error);
    return Response.json({ error: "No se pudo eliminar la carpeta." }, { status: 500 });
  }
}
