import { platformOwnerApiAccess } from "@/lib/platform-auth";
import { prisma } from "@/lib/prisma";
import { validRequestOrigin } from "@/lib/portal-auth";
import { effectiveTrainerSubscriptionStatus, isSubscriptionPlan, isSubscriptionStatus, parseDateInput, validSubscriptionTimeline } from "@/lib/trainer-subscription";

async function managedTrainer(id: string) {
  return prisma.user.findFirst({
    where: { id, platformRole: "TRAINER", memberships: { some: { role: "OWNER", workspace: { type: "PROFESSIONAL" } } } },
    select: { id: true, name: true, email: true, status: true },
  });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await platformOwnerApiAccess();
  if (!access.ok) return access.response;
  const trainer = await managedTrainer((await context.params).id);
  if (!trainer) return Response.json({ error: "Entrenador no encontrado." }, { status: 404 });
  const subscription = await prisma.trainerSubscription.findUnique({ where: { trainerUserId: trainer.id } });
  return Response.json({ trainer, subscription, effectiveStatus: subscription ? effectiveTrainerSubscriptionStatus(subscription) : null });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await platformOwnerApiAccess();
  if (!access.ok) return access.response;
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen de solicitud inválido." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Datos inválidos." }, { status: 400 });
  const trainer = await managedTrainer((await context.params).id);
  if (!trainer) return Response.json({ error: "Entrenador no encontrado." }, { status: 404 });
  const existing = await prisma.trainerSubscription.findUnique({ where: { trainerUserId: trainer.id } });

  if (body.action === "SUSPEND_ACCESS") {
    if (!existing) return Response.json({ error: "Configurá la membresía antes de suspender el acceso." }, { status: 409 });
    const [, subscription] = await prisma.$transaction([
      prisma.user.update({ where: { id: trainer.id }, data: { status: "SUSPENDED" } }),
      prisma.trainerSubscription.update({ where: { trainerUserId: trainer.id }, data: { status: "SUSPENDED" } }),
    ]);
    return Response.json({ subscription, effectiveStatus: subscription.status, userStatus: "SUSPENDED" });
  }

  if (body.action === "REACTIVATE_ACCESS") {
    if (!existing) return Response.json({ error: "Configurá la membresía antes de reactivar el acceso." }, { status: 409 });
    const nextDueAt = parseDateInput(body.nextDueAt);
    const currentPeriodEnd = parseDateInput(body.currentPeriodEnd ?? body.nextDueAt);
    if (!nextDueAt || !currentPeriodEnd || nextDueAt < new Date()) return Response.json({ error: "Definí un próximo vencimiento válido y futuro." }, { status: 400 });
    const [, subscription] = await prisma.$transaction([
      prisma.user.update({ where: { id: trainer.id }, data: { status: "ACTIVE" } }),
      prisma.trainerSubscription.update({ where: { trainerUserId: trainer.id }, data: { status: "ACTIVE", nextDueAt, currentPeriodEnd } }),
    ]);
    return Response.json({ subscription, effectiveStatus: "ACTIVE", userStatus: "ACTIVE" });
  }

  const plan = body.plan ?? existing?.plan;
  const status = body.status ?? existing?.status ?? "ACTIVE";
  if (!isSubscriptionPlan(plan) || !isSubscriptionStatus(status)) return Response.json({ error: "Plan o estado inválido." }, { status: 400 });
  const parseField = (key: string, fallback: Date | null) => key in body ? parseDateInput(body[key]) : fallback;
  const startedAt = parseField("startedAt", existing?.startedAt ?? null);
  const lastPaidAt = parseField("lastPaidAt", existing?.lastPaidAt ?? null);
  const currentPeriodEnd = parseField("currentPeriodEnd", existing?.currentPeriodEnd ?? null);
  const nextDueAt = parseField("nextDueAt", existing?.nextDueAt ?? null);
  if (!startedAt || lastPaidAt === undefined || currentPeriodEnd === undefined || nextDueAt === undefined) return Response.json({ error: "Revisá las fechas de la membresía." }, { status: 400 });
  if (!validSubscriptionTimeline({ startedAt, lastPaidAt, currentPeriodEnd, nextDueAt })) return Response.json({ error: "Las fechas no pueden ser anteriores al inicio de la membresía." }, { status: 400 });
  const notes = body.notes === undefined ? existing?.notes ?? "" : typeof body.notes === "string" ? body.notes.trim() : null;
  if (notes === null || notes.length > 2000) return Response.json({ error: "Las notas no son válidas." }, { status: 400 });
  const data = { plan, status, startedAt, lastPaidAt, currentPeriodEnd, nextDueAt, notes };
  const synchronizedUserStatus = status === "ACTIVE" ? "ACTIVE" : status === "CANCELLED" || status === "SUSPENDED" && body.suspendAccess === true ? "SUSPENDED" : trainer.status;
  const subscription = await prisma.$transaction(async (tx) => {
    const saved = await tx.trainerSubscription.upsert({ where: { trainerUserId: trainer.id }, create: { trainerUserId: trainer.id, ...data }, update: data });
    if (synchronizedUserStatus !== trainer.status) await tx.user.update({ where: { id: trainer.id }, data: { status: synchronizedUserStatus } });
    return saved;
  });
  return Response.json({ subscription, effectiveStatus: effectiveTrainerSubscriptionStatus(subscription), userStatus: synchronizedUserStatus });
}
