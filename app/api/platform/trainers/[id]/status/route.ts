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
  const trainer = await prisma.user.findFirst({ where: { id, platformRole: "TRAINER", memberships: { some: { role: "OWNER", workspace: { type: "PROFESSIONAL" } } } }, select: { id: true } });
  if (!trainer) return Response.json({ error: "Entrenador no encontrado." }, { status: 404 });
  const updated = await prisma.user.update({ where: { id: trainer.id }, data: { status: body.status }, select: { id: true, status: true } });
  return Response.json({ trainer: updated });
}
