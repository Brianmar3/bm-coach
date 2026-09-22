import { PlatformMemberships, type MembershipTrainer } from "@/componentes/platform-memberships";
import { requirePlatformOwnerPage } from "@/lib/platform-auth";
import { prisma } from "@/lib/prisma";
import { effectiveTrainerSubscriptionStatus } from "@/lib/trainer-subscription";

export default async function MembershipsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requirePlatformOwnerPage();
  const trainers = await prisma.user.findMany({ where: { platformRole: "TRAINER", memberships: { some: { role: "OWNER", workspace: { type: "PROFESSIONAL" } } } }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true, status: true, trainerSubscription: true } });
  const allowed = ["ALL", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED", "EXPIRING"] as const;
  const requested = (await searchParams).filter;
  const initialFilter = allowed.includes(requested as typeof allowed[number]) ? requested as typeof allowed[number] : "ALL";
  const serialized: MembershipTrainer[] = trainers.map((trainer) => ({ id: trainer.id, name: trainer.name, email: trainer.email, status: trainer.status, subscription: trainer.trainerSubscription ? { id: trainer.trainerSubscription.id, plan: trainer.trainerSubscription.plan, status: trainer.trainerSubscription.status, startedAt: trainer.trainerSubscription.startedAt.toISOString(), lastPaidAt: trainer.trainerSubscription.lastPaidAt?.toISOString() ?? null, currentPeriodEnd: trainer.trainerSubscription.currentPeriodEnd?.toISOString() ?? null, nextDueAt: trainer.trainerSubscription.nextDueAt?.toISOString() ?? null, notes: trainer.trainerSubscription.notes } : null, effectiveStatus: trainer.trainerSubscription ? effectiveTrainerSubscriptionStatus(trainer.trainerSubscription) : null }));
  return <main className="px-4 py-5 sm:px-6 lg:px-10"><div className="mx-auto max-w-7xl"><PlatformMemberships trainers={serialized} initialFilter={initialFilter} /></div></main>;
}
