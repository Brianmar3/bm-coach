"use client";

import { useEffect, useState } from "react";
import { studentInvitationWhatsappText } from "@/lib/student-invitations";

type Invitation = { id: string; createdAt: string; expiresAt: string; status: "PENDING" | "USED" | "EXPIRED" | "REVOKED"; url: string | null };

export function StudentInvitations({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [items, setItems] = useState<Invitation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createdUrl, setCreatedUrl] = useState("");
  function close() { setCreatedUrl(""); setError(""); onClose(); }
  async function load() {
    const response = await fetch("/api/alumnos/invitaciones", { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudieron cargar las invitaciones.");
    const result = await response.json() as { invitations: Invitation[] };
    setItems(result.invitations);
  }
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/alumnos/invitaciones", { cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error("No se pudieron cargar las invitaciones."); return response.json() as Promise<{ invitations: Invitation[] }>; })
      .then((result) => setItems(result.invitations))
      .catch(() => { /* The manual enrollment remains usable if invitations are unavailable. */ });
    return () => controller.abort();
  }, []);
  async function create() {
    if (busy) return; setBusy(true); setError("");
    try {
      const response = await fetch("/api/alumnos/invitaciones", { method: "POST" });
      const result = await response.json() as { error?: string; url?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "No se pudo crear la invitación.");
      setCreatedUrl(result.url);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo crear la invitación."); }
    finally { setBusy(false); }
  }
  async function revoke(id: string) {
    if (busy || !window.confirm("¿Revocar esta invitación?")) return; setBusy(true); setError("");
    try {
      const response = await fetch("/api/alumnos/invitaciones", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "No se pudo revocar la invitación.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo revocar la invitación."); }
    finally { setBusy(false); }
  }
  const pending = items.filter((item) => item.status === "PENDING");
  return <>
    {pending.length > 0 && <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><h2 className="font-bold">Invitaciones pendientes <span className="text-zinc-400">({pending.length})</span></h2><div className="mt-3 space-y-2">{pending.map((item) => <article key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"><p className="text-xs text-zinc-400">Creada {new Date(item.createdAt).toLocaleDateString("es-AR")} · Vence {new Date(item.expiresAt).toLocaleDateString("es-AR")} · Pendiente</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => item.url && navigator.clipboard.writeText(item.url)} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-yellow-300">Copiar enlace</button>{item.url && <a href={`https://wa.me/?text=${encodeURIComponent(studentInvitationWhatsappText(item.url))}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-emerald-300">Compartir por WhatsApp</a>}<button type="button" disabled={busy} onClick={() => revoke(item.id)} className="rounded-lg px-3 py-2 text-xs font-bold text-red-300">Revocar</button></div></article>)}</div></section>}
    {open && <div className="fixed inset-0 z-[70] grid place-items-center bg-black/85 p-4"><section role="dialog" aria-modal="true" aria-label="Invitar alumno" className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-5 text-white"><div className="flex items-center justify-between"><h2 className="text-xl font-black">Invitar alumno</h2><button type="button" onClick={close} className="p-2 text-zinc-400">Cerrar</button></div><p className="mt-2 text-sm text-zinc-400">El alumno completa sus datos desde un enlace válido por 7 días.</p>{error && <p role="alert" className="mt-4 rounded-lg bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}{createdUrl ? <><p className="mt-4 break-all rounded-lg bg-zinc-950 p-3 text-xs">{createdUrl}</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => navigator.clipboard.writeText(createdUrl)} className="rounded-lg bg-yellow-400 px-4 py-3 text-sm font-black text-zinc-950">Copiar enlace</button><a href={`https://wa.me/?text=${encodeURIComponent(studentInvitationWhatsappText(createdUrl))}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-zinc-700 px-4 py-3 text-sm font-bold text-emerald-300">Compartir por WhatsApp</a></div></> : <button type="button" disabled={busy} onClick={create} className="mt-5 min-h-12 w-full rounded-xl bg-yellow-400 font-black text-zinc-950 disabled:opacity-60">{busy ? "Generando…" : "Generar enlace"}</button>}</section></div>}
  </>;
}
