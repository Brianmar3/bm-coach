"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { inputClass } from "@/componentes/module-shell";
import { Subscription, subscriptionBadge, subscriptionLabel, TrainerMembershipManager } from "@/componentes/trainer-membership-manager";

type Trainer = { id: string; name: string; email: string; status: "ACTIVE" | "SUSPENDED"; createdAt: string; effectiveSubscriptionStatus: keyof typeof subscriptionLabel | null; trainerSubscription: Subscription | null; memberships: Array<{ workspace: { id: string; name: string; status: string; _count: { students: number } } }> };
type Invitation = { id: string; firstName: string; lastName: string; email: string; expiresAt: string; createdAt: string };
type Filter = "ALL" | keyof typeof subscriptionLabel | "EXPIRING";
const filters: Array<[Filter, string]> = [["ALL", "Todos"], ["ACTIVE", "Al día"], ["PAST_DUE", "Vencidos"], ["SUSPENDED", "Suspendidos"], ["CANCELLED", "Cancelados"], ["EXPIRING", "Próximos a vencer"]];

function showDate(value: string | null | undefined) { return value ? new Date(value).toLocaleDateString("es-AR") : "—"; }
function expiringSoon(trainer: Trainer) { const due = trainer.trainerSubscription?.nextDueAt; if (!due || trainer.effectiveSubscriptionStatus !== "ACTIVE") return false; const time = new Date(due).getTime(); return time >= Date.now() && time <= Date.now() + 7 * 86400000; }

export function PlatformTrainers() {
  const [data, setData] = useState<{ trainers: Trainer[]; invitations: Invitation[] }>({ trainers: [], invitations: [] });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [managing, setManaging] = useState<Trainer | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");

  async function load() {
    const response = await fetch("/api/platform/trainers", { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudo cargar entrenadores.");
    const result = await response.json() as { trainers: Trainer[]; invitations: Invitation[] };
    setData(result);
    setManaging((current) => current ? result.trainers.find((trainer) => trainer.id === current.id) ?? null : null);
  }
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/platform/trainers", { cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error("No se pudo cargar entrenadores."); return response.json(); })
      .then(setData)
      .catch((cause) => { if (!(cause instanceof Error && cause.name === "AbortError")) setError(cause instanceof Error ? cause.message : "No se pudo cargar."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const visible = useMemo(() => data.trainers.filter((trainer) => filter === "ALL" || filter === "EXPIRING" ? filter === "ALL" || expiringSoon(trainer) : trainer.effectiveSubscriptionStatus === filter), [data.trainers, filter]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return; setSaving(true); setError(""); setLink("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(["firstName", "lastName", "email", "phone", "brandName"].map((key) => [key, String(form.get(key) ?? "")]));
    try { const response = await fetch("/api/platform/trainers/invitations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json() as { error?: string; invitationUrl?: string }; if (!response.ok) throw new Error(result.error || "No se pudo crear la invitación."); setLink(result.invitationUrl || ""); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo crear la invitación."); }
    finally { setSaving(false); }
  }

  return <>
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[.24em] text-yellow-400">Administración de plataforma</p><h1 className="mt-2 text-3xl font-black">Entrenadores</h1><p className="mt-1 text-sm text-zinc-400">Cuentas profesionales, membresías comerciales y espacios aislados.</p></div><button onClick={() => { setInviteOpen(true); setLink(""); setError(""); }} className="min-h-11 rounded-xl bg-yellow-400 px-5 font-black text-zinc-950">+ Nuevo entrenador</button></div>
    <div className="mb-5 flex flex-wrap gap-2" aria-label="Filtrar por membresía">{filters.map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-xl px-3 py-2 text-xs font-bold ${filter === value ? "bg-yellow-400 text-zinc-950" : "bg-zinc-900 text-zinc-400"}`}>{label}</button>)}</div>
    {error && <p role="alert" className="mb-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{loading ? <p className="text-zinc-500">Cargando…</p> : visible.map((trainer) => { const workspace = trainer.memberships[0]?.workspace; const membership = trainer.trainerSubscription; const effective = trainer.effectiveSubscriptionStatus; return <article key={trainer.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">{trainer.name}</h2><p className="text-sm text-zinc-400">{trainer.email}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${trainer.status === "ACTIVE" ? "bg-emerald-400/10 text-emerald-300" : "bg-zinc-700 text-zinc-300"}`}>{trainer.status === "ACTIVE" ? "ACCESO ACTIVO" : "ACCESO SUSPENDIDO"}</span></div><div className="mt-4 rounded-xl border border-zinc-800 bg-black/25 p-3"><div className="flex items-center justify-between gap-2"><strong className="text-sm">{membership?.plan ?? "Sin membresía configurada"}</strong>{effective && <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${subscriptionBadge[effective]}`}>{subscriptionLabel[effective]}</span>}</div><dl className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-zinc-500">Próximo vencimiento</dt><dd className="mt-1">{showDate(membership?.nextDueAt)}</dd></div><div><dt className="text-zinc-500">Último pago</dt><dd className="mt-1">{showDate(membership?.lastPaidAt)}</dd></div></dl></div><dl className="mt-4 space-y-2 text-sm"><div className="flex justify-between gap-3"><dt className="text-zinc-500">Workspace</dt><dd className="text-right">{workspace?.name || "—"}</dd></div><div className="flex justify-between"><dt className="text-zinc-500">Alumnos</dt><dd>{workspace?._count.students ?? 0}</dd></div></dl><div className="mt-5 flex flex-wrap gap-2"><Link href={`/platform/trainers/${trainer.id}`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold hover:border-yellow-400">Ver entrenador</Link><button type="button" onClick={() => setManaging(trainer)} className="rounded-lg bg-yellow-400/10 px-3 py-2 text-xs font-bold text-yellow-300">{membership ? "Gestionar membresía" : "Configurar membresía"}</button></div></article>; })}</section>
    {!loading && visible.length === 0 && <p className="rounded-2xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">No hay entrenadores para este filtro.</p>}
    {data.invitations.length > 0 && <section className="mt-7"><h2 className="text-lg font-bold">Invitaciones pendientes</h2><div className="mt-3 divide-y divide-zinc-800 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70">{data.invitations.map((item) => <div key={item.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between"><div><strong>{item.firstName} {item.lastName}</strong><p className="text-sm text-zinc-500">{item.email}</p></div><span className="text-xs text-yellow-300">Vence {showDate(item.expiresAt)}</span></div>)}</div></section>}
    {managing && <TrainerMembershipManager trainer={managing} subscription={managing.trainerSubscription} onClose={() => setManaging(null)} onSaved={load} />}
    {inviteOpen && <div className="fixed inset-0 z-[70] grid place-items-center bg-black/80 p-4"><form onSubmit={invite} className="w-full max-w-xl rounded-3xl border border-yellow-400/20 bg-zinc-900 p-6"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-yellow-400">Nueva invitación</p><h2 className="mt-1 text-2xl font-black">Nuevo entrenador</h2></div><button type="button" onClick={() => setInviteOpen(false)} className="rounded-lg p-2 text-zinc-400">Cerrar</button></div>{link ? <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/[.06] p-4"><strong className="text-emerald-300">Invitación creada</strong><p className="mt-2 break-all text-xs text-zinc-300">{link}</p><button type="button" onClick={() => navigator.clipboard.writeText(link)} className="mt-4 min-h-11 rounded-xl bg-yellow-400 px-4 font-black text-zinc-950">Copiar enlace</button></div> : <><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm">Nombre *<input name="firstName" required maxLength={80} className={`${inputClass} mt-1`} /></label><label className="text-sm">Apellido *<input name="lastName" required maxLength={80} className={`${inputClass} mt-1`} /></label><label className="text-sm sm:col-span-2">Email *<input name="email" type="email" required maxLength={254} className={`${inputClass} mt-1`} /></label><label className="text-sm">Teléfono<input name="phone" maxLength={40} className={`${inputClass} mt-1`} /></label><label className="text-sm">Marca / gimnasio<input name="brandName" maxLength={120} className={`${inputClass} mt-1`} /></label></div><button disabled={saving} className="mt-6 min-h-12 w-full rounded-xl bg-yellow-400 font-black text-zinc-950 disabled:opacity-60">{saving ? "Creando…" : "Crear invitación"}</button></>}</form></div>}
  </>;
}
