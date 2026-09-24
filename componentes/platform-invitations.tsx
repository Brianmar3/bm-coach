"use client";

import { useEffect, useState } from "react";

type DisplayStatus = "PENDING" | "USED" | "EXPIRED" | "CANCELLED";
export type PlatformInvitation = { id: string; firstName: string; lastName: string; email: string; createdAt: string; expiresAt: string; displayStatus: DisplayStatus };
const labels: Record<DisplayStatus, string> = { PENDING: "Pendiente", USED: "Usada", EXPIRED: "Vencida", CANCELLED: "Cancelada" };
const badges: Record<DisplayStatus, string> = { PENDING: "bg-yellow-400/10 text-yellow-300", USED: "bg-emerald-400/10 text-emerald-300", EXPIRED: "bg-red-400/10 text-red-300", CANCELLED: "bg-zinc-700 text-zinc-300" };
const showDate = (value: string) => new Date(value).toLocaleDateString("es-AR");

export function PlatformInvitations({ onNewInvitation }: { onNewInvitation: () => void }) {
  const [invitations, setInvitations] = useState<PlatformInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [links, setLinks] = useState<Record<string, string>>({});

  async function load() {
    const response = await fetch("/api/platform/trainers/invitations", { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudieron cargar las invitaciones.");
    const result = await response.json() as { invitations: PlatformInvitation[] };
    setInvitations(result.invitations);
  }
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/platform/trainers/invitations", { cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error("No se pudieron cargar las invitaciones."); return response.json() as Promise<{ invitations: PlatformInvitation[] }>; })
      .then((result) => setInvitations(result.invitations))
      .catch((cause) => { if (!(cause instanceof Error && cause.name === "AbortError")) setError(cause instanceof Error ? cause.message : "No se pudieron cargar las invitaciones."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  async function action(invitation: PlatformInvitation, kind: "REGENERATE" | "CANCEL") {
    if (kind === "CANCEL" && !window.confirm(`¿Cancelar la invitación de ${invitation.email}?`)) return;
    setBusy(`${invitation.id}:${kind}`); setError("");
    try {
      const response = await fetch("/api/platform/trainers/invitations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: invitation.id, action: kind }) });
      const result = await response.json() as { error?: string; invitationUrl?: string };
      if (!response.ok) throw new Error(result.error || "No se pudo actualizar la invitación.");
      if (result.invitationUrl) setLinks((current) => ({ ...current, [invitation.id]: result.invitationUrl! }));
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo actualizar la invitación."); }
    finally { setBusy(""); }
  }

  return <>
    <div className="mb-4 flex items-center justify-between gap-3"><p className="text-sm text-zinc-400">Altas de entrenadores y vigencia de sus enlaces.</p><button type="button" onClick={onNewInvitation} className="shrink-0 rounded-lg bg-yellow-400 px-3 py-2 text-xs font-black text-zinc-950">+ Nueva invitación</button></div>
    {error && <p role="alert" className="mb-3 rounded-lg bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
    {loading && <p className="text-sm text-zinc-500">Cargando invitaciones…</p>}
    <section className="space-y-2">{invitations.map((invitation) => <article key={invitation.id} className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 sm:grid sm:grid-cols-[minmax(200px,1fr)_100px_100px_95px_auto] sm:items-center sm:gap-3"><div className="min-w-0"><h2 className="truncate font-bold">{invitation.firstName} {invitation.lastName}</h2><p className="truncate text-xs text-zinc-500">{invitation.email}</p></div><div className="mt-3 grid grid-cols-3 gap-2 sm:mt-0 sm:contents"><dl><dt className="text-[9px] font-bold uppercase text-zinc-600">Creada</dt><dd className="mt-1 text-xs">{showDate(invitation.createdAt)}</dd></dl><dl><dt className="text-[9px] font-bold uppercase text-zinc-600">Vence</dt><dd className="mt-1 text-xs">{showDate(invitation.expiresAt)}</dd></dl><div><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${badges[invitation.displayStatus]}`}>{labels[invitation.displayStatus]}</span></div></div><div className="mt-3 flex flex-wrap gap-1.5 sm:mt-0 sm:justify-end">{links[invitation.id] && <button onClick={() => navigator.clipboard.writeText(links[invitation.id])} className="rounded-lg bg-emerald-400/10 px-2.5 py-2 text-xs font-bold text-emerald-300">Copiar link</button>}{invitation.displayStatus !== "USED" && <button disabled={!!busy} onClick={() => action(invitation, "REGENERATE")} className="rounded-lg border border-zinc-700 px-2.5 py-2 text-xs font-bold">Generar nuevo link</button>}{invitation.displayStatus === "PENDING" && <button disabled={!!busy} onClick={() => action(invitation, "CANCEL")} className="rounded-lg bg-red-400/10 px-2.5 py-2 text-xs font-bold text-red-300">Cancelar</button>}</div></article>)}</section>
    {!loading && invitations.length === 0 && <p className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">Todavía no hay invitaciones.</p>}
  </>;
}
