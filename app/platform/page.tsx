import { prisma } from "@/lib/prisma";
import { requirePlatformOwnerPage } from "@/lib/platform-auth";

export default async function PlatformPage() {
  await requirePlatformOwnerPage();
  const now = new Date();
  const [total, active, suspended, pendingInvitations] = await Promise.all([
    prisma.user.count({ where: { platformRole: "TRAINER", memberships: { some: { role: "OWNER", workspace: { type: "PROFESSIONAL" } } } } }),
    prisma.user.count({ where: { platformRole: "TRAINER", status: "ACTIVE", memberships: { some: { role: "OWNER", workspace: { type: "PROFESSIONAL" } } } } }),
    prisma.user.count({ where: { platformRole: "TRAINER", status: "SUSPENDED", memberships: { some: { role: "OWNER", workspace: { type: "PROFESSIONAL" } } } } }),
    prisma.trainerInvitation.count({ where: { status: "PENDING", expiresAt: { gt: now } } }),
  ]);
  const metrics = [
    ["Entrenadores totales", total], ["Activos", active], ["Suspendidos", suspended], ["Invitaciones pendientes", pendingInvitations],
  ] as const;
  return <main className="px-4 py-8 sm:px-6 lg:px-10"><div className="mx-auto max-w-7xl"><p className="text-[11px] font-bold uppercase tracking-[.24em] text-yellow-400">Administración de plataforma</p><h1 className="mt-2 text-3xl font-black">Resumen</h1><p className="mt-2 text-sm text-zinc-400">Estado actual de las cuentas profesionales.</p><section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value]) => <article key={label} className="rounded-2xl border border-zinc-800 bg-zinc-900/75 p-5"><p className="text-sm text-zinc-400">{label}</p><p className="mt-3 text-4xl font-black text-white">{value}</p></article>)}</section><section className="mt-6 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/35 p-5"><h2 className="font-bold">Membresías comerciales</h2><p className="mt-2 text-sm text-zinc-400">Todavía no existe un modelo comercial para calcular planes, vencimientos o pagos. Este bloque queda reservado para la siguiente fase.</p></section></div></main>;
}
