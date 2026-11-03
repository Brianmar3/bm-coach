"use client";
import { useEffect, useRef, useState } from "react";
import { CLASS_FEEDBACK_PRIVACY, CLASS_RATINGS, feedbackInput } from "@/lib/class-communication";
import { argentinaDateKey } from "@/lib/payment-dates";
import { inputClass } from "@/componentes/module-shell";

type Invitation = { occurrenceId: string; date: string; className: string; startTime: string; endTime: string; expiresAt: string; serverNow: string };
export function ClassFeedbackInvitation() {
  const [invitation, setInvitation] = useState<Invitation | null>(null); const [rating, setRating] = useState(""); const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [sent, setSent] = useState(false); const inFlight = useRef(false);
  const revision = useRef(0);
  useEffect(() => {
    if (!invitation?.expiresAt || !invitation.serverNow) return;
    // Use the server's clock so a device with an incorrect clock still expires on time.
    const remaining = Math.max(0, Date.parse(invitation.expiresAt) - Date.parse(invitation.serverNow));
    const timer = window.setTimeout(() => {
      revision.current++;
      setInvitation(current => current?.occurrenceId === invitation.occurrenceId ? null : current);
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [invitation]);
  useEffect(() => {
    let controller: AbortController | undefined;
    const refresh = () => {
      if (inFlight.current) return;
      controller?.abort(); controller = new AbortController();
      const signal = controller.signal;
      const currentRevision = revision.current;
      void fetch("/api/portal/clases/opiniones", { cache: "no-store", signal }).then(async response => {
        if (response.ok) { const body = await response.json(); if (!signal.aborted && !inFlight.current && currentRevision === revision.current) setInvitation(body.invitation); }
      }).catch(() => {});
    };
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => { controller?.abort(); window.removeEventListener("focus", refresh); window.removeEventListener("pageshow", refresh); document.removeEventListener("visibilitychange", visible); };
  }, []);
  async function submit(skip = false) {
    if (!invitation || inFlight.current) return;
    setError(""); let input;
    try { input = feedbackInput({ occurrenceId: invitation.occurrenceId, rating, comment, skip }); }
    catch (failure) { setError((failure as Error).message); return; }
    revision.current++; inFlight.current = true; setSaving(true);
    try {
      const response = await fetch("/api/portal/clases/opiniones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      if (response.status === 409) {
        const latest = await fetch("/api/portal/clases/opiniones", { cache: "no-store" });
        if (!latest.ok) throw new Error("No se pudo verificar tu respuesta. Volvé a intentar.");
        const current = await latest.json();
        if (current.invitation?.occurrenceId === invitation.occurrenceId) throw new Error("Tu respuesta no se guardó. Volvé a intentar.");
        setInvitation(null); return;
      }
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "No se pudo guardar tu opinión.");
      setInvitation(null); setSent(!skip);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "No se pudo guardar tu opinión."); }
    finally { inFlight.current = false; setSaving(false); }
  }
  if (!invitation) return sent ? <p role="status" className="my-3 rounded-xl border border-emerald-400/30 p-3 text-sm text-emerald-300">Gracias por compartir tu opinión.</p> : null;
  return <section aria-label="Opinión de tu clase" className="my-3 rounded-2xl border border-yellow-400/25 bg-zinc-950 p-4 text-zinc-100">
    <h2 className="font-bold text-yellow-300">{invitation.date === argentinaDateKey() ? "¿Qué te pareció la clase de hoy?" : "¿Qué te pareció esta clase?"}</h2><p className="mt-1 text-sm text-zinc-400">Tu opinión nos ayuda a mejorar.</p>
    <p className="mt-2 text-sm font-semibold">{invitation.className} · {new Date(invitation.date + "T12:00:00Z").toLocaleDateString("es-AR", { timeZone: "UTC" })} · {invitation.startTime}–{invitation.endTime}</p>
    <p className="mt-2 text-xs text-zinc-400">Es opcional. {CLASS_FEEDBACK_PRIVACY}</p>
    <form onSubmit={event => { event.preventDefault(); void submit(); }} className="mt-3 space-y-3"><div role="group" aria-label="Valoración" className="flex flex-wrap gap-2">{CLASS_RATINGS.map(item => <button key={item.value} type="button" disabled={saving} aria-pressed={rating === item.value} onClick={() => setRating(item.value)} className={`min-h-11 rounded-xl border px-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-yellow-300 ${rating === item.value ? "border-yellow-400 bg-yellow-400/10 text-yellow-300" : "border-zinc-700 text-zinc-300"}`}>{item.label}</button>)}</div>
      <label className="block text-sm">Comentario (opcional)<textarea maxLength={1000} rows={2} value={comment} disabled={saving} onChange={event => setComment(event.target.value)} className={`${inputClass} mt-1`}/></label>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <div className="flex flex-wrap gap-2"><button type="submit" disabled={saving} className="min-h-11 rounded-xl bg-yellow-400 px-4 text-sm font-bold text-zinc-950 disabled:opacity-50">Enviar opinión</button><button type="button" disabled={saving} onClick={() => void submit(true)} className="min-h-11 rounded-xl border border-zinc-700 px-4 text-sm text-zinc-300">Omitir</button></div>
    </form>
  </section>;
}
