import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { platformOwnerApiAccess } from "@/lib/platform-auth";
import { prisma } from "@/lib/prisma";
import { validRequestOrigin } from "@/lib/portal-auth";
import { parseTrainerEmail } from "@/lib/trainer-profile";

export async function PATCH(request: Request, context: RouteContext<"/api/platform/trainers/[id]/profile">) {
  const access = await platformOwnerApiAccess();
  if (!access.ok) return access.response;
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen de solicitud inválido." }, { status: 403 });

  const body = await request.json().catch(() => null) as { email?: unknown } | null;
  if (!body || Object.keys(body).some((key) => key !== "email")) return Response.json({ error: "Datos inválidos." }, { status: 400 });
  const email = parseTrainerEmail(body.email);
  if (!email) return Response.json({ error: "Ingresá un email válido." }, { status: 400 });

  const { id } = await context.params;
  const trainer = await prisma.user.findFirst({
    where: { id, platformRole: "TRAINER", memberships: { some: { role: "OWNER", workspace: { type: "PROFESSIONAL" } } } },
    select: { id: true, email: true },
  });
  if (!trainer) return Response.json({ error: "Entrenador no encontrado." }, { status: 404 });

  const duplicate = await prisma.user.findFirst({
    where: { id: { not: trainer.id }, email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (duplicate) return Response.json({ error: "Ese email ya pertenece a otra cuenta." }, { status: 409 });

  try {
    const updated = await prisma.user.update({ where: { id: trainer.id }, data: { email }, select: { id: true, email: true } });
    revalidatePath("/platform/trainers");
    revalidatePath(`/platform/trainers/${trainer.id}`);
    return Response.json({ trainer: updated, message: "Datos actualizados" });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ error: "Ese email ya pertenece a otra cuenta." }, { status: 409 });
    throw error;
  }
}
