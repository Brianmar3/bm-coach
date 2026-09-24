"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Subscription, subscriptionBadge, subscriptionLabel, TrainerMembershipManager } from "@/componentes/trainer-membership-manager";

export type MembershipTrainer = { id: string; name: string; email: string; status: "ACTIVE" | "SUSPENDED"; subscription: Subscription | null; effectiveStatus: keyof typeof subscriptionLabel | null };
type Filter = "ALL" | keyof typeof subscriptionLabel | "EXPIRING";
const filters: Array<[Filter, string]> = [["ALL", "Todas"], ["ACTIVE", "Al día"], ["PAST_DUE", "Vencidas"], ["SUSPENDED", "Suspendidas"], ["CANCELLED", "Canceladas"], ["EXPIRING", "Próximas a vencer"]];
const showDate = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString("es-AR") : "—";
const expiringWindowEnd = Date.now() + 7 * 86400000;

export function PlatformMemberships({ trainers, initialFilter = "ALL" }: { trainers: MembershipTrainer[]; initialFilter?: Filter }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [managing, setManaging] = useState<MembershipTrainer | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [membershipNotice, setMembershipNotice] = useState("");
  const visible = useMemo(() => trainers.filter((trainer) => {
    if (filter === "ALL") return true;
    if (filter === "EXPIRING") { const due = trainer.subscription?.nextDueAt; return trainer.effectiveStatus === "ACTIVE" && !!due && new Date(due).getTime() <= expiringWindowEnd; }
    return trainer.effectiveStatus === filter;
  }), [trainers, filter]);

  async function action(trainer: MembershipTrainer, kind: "PAID" | "SUSPEND" | "REACTIVATE") {
    if (!trainer.subscription) { setManaging(trainer); return; }
    if (kind === "SUSPEND" && !window.confirm(`¿Suspender el acceso de ${trainer.name}?`)) return;
    setBusy(`${trainer.id}:${kind}`); setError("");
    const next = new Date(); next.setUTCMonth(next.getUTCMonth() + 1);
    const path = kind === "PAID" ? "/mark-paid" : "";
    const body = kind === "PAID" ? { periodMonths: 1 } : kind === "SUSPEND" ? { action: "SUSPEND_ACCESS" } : { action: "REACTIVATE_ACCESS", nextDueAt: next.toISOString().slice(0, 10) };
    try {
      const response = await fetch(`/api/platform/trainers/${encodeURIComponent(trainer.id)}/membership${path}`, { method: kind === "PAID" ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "No se pudo actualizar la membresía.");
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo actualizar la membresía."); }
    finally { setBusy(""); }
  }

  return <>
    <div className="mb-4"><p className="text-[10px] font-bold uppercase tracking-[.22em] text-yellow-400">Administración de plataforma</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">Membresías</h1><p className="mt-1 text-sm text-zinc-400">Planes, vencimientos y accesos de cada entrenador.</p></div>
    <div className="mb-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><div className="flex w-max gap-1.5">{filters.map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-lg px-3 py-2 text-xs font-bold ${filter === value ? "bg-yellow-400 text-zinc-950" : "bg-zinc-900 text-zinc-400"}`}>{label}</button>)}</div></div>
    {error && <p role="alert" className="mb-3 rounded-lg bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
    {membershipNotice && <p role="status" className="fixed bottom-5 left-4 right-4 z-[90] rounded-xl border border-emerald-400/30 bg-zinc-900 p-3 text-center text-sm text-emerald-200 shadow-xl sm:left-auto sm:right-5">{membershipNotice}</p>}
    <section className="space-y-2">{visible.map((trainer) => <article key={trainer.id} className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 lg:grid lg:grid-cols-[minmax(180px,1.2fr)_85px_100px_105px_115px_auto] lg:items-center lg:gap-3"><div className="min-w-0"><h2 className="truncate font-bold">{trainer.name}</h2><p className="truncate text-xs text-zinc-500">{trainer.email}</p></div><div className="mt-3 grid grid-cols-3 gap-2 lg:mt-0 lg:contents"><dl><dt className="text-[9px] font-bold uppercase text-zinc-600">Plan</dt><dd className="mt-1 text-xs font-bold">{trainer.subscription?.plan ?? "—"}</dd></dl><div>{trainer.effectiveStatus ? <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${subscriptionBadge[trainer.effectiveStatus]}`}>{subscriptionLabel[trainer.effectiveStatus]}</span> : <span className="text-xs text-zinc-500">Sin configurar</span>}</div><dl><dt className="text-[9px] font-bold uppercase text-zinc-600">Último pago</dt><dd className="mt-1 text-xs">{showDate(trainer.subscription?.lastPaidAt)}</dd></dl><dl><dt className="text-[9px] font-bold uppercase text-zinc-600">Vencimiento</dt><dd className="mt-1 text-xs">{showDate(trainer.subscription?.nextDueAt)}</dd></dl></div><div className="mt-3 flex flex-wrap gap-1.5 lg:mt-0 lg:justify-end"><button onClick={() => setManaging(trainer)} className="rounded-lg border border-zinc-700 px-2.5 py-2 text-xs font-bold">Gestionar</button>{trainer.subscription && <button disabled={!!busy} onClick={() => action(trainer, "PAID")} className="rounded-lg bg-yellow-400/10 px-2.5 py-2 text-xs font-bold text-yellow-300">Marcar pagado</button>}{trainer.status === "SUSPENDED" ? <button disabled={!!busy} onClick={() => action(trainer, "REACTIVATE")} className="rounded-lg bg-emerald-400/10 px-2.5 py-2 text-xs font-bold text-emerald-300">Reactivar</button> : trainer.subscription && <button disabled={!!busy} onClick={() => action(trainer, "SUSPEND")} className="rounded-lg bg-orange-400/10 px-2.5 py-2 text-xs font-bold text-orange-300">Suspender</button>}</div></article>)}</section>
    {visible.length === 0 && <p className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">No hay membresías para este filtro.</p>}
    {managing && <TrainerMembershipManager trainer={managing} subscription={managing.subscription} onClose={() => setManaging(null)} onSaved={async (message) => { router.refresh(); setManaging(null); setMembershipNotice(message); }} />}
  </>;
}
