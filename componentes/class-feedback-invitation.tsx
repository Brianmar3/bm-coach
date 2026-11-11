"use client";

import { useRef, useState } from "react";
import { CLASS_FEEDBACK_PRIVACY, CLASS_RATINGS, feedbackInput } from "@/lib/class-communication";
import { inputClass } from "@/componentes/module-shell";

type CompletedClass = { occurrenceId: string; date: string; className: string; startTime: string; endTime: string };

function classLabel(item: CompletedClass) {
  const date = new Date(item.date + "T12:00:00Z").toLocaleDateString("es-AR", { timeZone: "UTC" });
  return `${item.className} · ${date} · ${item.startTime}–${item.endTime}`;
}

export function ClassFeedbackInvitation() {
  const [open, setOpen] = useState(false);
  const [classes, setClasses] = useState<CompletedClass[]>([]);
  const [occurrenceId, setOccurrenceId] = useState("");
  const [rating, setRating] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const inFlight = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);

  async function openForm() {
    if (inFlight.current || open) return;
    inFlight.current = true;
    setOpen(true);
    setLoading(true);
    setError("");
    setSent(false);
    setClasses([]);
    setOccurrenceId("");
    setRating("");
    setComment("");
    try {
      const response = await fetch("/api/portal/clases/opiniones", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "No se pudieron cargar tus clases.");
      setClasses(body.classes);
      setOccurrenceId(body.classes[0]?.occurrenceId ?? "");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudieron cargar tus clases.");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }

  function closeForm() {
    setOpen(false);
    trigger.current?.focus();
  }

  async function submit() {
    if (!occurrenceId || inFlight.current) return;
    setError("");
    let input;
    try { input = feedbackInput({ occurrenceId, rating, comment }); }
    catch (failure) { setError((failure as Error).message); return; }
    inFlight.current = true;
    setSaving(true);
    try {
      const response = await fetch("/api/portal/clases/opiniones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "No se pudo guardar tu opinión.");
      setSent(true);
      closeForm();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo guardar tu opinión.");
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return <div className="mt-3 rounded-xl border border-yellow-400/20 bg-yellow-400/[.035] px-3 py-2 text-zinc-100">
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <h2 className="text-sm font-semibold">¿Cómo estuvo tu entrenamiento?</h2>
      <button ref={trigger} type="button" aria-expanded={open} aria-controls="student-class-opinion" onClick={() => open ? closeForm() : void openForm()} disabled={loading || saving} className="min-h-11 rounded-lg px-2 text-sm font-bold text-[var(--brand-text)] focus-visible:outline-2 focus-visible:outline-yellow-300 disabled:opacity-60">
        {open ? "Cerrar" : "Dejar opinión"}
      </button>
    </div>
    {sent && <p role="status" className="pb-1 text-sm text-emerald-300">Gracias por compartir tu opinión.</p>}
    <section id="student-class-opinion" aria-label="Opinión de tu clase" hidden={!open}>
      {loading && <p role="status" className="text-sm text-zinc-400">Cargando tus clases…</p>}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {!loading && !error && !classes.length && <p className="pb-2 text-sm text-zinc-400">No tenés clases disponibles para opinar. Podés responder durante las 24 horas posteriores a una clase con asistencia registrada.</p>}
      {classes.length > 0 && <form onSubmit={event => { event.preventDefault(); void submit(); }} className="space-y-3 pb-2">
        {classes.length === 1 ? <p className="text-sm font-semibold">{classLabel(classes[0])}</p> :
          <label className="block text-sm">Clase realizada
            <select value={occurrenceId} disabled={saving} onChange={event => { setOccurrenceId(event.target.value); setRating(""); setComment(""); setError(""); }} className={`${inputClass} mt-1 w-full`}>
              {classes.map(item => <option key={item.occurrenceId} value={item.occurrenceId}>{classLabel(item)}</option>)}
            </select>
          </label>}
        <p className="text-xs text-zinc-400">{CLASS_FEEDBACK_PRIVACY}</p>
        <div role="group" aria-label="Valoración" className="flex flex-wrap gap-2">{CLASS_RATINGS.map(item => <button key={item.value} type="button" disabled={saving} aria-pressed={rating === item.value} onClick={() => setRating(item.value)} className={`min-h-11 rounded-xl border px-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-yellow-300 ${rating === item.value ? "border-yellow-400 bg-yellow-400/10 text-yellow-300" : "border-zinc-700 text-zinc-300"}`}>{item.label}</button>)}</div>
        <label className="block text-sm">Comentario (opcional)<textarea maxLength={1000} rows={2} value={comment} disabled={saving} onChange={event => setComment(event.target.value)} className={`${inputClass} mt-1`}/></label>
        <button type="submit" disabled={saving} className="min-h-11 rounded-xl bg-yellow-400 px-4 text-sm font-bold text-zinc-950 disabled:opacity-50">{saving ? "Enviando…" : "Enviar opinión"}</button>
      </form>}
    </section>
  </div>;
}
