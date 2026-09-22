"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { inputClass } from "@/componentes/module-shell";
import { Subscription, subscriptionBadge, subscriptionLabel, TrainerMembershipManager } from "@/componentes/trainer-membership-manager";

type TrainerCapacity = { plan: "FREE" | "STARTER" | "PRO" | "PREMIUM"; used: number; limit: number | null; reached: boolean; nearLimit: boolean };
type Trainer = { id: string; name: string; email: string; status: "ACTIVE" | "SUSPENDED"; createdAt: string; effectiveSubscriptionStatus: keyof typeof subscriptionLabel | null; trainerSubscription: Subscription | null; memberships: Array<{ workspace: { id: string; name: string; status: string; _count: { students: number }; capacity: TrainerCapacity } }> };
type Invitation = { id: string; firstName: string; lastName: string; email: string; expiresAt: string; createdAt: string };
type Filter = "ALL" | keyof typeof subscriptionLabel | "EXPIRING";
const filters: Array<[Filter, string]> = [["ALL", "Todos"], ["ACTIVE", "Al día"], ["PAST_DUE", "Vencidos"], ["SUSPENDED", "Suspendidos"], ["CANCELLED", "Cancelados"], ["EXPIRING", "Próximos a vencer"]];

function showDate(value: string | null | undefined) { return value ? new Date(value).toLocaleDateString("es-AR") : "—"; }
function expiringSoon(trainer: Trainer) { const due = trainer.trainerSubscription?.nextDueAt; if (!due || trainer.effectiveSubscriptionStatus !== "ACTIVE") return false; const time = new Date(due).getTime(); return time >= Date.now() && time <= Date.now() + 7 * 86400000; }

export function PlatformTrainers({ initialInviteOpen = false }: { initialInviteOpen?: boolean }) {
  const [data, setData] = useState<{ trainers: Trainer[]; invitations: Invitation[] }>({ trainers: [], invitations: [] });
  const [inviteOpen, setInviteOpen] = useState(initialInviteOpen);
  const [managing, setManaging] = useState<Trainer | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
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

  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("es");
    return data.trainers.filter((trainer) => {
      const matchesFilter = filter === "ALL" || (filter === "EXPIRING" ? expiringSoon(trainer) : trainer.effectiveSubscriptionStatus === filter);
      const workspace = trainer.memberships[0]?.workspace;
      const matchesQuery = !term || [trainer.name, trainer.email, workspace?.name, trainer.trainerSubscription?.plan].some((value) => value?.toLocaleLowerCase("es").includes(term));
      return matchesFilter && matchesQuery;
    });
  }, [data.trainers, filter, query]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return; setSaving(true); setError(""); setLink("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(["firstName", "lastName", "email", "phone", "brandName"].map((key) => [key, String(form.get(key) ?? "")]));
    try { const response = await fetch("/api/platform/trainers/invitations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json() as { error?: string; invitationUrl?: string }; if (!response.ok) throw new Error(result.error || "No se pudo crear la invitación."); setLink(result.invitationUrl || ""); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo crear la invitación."); }
    finally { setSaving(false); }
  }

  return <>
    <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-yellow-400">Administración de plataforma</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">Entrenadores</h1><p className="mt-1 hidden text-sm text-zinc-400 sm:block">Cuentas profesionales, membresías comerciales y espacios aislados.</p></div><button onClick={() => { setInviteOpen(true); setLink(""); setError(""); }} className="shrink-0 rounded-lg bg-yellow-400 px-3 py-2 text-xs font-black text-zinc-950 sm:px-4 sm:text-sm">+ Nuevo entrenador</button></div>
    <div className="mb-4 space-y-2"><label className="flex min-h-10 max-w-xl items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-3 focus-within:border-yellow-400"><span aria-hidden="true" className="text-zinc-500">⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nombre, email, workspace o plan" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-600" /></label><div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><div className="flex w-max gap-1.5" aria-label="Filtrar por membresía">{filters.map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold ${filter === value ? "bg-yellow-400 text-zinc-950" : "bg-zinc-900 text-zinc-400"}`}>{label}</button>)}</div></div></div>
    {error && <p role="alert" className="mb-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
    <section className="space-y-2">{loading ? <p className="text-zinc-500">Cargando…</p> : visible.map((trainer) => { const workspace = trainer.memberships[0]?.workspace; const membership = trainer.trainerSubscription; const effective = trainer.effectiveSubscriptionStatus; const capacity = workspace?.capacity; return <article key={trainer.id} className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 md:grid md:grid-cols-[minmax(180px,1.3fr)_minmax(130px,1fr)_95px_115px_85px_auto] md:items-center md:gap-3"><div className="min-w-0"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h2 className="truncate font-bold">{trainer.name}</h2><p className="truncate text-xs text-zinc-500">{trainer.email}</p></div>{trainer.status === "SUSPENDED" && <span className="shrink-0 rounded-full bg-zinc-700 px-2 py-1 text-[9px] font-bold text-zinc-300 md:hidden">SUSPENDIDO</span>}</div><p className="mt-1 truncate text-xs text-zinc-300 md:hidden">{workspace?.name || "—"}</p></div><dl className="hidden md:block"><dt className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">Marca</dt><dd className="mt-1 truncate text-sm">{workspace?.name || "—"}</dd></dl><div className="mt-3 grid grid-cols-2 gap-2 md:mt-0 md:block"><div><p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">Plan</p><p className="mt-1 text-xs font-semibold">{capacity?.plan ?? membership?.plan ?? "—"}</p></div><div className="md:mt-1"><p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-600 md:hidden">Estado</p>{effective ? <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${subscriptionBadge[effective]}`}>{subscriptionLabel[effective]}</span> : <span className="text-[10px] text-zinc-500">Sin membresía</span>}</div><div className="md:hidden"><p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">Vencimiento</p><p className="mt-1 text-xs">{showDate(membership?.nextDueAt)}</p></div><div className="md:hidden"><p className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">Alumnos</p><p className={`mt-1 text-xs font-bold ${capacity?.nearLimit ? "text-orange-300" : ""}`}>{capacity ? `${capacity.used} / ${capacity.limit ?? "∞"}` : "—"}</p></div></div><dl className="hidden md:block"><dt className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">Vencimiento</dt><dd className="mt-1 text-xs">{showDate(membership?.nextDueAt)}</dd></dl><dl className="hidden md:block"><dt className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">Alumnos</dt><dd className={`mt-1 text-sm font-bold ${capacity?.nearLimit ? "text-orange-300" : ""}`}>{capacity ? `${capacity.used} / ${capacity.limit ?? "∞"}` : "—"}</dd>{capacity?.reached && <dd className="text-[9px] font-bold text-red-300">LÍMITE</dd>}</dl><div className="mt-3 flex gap-2 md:mt-0 md:justify-end"><Link prefetch={false} href={`/platform/trainers/${trainer.id}`} aria-label={`Ver administración de ${trainer.name}`} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold hover:border-yellow-400">Ver</Link><button type="button" onClick={() => setManaging(trainer)} className="rounded-lg bg-yellow-400/10 px-3 py-2 text-xs font-bold text-yellow-300">Membresía</button></div></article>; })}</section>
    {!loading && visible.length === 0 && <p className="rounded-2xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">No hay entrenadores para este filtro.</p>}
    {managing && <TrainerMembershipManager trainer={managing} subscription={managing.trainerSubscription} onClose={() => setManaging(null)} onSaved={load} />}
    {inviteOpen && <div className="fixed inset-0 z-[70] grid place-items-center bg-black/80 p-4"><form onSubmit={invite} className="w-full max-w-xl rounded-3xl border border-yellow-400/20 bg-zinc-900 p-6"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-yellow-400">Nueva invitación</p><h2 className="mt-1 text-2xl font-black">Nuevo entrenador</h2></div><button type="button" onClick={() => setInviteOpen(false)} className="rounded-lg p-2 text-zinc-400">Cerrar</button></div>{link ? <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/[.06] p-4"><strong className="text-emerald-300">Invitación creada</strong><p className="mt-2 break-all text-xs text-zinc-300">{link}</p><button type="button" onClick={() => navigator.clipboard.writeText(link)} className="mt-4 min-h-11 rounded-xl bg-yellow-400 px-4 font-black text-zinc-950">Copiar enlace</button></div> : <><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm">Nombre *<input name="firstName" required maxLength={80} className={`${inputClass} mt-1`} /></label><label className="text-sm">Apellido *<input name="lastName" required maxLength={80} className={`${inputClass} mt-1`} /></label><label className="text-sm sm:col-span-2">Email *<input name="email" type="email" required maxLength={254} className={`${inputClass} mt-1`} /></label><label className="text-sm">Teléfono<input name="phone" maxLength={40} className={`${inputClass} mt-1`} /></label><label className="text-sm">Marca / gimnasio<input name="brandName" maxLength={120} className={`${inputClass} mt-1`} /></label></div><button disabled={saving} className="mt-6 min-h-12 w-full rounded-xl bg-yellow-400 font-black text-zinc-950 disabled:opacity-60">{saving ? "Creando…" : "Crear invitación"}</button></>}</form></div>}
  </>;
}
