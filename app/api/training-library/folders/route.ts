import { Prisma } from "@prisma/client";
import { requireAdminApiResponse } from "@/lib/admin-api-auth";
import { normalizeLibraryText, serializeLibraryFolder, validateLibraryFolderName } from "@/lib/training-library";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const unauthorized = await requireAdminApiResponse(); if (unauthorized) return unauthorized;
  const folders = await prisma.trainingLibraryFolder.findMany({ include: { _count: { select: { blockTemplates: true } } }, orderBy: { name: "asc" } });
  return Response.json(folders.map(serializeLibraryFolder));
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminApiResponse(); if (unauthorized) return unauthorized;
  try {
    const { name } = await request.json() as { name?: string };
    const validationError = validateLibraryFolderName(name);
    if (validationError) return Response.json({ error: validationError }, { status: 400 });
    const folder = await prisma.trainingLibraryFolder.create({ data: { name: name!.trim(), normalizedName: normalizeLibraryText(name!) }, include: { _count: { select: { blockTemplates: true } } } });
    return Response.json(serializeLibraryFolder(folder), { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ error: "Ya existe una carpeta con ese nombre." }, { status: 409 });
    console.error("Error al crear carpeta de Biblioteca", error);
    return Response.json({ error: "No se pudo crear la carpeta." }, { status: 500 });
  }
}
