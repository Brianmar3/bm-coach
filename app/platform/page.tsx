import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePlatformOwnerPage } from "@/lib/platform-auth";
import { effectiveTrainerSubscriptionStatus, TRAINER_SUBSCRIPTION_PLANS } from "@/lib/trainer-subscription";

export default async function PlatformPage() {
  await requirePlatformOwnerPage();
  const now = new Date();
  const sevenDays = new Date(now.getTime() + 7 * 86400000);
  const twoDays = new Date(now.getTime() + 2 * 86400000);
  const [trainers, invitations] = await Promise.all([
    prisma.user.findMany({ where: { platformRole: "TRAINER", memberships: { some: { role: "OWNER", workspace: { type: "PROFESSIONAL" } } } }, select: { id: true, name: true, status: true, trainerSubscription: { select: { plan: true, status: true, nextDueAt: true } } } }),
    prisma.trainerInvitation.findMany({ where: { status: "PENDING", acceptedAt: null, expiresAt: { gt: now, lte: twoDays } }, select: { id: true, firstName: true, lastName: true, expiresAt: true }, orderBy: { expiresAt: "asc" } }),
  ]);
  const status = (trainer: typeof trainers[number]) => trainer.trainerSubscription ? effectiveTrainerSubscriptionStatus(trainer.trainerSubscription, now) : null;
  const suspended = trainers.filter((trainer) => trainer.status === "SUSPENDED" || status(trainer) === "SUSPENDED");
  const overdue = trainers.filter((trainer) => trainer.status === "ACTIVE" && status(trainer) === "PAST_DUE");
  const expiring = trainers.filter((trainer) => trainer.status === "ACTIVE" && status(trainer) === "ACTIVE" && trainer.trainerSubscription?.nextDueAt && trainer.trainerSubscription.nextDueAt >= now && trainer.trainerSubscription.nextDueAt <= sevenDays);
  const metrics = [["Entrenadores", trainers.length], ["Activos", trainers.filter(({ status }) => status === "ACTIVE").length], ["Próximos a vencer", expiring.length], ["Vencidos", overdue.length], ["Suspendidos", suspended.length]] as const;
  const attention = [
    ...overdue.map((trainer) => ({ label: `${trainer.name} · membresía vencida`, href: `/platform/trainers/${trainer.id}` })),
    ...expiring.map((trainer) => ({ label: `${trainer.name} · vence pronto`, href: `/platform/trainers/${trainer.id}` })),
    ...suspended.map((trainer) => ({ label: `${trainer.name} · acceso suspendido`, href: `/platform/trainers/${trainer.id}` })),
    ...invitations.map((invitation) => ({ label: `${invitation.firstName} ${invitation.lastName} · invitación por vencer`, href: "/platform/trainers?view=invitations" })),
  ];
  const distribution = TRAINER_SUBSCRIPTION_PLANS.map((plan) => [plan, trainers.filter((trainer) => trainer.trainerSubscription?.plan === plan).length] as const);

  return <main className="px-4 py-5 sm:px-6 lg:px-10"><div className="mx-auto max-w-7xl">
    <p className="text-[10px] font-bold uppercase tracking-[.22em] text-yellow-400">Administración de plataforma</p>
    <div className="mt-1 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-black sm:text-3xl">Resumen</h1><p className="mt-1 text-sm text-zinc-400">Estado comercial de las cuentas profesionales.</p></div><div className="flex flex-wrap gap-2"><Link href="/platform/trainers?new=1" className="rounded-lg bg-yellow-400 px-3 py-2 text-xs font-bold text-zinc-950">+ Nuevo entrenador</Link><Link href="/platform/trainers?view=invitations&new=1" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-200 hover:border-yellow-400">+ Nueva invitación</Link></div></div>
    <section aria-label="Indicadores" className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">{metrics.map(([label, value]) => <article key={label} className="rounded-xl border border-zinc-800 bg-zinc-900/75 p-3"><p className="min-h-8 text-xs leading-4 text-zinc-400">{label}</p><p className="mt-1 text-2xl font-black text-white">{value}</p></article>)}</section>
    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]"><section className="rounded-xl border border-zinc-800 bg-zinc-900/75 p-4"><h2 className="font-bold">Requiere atención</h2>{attention.length ? <ul className="mt-3 space-y-2">{attention.map((item, index) => <li key={`${item.href}-${index}`}><Link href={item.href} className="block rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-200 hover:border-yellow-400 hover:text-white">{item.label} <span aria-hidden="true">→</span></Link></li>)}</ul> : <p className="mt-3 text-sm text-zinc-400">Todo al día.</p>}</section><section className="rounded-xl border border-zinc-800 bg-zinc-900/75 p-4"><h2 className="font-bold">Planes</h2><dl className="mt-3 grid grid-cols-2 gap-2">{distribution.map(([plan, count]) => <div key={plan} className="rounded-lg border border-zinc-800 p-2"><dt className="text-xs text-zinc-400">{plan}</dt><dd className="text-xl font-black">{count}</dd></div>)}</dl></section></div>
  </div></main>;
}
