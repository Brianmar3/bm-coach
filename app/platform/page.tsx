import { prisma } from "@/lib/prisma";
import { requirePlatformOwnerPage } from "@/lib/platform-auth";
import { effectiveTrainerSubscriptionStatus } from "@/lib/trainer-subscription";

export default async function PlatformPage() {
  await requirePlatformOwnerPage();
  const now = new Date();
  const [total, subscriptions] = await Promise.all([
    prisma.user.count({ where: { platformRole: "TRAINER", memberships: { some: { role: "OWNER", workspace: { type: "PROFESSIONAL" } } } } }),
    prisma.trainerSubscription.findMany({ where: { trainer: { platformRole: "TRAINER", memberships: { some: { role: "OWNER", workspace: { type: "PROFESSIONAL" } } } } }, select: { status: true, nextDueAt: true } }),
  ]);
  const effective = subscriptions.map((subscription) => effectiveTrainerSubscriptionStatus(subscription, now));
  const sevenDays = new Date(now.getTime() + 7 * 86400000);
  const metrics = [
    ["Entrenadores totales", total],
    ["Al día", effective.filter((status) => status === "ACTIVE").length],
    ["Vencidos", effective.filter((status) => status === "PAST_DUE").length],
    ["Suspendidos", effective.filter((status) => status === "SUSPENDED").length],
    ["Cancelados", effective.filter((status) => status === "CANCELLED").length],
    ["Vencen en 7 días", subscriptions.filter((item) => item.status === "ACTIVE" && item.nextDueAt && item.nextDueAt >= now && item.nextDueAt <= sevenDays).length],
  ] as const;
  return <main className="px-4 py-8 sm:px-6 lg:px-10"><div className="mx-auto max-w-7xl"><p className="text-[11px] font-bold uppercase tracking-[.24em] text-yellow-400">Administración de plataforma</p><h1 className="mt-2 text-3xl font-black">Resumen</h1><p className="mt-2 text-sm text-zinc-400">Estado comercial actual de las cuentas profesionales.</p><section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{metrics.map(([label, value]) => <article key={label} className="rounded-2xl border border-zinc-800 bg-zinc-900/75 p-5"><p className="text-sm text-zinc-400">{label}</p><p className="mt-3 text-4xl font-black text-white">{value}</p></article>)}</section></div></main>;
}
