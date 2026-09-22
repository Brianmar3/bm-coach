"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type DisplayStatus = "PENDING" | "USED" | "EXPIRED" | "CANCELLED";
export type PlatformInvitation = { id: string; firstName: string; lastName: string; email: string; createdAt: string; expiresAt: string; displayStatus: DisplayStatus };
const labels: Record<DisplayStatus, string> = { PENDING: "Pendiente", USED: "Usada", EXPIRED: "Vencida", CANCELLED: "Cancelada" };
const badges: Record<DisplayStatus, string> = { PENDING: "bg-yellow-400/10 text-yellow-300", USED: "bg-emerald-400/10 text-emerald-300", EXPIRED: "bg-red-400/10 text-red-300", CANCELLED: "bg-zinc-700 text-zinc-300" };
const showDate = (value: string) => new Date(value).toLocaleDateString("es-AR");

export function PlatformInvitations({ invitations }: { invitations: PlatformInvitation[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [links, setLinks] = useState<Record<string, string>>({});

  async function action(invitation: PlatformInvitation, kind: "REGENERATE" | "CANCEL") {
    if (kind === "CANCEL" && !window.confirm(`¿Cancelar la invitación de ${invitation.email}?`)) return;
    setBusy(`${invitation.id}:${kind}`); setError("");
    try {
      const response = await fetch("/api/platform/trainers/invitations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: invitation.id, action: kind }) });
      const result = await response.json() as { error?: string; invitationUrl?: string };
      if (!response.ok) throw new Error(result.error || "No se pudo actualizar la invitación.");
      if (result.invitationUrl) setLinks((current) => ({ ...current, [invitation.id]: result.invitationUrl! }));
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo actualizar la invitación."); }
    finally { setBusy(""); }
  }

  return <>
    <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-yellow-400">Administración de plataforma</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">Invitaciones</h1><p className="mt-1 text-sm text-zinc-400">Altas de entrenadores y vigencia de sus enlaces.</p></div><Link href="/platform/trainers?new=1" className="shrink-0 rounded-lg bg-yellow-400 px-3 py-2 text-xs font-black text-zinc-950">+ Nueva</Link></div>
    {error && <p role="alert" className="mb-3 rounded-lg bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
    <section className="space-y-2">{invitations.map((invitation) => <article key={invitation.id} className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 sm:grid sm:grid-cols-[minmax(200px,1fr)_100px_100px_95px_auto] sm:items-center sm:gap-3"><div className="min-w-0"><h2 className="truncate font-bold">{invitation.firstName} {invitation.lastName}</h2><p className="truncate text-xs text-zinc-500">{invitation.email}</p></div><div className="mt-3 grid grid-cols-3 gap-2 sm:mt-0 sm:contents"><dl><dt className="text-[9px] font-bold uppercase text-zinc-600">Creada</dt><dd className="mt-1 text-xs">{showDate(invitation.createdAt)}</dd></dl><dl><dt className="text-[9px] font-bold uppercase text-zinc-600">Vence</dt><dd className="mt-1 text-xs">{showDate(invitation.expiresAt)}</dd></dl><div><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${badges[invitation.displayStatus]}`}>{labels[invitation.displayStatus]}</span></div></div><div className="mt-3 flex flex-wrap gap-1.5 sm:mt-0 sm:justify-end">{links[invitation.id] && <button onClick={() => navigator.clipboard.writeText(links[invitation.id])} className="rounded-lg bg-emerald-400/10 px-2.5 py-2 text-xs font-bold text-emerald-300">Copiar link</button>}{invitation.displayStatus !== "USED" && <button disabled={!!busy} onClick={() => action(invitation, "REGENERATE")} className="rounded-lg border border-zinc-700 px-2.5 py-2 text-xs font-bold">Generar nuevo link</button>}{invitation.displayStatus === "PENDING" && <button disabled={!!busy} onClick={() => action(invitation, "CANCEL")} className="rounded-lg bg-red-400/10 px-2.5 py-2 text-xs font-bold text-red-300">Cancelar</button>}</div></article>)}</section>
    {invitations.length === 0 && <p className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">Todavía no hay invitaciones.</p>}
  </>;
}
