import { platformOwnerApiAccess } from "@/lib/platform-auth";
import { prisma } from "@/lib/prisma";
import { validRequestOrigin } from "@/lib/portal-auth";
import { addUtcMonths, isSubscriptionPeriod, parseDateInput } from "@/lib/trainer-subscription";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await platformOwnerApiAccess();
  if (!access.ok) return access.response;
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen de solicitud inválido." }, { status: 403 });
  const { id } = await context.params;
  const trainer = await prisma.user.findFirst({ where: { id, platformRole: "TRAINER", memberships: { some: { role: "OWNER", workspace: { type: "PROFESSIONAL" } } } }, select: { id: true } });
  if (!trainer) return Response.json({ error: "Entrenador no encontrado." }, { status: 404 });
  const subscription = await prisma.trainerSubscription.findUnique({ where: { trainerUserId: trainer.id } });
  if (!subscription) return Response.json({ error: "Configurá la membresía antes de registrar un pago." }, { status: 409 });
  const body = await request.json().catch(() => null) as { periodMonths?: unknown; renewalDate?: unknown } | null;
  const now = new Date();
  const manualDate = parseDateInput(body?.renewalDate);
  const renewalDate = isSubscriptionPeriod(body?.periodMonths) ? addUtcMonths(now, body.periodMonths) : manualDate;
  if (!renewalDate || renewalDate <= now) return Response.json({ error: "Elegí un período o una fecha futura." }, { status: 400 });
  const updated = await prisma.trainerSubscription.update({ where: { trainerUserId: trainer.id }, data: { lastPaidAt: now, currentPeriodEnd: renewalDate, nextDueAt: renewalDate, status: "ACTIVE" } });
  return Response.json({ subscription: updated, effectiveStatus: "ACTIVE" });
}
