import { revalidatePath } from "next/cache";
import { platformOwnerApiAccess } from "@/lib/platform-auth";
import { prisma } from "@/lib/prisma";
import { validRequestOrigin } from "@/lib/portal-auth";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await platformOwnerApiAccess();
  if (!access.ok) return access.response;
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen de solicitud inválido." }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { status?: unknown } | null;
  if (body?.status !== "ACTIVE" && body?.status !== "SUSPENDED") return Response.json({ error: "Estado inválido." }, { status: 400 });
  const nextStatus = body.status;
  const trainer = await prisma.user.findFirst({ where: { id, platformRole: "TRAINER", memberships: { some: { role: "OWNER", workspace: { type: "PROFESSIONAL" } } } }, select: { id: true } });
  if (!trainer) return Response.json({ error: "Entrenador no encontrado." }, { status: 404 });
  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({ where: { id: trainer.id }, data: { status: nextStatus }, select: { id: true, status: true } });
    await tx.trainerSubscription.updateMany({ where: { trainerUserId: trainer.id }, data: { status: nextStatus === "ACTIVE" ? "ACTIVE" : "SUSPENDED" } });
    return user;
  });
  revalidatePath("/platform/trainers");
  revalidatePath(`/platform/trainers/${trainer.id}`);
  revalidatePath("/platform/memberships");
  return Response.json({ trainer: updated });
}
