import { Prisma } from "@prisma/client";
import { requireAdminApiResponse } from "@/lib/admin-api-auth";
import { requireTrainerWorkspace } from "@/lib/trainer-workspace";
import { validRequestOrigin } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { CLASS_REACTIONS } from "@/lib/class-communication";
import { reactToConfirmation } from "@/lib/class-communication-service";

export const runtime = "nodejs";
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const unauthorized = await requireAdminApiResponse(); if (unauthorized) return unauthorized;
  const body = await request.json().catch(() => null);
  const reaction = CLASS_REACTIONS.find(item => item.value === body?.reaction)?.value;
  if (!reaction) return Response.json({ error: "Seleccioná una reacción válida." }, { status: 400 });
  const { workspaceId } = await requireTrainerWorkspace(); const { id } = await context.params;
  try {
    const result = await prisma.$transaction(tx => reactToConfirmation(tx, workspaceId, id, reaction), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return result ? Response.json(result) : Response.json({ error: "Confirmación no encontrada." }, { status: 404 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return Response.json({ error: "La confirmación cambió. Volvé a intentarlo." }, { status: 409 });
    console.error("No se pudo guardar la reacción", error);
    return Response.json({ error: "No se pudo guardar la reacción." }, { status: 500 });
  }
}
