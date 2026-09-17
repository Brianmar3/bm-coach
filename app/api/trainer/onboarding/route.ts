import { requireTrainerWorkspace } from "@/lib/trainer-workspace";
import { prisma } from "@/lib/prisma";
import { validRequestOrigin } from "@/lib/portal-auth";

const serviceTypes = new Set(["CLASSES", "PERSONALIZED", "MIXED", "ONLINE"]);
export async function PATCH(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen de solicitud inválido." }, { status: 403 });
  const actor = await requireTrainerWorkspace();
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const allowed = ["name", "brandName", "city", "serviceType"];
  if (!body || Object.keys(body).some((key) => !allowed.includes(key))) return Response.json({ error: "Datos inválidos." }, { status: 400 });
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const brandName = typeof body.brandName === "string" ? body.brandName.trim() : "";
  const city = typeof body.city === "string" ? body.city.trim() : "";
  const serviceType = typeof body.serviceType === "string" ? body.serviceType : "";
  if (!name || name.length > 120 || brandName.length > 120 || city.length > 120 || !serviceTypes.has(serviceType)) return Response.json({ error: "Revisá los datos del perfil." }, { status: 400 });
  await prisma.$transaction([
    prisma.user.update({ where: { id: actor.userId }, data: { name, brandName: brandName || null, city: city || null, serviceType: serviceType as "CLASSES" | "PERSONALIZED" | "MIXED" | "ONLINE", onboardingCompleted: true } }),
    prisma.workspace.update({ where: { id: actor.workspaceId }, data: { name: brandName || name } }),
  ]);
  return Response.json({ next: "/dashboard" });
}
