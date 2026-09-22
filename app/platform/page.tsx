import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePlatformOwnerPage } from "@/lib/platform-auth";
import { effectiveTrainerSubscriptionStatus } from "@/lib/trainer-subscription";

export default async function PlatformPage() {
  await requirePlatformOwnerPage();
  const now = new Date();
  const professionalTrainer = { platformRole: "TRAINER" as const, memberships: { some: { role: "OWNER" as const, workspace: { type: "PROFESSIONAL" as const } } } };
  const [trainers, subscriptions, pendingInvitations] = await Promise.all([
    prisma.user.findMany({ where: professionalTrainer, select: { status: true } }),
    prisma.trainerSubscription.findMany({ where: { trainer: professionalTrainer }, select: { status: true, nextDueAt: true } }),
    prisma.trainerInvitation.count({ where: { status: "PENDING", acceptedAt: null, expiresAt: { gt: now } } }),
  ]);
  const effective = subscriptions.map((subscription) => effectiveTrainerSubscriptionStatus(subscription, now));
  const sevenDays = new Date(now.getTime() + 7 * 86400000);
  const metrics = [
    ["Entrenadores", trainers.length],
    ["Activos", trainers.filter(({ status }) => status === "ACTIVE").length],
    ["Suspendidos", trainers.filter(({ status }) => status === "SUSPENDED").length],
    ["Membresías al día", effective.filter((status) => status === "ACTIVE").length],
    ["Vencidas", effective.filter((status) => status === "PAST_DUE").length],
    ["Próximas a vencer", subscriptions.filter((item) => item.status === "ACTIVE" && item.nextDueAt && item.nextDueAt >= now && item.nextDueAt <= sevenDays).length],
    ["Invitaciones pendientes", pendingInvitations],
  ] as const;
  const actions = [["+ Nuevo entrenador", "/platform/trainers?new=1"], ["Ver vencidos", "/platform/memberships?filter=PAST_DUE"], ["Ver invitaciones", "/platform/invitations"]] as const;

  return <main className="px-4 py-5 sm:px-6 lg:px-10"><div className="mx-auto max-w-7xl">
    <p className="text-[10px] font-bold uppercase tracking-[.22em] text-yellow-400">Administración de plataforma</p>
    <div className="mt-1 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-black sm:text-3xl">Resumen</h1><p className="mt-1 text-sm text-zinc-400">Estado comercial de las cuentas profesionales.</p></div><div className="flex flex-wrap gap-2">{actions.map(([label, href], index) => <Link key={href} href={href} className={`rounded-lg px-3 py-2 text-xs font-bold ${index === 0 ? "bg-yellow-400 text-zinc-950" : "border border-zinc-700 text-zinc-200 hover:border-yellow-400"}`}>{label}</Link>)}</div></div>
    <section className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-7">{metrics.map(([label, value]) => <article key={label} className="rounded-xl border border-zinc-800 bg-zinc-900/75 p-3"><p className="min-h-8 text-xs leading-4 text-zinc-400">{label}</p><p className="mt-1 text-2xl font-black text-white">{value}</p></article>)}</section>
  </div></main>;
}
