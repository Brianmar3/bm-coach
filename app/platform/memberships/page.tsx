import Link from "next/link";
import { requirePlatformOwnerPage } from "@/lib/platform-auth";
import { prisma } from "@/lib/prisma";
import { effectiveTrainerSubscriptionStatus } from "@/lib/trainer-subscription";

const labels = { ACTIVE: "Al día", PAST_DUE: "Vencido", SUSPENDED: "Suspendido", CANCELLED: "Cancelado" } as const;

export default async function MembershipsPage() {
  await requirePlatformOwnerPage();
  const trainers = await prisma.user.findMany({ where: { platformRole: "TRAINER", memberships: { some: { role: "OWNER", workspace: { type: "PROFESSIONAL" } } } }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true, trainerSubscription: true } });
  return <main className="px-4 py-8 sm:px-6 lg:px-10"><div className="mx-auto max-w-7xl"><p className="text-[11px] font-bold uppercase tracking-[.24em] text-yellow-400">Administración de plataforma</p><h1 className="mt-2 text-3xl font-black">Membresías</h1><p className="mt-2 text-sm text-zinc-400">Planes y estado comercial de cada entrenador.</p><section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{trainers.map((trainer) => { const subscription = trainer.trainerSubscription; const effective = subscription ? effectiveTrainerSubscriptionStatus(subscription) : null; return <article key={trainer.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/75 p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">{trainer.name}</h2><p className="text-sm text-zinc-500">{trainer.email}</p></div>{effective && <span className="rounded-full bg-yellow-400/10 px-2 py-1 text-[10px] font-bold text-yellow-300">{labels[effective]}</span>}</div><p className="mt-4 text-sm">{subscription ? `Plan ${subscription.plan}` : "Sin membresía configurada"}</p><p className="mt-1 text-xs text-zinc-500">Próximo vencimiento: {subscription?.nextDueAt ? subscription.nextDueAt.toLocaleDateString("es-AR") : "—"}</p><Link href={`/platform/trainers/${trainer.id}`} className="mt-4 inline-flex text-sm font-bold text-yellow-300">Ver entrenador →</Link></article>; })}</section></div></main>;
}
