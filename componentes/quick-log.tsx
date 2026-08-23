"use client";
/* eslint-disable @next/next/no-img-element -- Blob URLs are validated uploads */

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { QuickLog, QuickLogType } from "@/types/quick-log";
import { normalizeExerciseName } from "@/lib/exercise-name";
import { announceNewAchievements, type CelebrationAchievement } from "@/componentes/achievement-celebration";
import {
  EMPTY_QUICK_LOG_DRAFT,
  exerciseSuggestions,
  normalizeExerciseSearch,
  quickLogPayload,
  quickLogSummary,
  validateQuickLogDraft,
  type ExerciseSuggestion,
  type QuickLogDraft,
  type QuickLogKind,
} from "@/lib/quick-log-flow";

const labels: Record<QuickLogType, { title: string; icon: string }> = {
  WORKOUT: { title: "Entrenamiento", icon: "✓" },
  NOTE: { title: "Nota", icon: "▤" },
  PROGRESS: { title: "Progreso", icon: "↗" },
  PHOTO: { title: "Foto", icon: "▣" },
};
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());

export function QuickLogLauncher() {
  const [open, setOpen] = useState(false);
  return <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3"><h2 className="text-xs font-bold uppercase tracking-[.16em] text-yellow-400">Registro rápido</h2><button type="button" onClick={() => setOpen(true)} className="mt-3 min-h-11 w-full rounded-xl bg-yellow-400 px-4 text-sm font-bold text-zinc-950">¿Qué querés anotar?</button>{open && <GuidedQuickLogForm close={() => setOpen(false)} saved={(keepOpen) => { if (!keepOpen) setOpen(false); }} />}</section>;
}

export function QuickNoteButton({ placement }: { placement: "navigation" | "inline" }) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const className = placement === "navigation"
    ? "group relative grid h-14 w-14 aspect-square shrink-0 -translate-y-2 place-items-center self-center justify-self-center rounded-full border border-yellow-400/45 bg-zinc-950 text-xl font-black text-yellow-300 shadow-[0_8px_22px_rgba(250,204,21,.08),0_10px_28px_rgba(0,0,0,.55)] transition-[color,background-color,border-color,transform] duration-200 hover:border-yellow-300/70 hover:bg-yellow-400/[.06] active:-translate-y-1 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
    : "inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-yellow-400/30 bg-yellow-400/[.05] px-3 text-xs font-black text-yellow-300 transition hover:border-yellow-400/50 hover:bg-yellow-400/[.09] active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300";
  return <>{<button type="button" onClick={() => setOpen(true)} aria-label="Abrir registro rápido" className={className}><span aria-hidden="true">＋</span><span className={placement === "navigation" ? "sr-only" : ""}>Registro rápido</span></button>}{open && <GuidedQuickLogForm close={() => setOpen(false)} saved={(keepOpen) => { if (!keepOpen) setOpen(false); setNotice("Registro guardado correctamente."); window.dispatchEvent(new Event("bm:achievement-check")); window.setTimeout(() => setNotice(""), 3000); }} />}{notice && <p role="status" className="fixed bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] left-4 right-4 z-[75] mx-auto max-w-md rounded-xl border border-emerald-400/25 bg-zinc-950 px-4 py-3 text-sm text-emerald-300 shadow-2xl">{notice}</p>}</>;
}

type QuickCategory = "strength" | "circuit" | "other";

const CATEGORY_LABEL: Record<QuickCategory, string> = { strength: "Ejercicio de fuerza", circuit: "Circuito o desafío", other: "Otro registro" };
const CATEGORY_META: Record<QuickCategory, { description: string; icon: string }> = {
  strength: { description: "Peso, series, repeticiones y marcas personales.", icon: "◆" },
  circuit: { description: "AMRAP, EMOM, vueltas, tiempo y desafíos.", icon: "◷" },
  other: { description: "Notas, marcas rápidas y otros seguimientos.", icon: "▤" },
};
const KIND_LABEL: Record<QuickLogKind, string> = { strength: "Ejercicio de fuerza", time: "Tiempo", rounds: "Vueltas", amrap: "AMRAP", emom: "EMOM", cardio: "Cardio", intervals: "Intervalos", note: "Nota libre" };

function GuidedQuickLogForm({ close, saved }: { close: () => void; saved: (keepOpen: boolean) => void | Promise<void> }) {
  const [category, setCategory] = useState<QuickCategory | null>(null);
  const [draft, setDraft] = useState<QuickLogDraft>({ ...EMPTY_QUICK_LOG_DRAFT });
  const [options, setOptions] = useState<ExerciseSuggestion[]>([]);
  const [advanced, setAdvanced] = useState(false);
  const [circuitDetails, setCircuitDetails] = useState(false);
  const [choosingIntervalFormat, setChoosingIntervalFormat] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedExerciseKey, setSelectedExerciseKey] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof QuickLogDraft, string>>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingLock = useRef(false);
  const requestKey = useRef("");
  const suggestions = useMemo(() => draft.exercise.trim() ? exerciseSuggestions(options, draft.exercise) : [], [draft.exercise, options]);
  const exactSuggestion = suggestions.some((option) => normalizeExerciseSearch(option.name) === normalizeExerciseSearch(draft.exercise));
  const set = <K extends keyof QuickLogDraft>(key: K, value: QuickLogDraft[K]) => { setDraft((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: undefined })); };

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/portal/quick-logs/exercises", { cache: "no-store", signal: controller.signal })
      .then(async (response) => { const body = await response.json() as { options?: ExerciseSuggestion[] }; if (response.ok) setOptions(body.options ?? []); })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  function chooseCategory(value: QuickCategory) {
    setCategory(value);
    if (value === "strength") set("kind", "strength");
    else if (draft.kind === "strength") set("kind", null);
  }

  function back() {
    if (choosingIntervalFormat && !draft.kind) { setChoosingIntervalFormat(false); return; }
    if (category && draft.kind && draft.kind !== "strength") { set("kind", null); return; }
    if (draft.kind === "strength") set("kind", null);
    setCategory(null);
  }

  async function save(addAnother: boolean) {
    if (savingLock.current) return;
    const validation = validateQuickLogDraft(draft);
    if (Object.keys(validation).length) { setErrors(validation); return; }
    savingLock.current = true;
    setSaving(true);
    setError("");
    try {
      const form = new FormData();
      for (const [key, value] of Object.entries(quickLogPayload(draft, today()))) form.set(key, value);
      if (!requestKey.current) requestKey.current = window.crypto.randomUUID();
      form.set("idempotencyKey", requestKey.current);
      const response = await fetch("/api/portal/quick-logs", { method: "POST", body: form });
      const body = await response.json() as { error?: string; newAchievements?: CelebrationAchievement[] };
      if (!response.ok) throw new Error(body.error ?? "No se pudo guardar el registro.");
      announceNewAchievements(body.newAchievements);
      await saved(addAnother);
      if (addAnother) {
        setCategory(null);
        setDraft({ ...EMPTY_QUICK_LOG_DRAFT });
        setAdvanced(false);
        setCircuitDetails(false);
        setChoosingIntervalFormat(false);
        setErrors({});
        requestKey.current = "";
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar el registro.");
    } finally {
      savingLock.current = false;
      setSaving(false);
    }
  }

  const fieldError = (key: keyof QuickLogDraft) => errors[key] ? <span className="mt-1 block text-xs text-red-300">{errors[key]}</span> : null;
  const numberInput = (key: keyof QuickLogDraft, placeholder: string, optional = false) => <><input type="number" min="0" inputMode="numeric" value={String(draft[key] ?? "")} onChange={(event) => set(key, event.target.value as never)} placeholder={placeholder} className="input min-h-12" />{optional ? null : fieldError(key)}</>;

  return <div className="fixed inset-0 z-[70] flex items-end justify-center overflow-hidden bg-black/85 pt-[calc(env(safe-area-inset-top,0px)+1rem)] backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(event) => event.target === event.currentTarget && close()}><form onSubmit={(event) => { event.preventDefault(); void save(false); }} className="quick-log-sheet-enter flex max-h-[min(82dvh,calc(100dvh-env(safe-area-inset-top,0px)-1rem))] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-yellow-400/15 bg-[#111] shadow-2xl sm:rounded-3xl">
    <header className="sticky top-0 z-20 flex shrink-0 items-start gap-3 border-b border-zinc-800 bg-[#111]/95 p-4 backdrop-blur"><button type="button" onClick={category ? back : close} disabled={saving} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-zinc-800 bg-zinc-950/70 text-lg text-zinc-300 transition hover:border-yellow-400/30 hover:text-yellow-300 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300" aria-label="Volver">←</button><div className="min-w-0 pt-0.5"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-yellow-400">Registro rápido</p><h2 className="mt-0.5 text-lg font-black leading-tight sm:text-xl">{draft.kind ? KIND_LABEL[draft.kind] : category ? CATEGORY_LABEL[category] : "¿Qué querés registrar hoy?"}</h2>{!category && <p className="mt-1 text-xs leading-relaxed text-zinc-400 sm:text-sm">Elegí una opción para guardar tu progreso.</p>}</div></header>
    <div className={`min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 ${draft.kind ? "pb-6" : "pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]"}`}>
      {error && <p role="alert" className="rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
      {!category && <div className="grid gap-3">{(["strength", "circuit", "other"] as QuickCategory[]).map((value) => <button key={value} type="button" onClick={() => chooseCategory(value)} aria-label={`${CATEGORY_LABEL[value]}. ${CATEGORY_META[value].description}`} className="group grid min-h-[5.5rem] w-full grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-zinc-800 bg-[linear-gradient(135deg,#181818,#0a0a0a)] p-3 text-left shadow-[0_10px_24px_rgba(0,0,0,.18)] transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-yellow-400/35 hover:shadow-[0_14px_30px_rgba(0,0,0,.28)] active:translate-y-0 active:scale-[.985] active:border-yellow-400/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"><span aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-xl border border-yellow-400/15 bg-yellow-400/[.07] text-lg text-yellow-300 transition group-hover:border-yellow-400/30 group-hover:bg-yellow-400/[.1]">{CATEGORY_META[value].icon}</span><span className="min-w-0"><strong className="block text-sm font-black text-white sm:text-base">{CATEGORY_LABEL[value]}</strong><span className="mt-1 block text-xs leading-snug text-zinc-400 sm:text-sm">{CATEGORY_META[value].description}</span></span><span aria-hidden="true" className="pr-1 text-lg text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-yellow-300">›</span></button>)}</div>}
      {category === "circuit" && !draft.kind && !choosingIntervalFormat && <Choice title="¿Qué resultado querés registrar?" options={[{ value: "time", label: "Tiempo" }, { value: "rounds", label: "Vueltas" }, { value: "interval", label: "AMRAP / EMOM" }]} choose={(value) => value === "interval" ? setChoosingIntervalFormat(true) : set("kind", value as QuickLogKind)} />}
      {category === "other" && !draft.kind && <Choice title="¿Qué querés registrar?" options={[{ value: "cardio", label: "Cardio" }, { value: "intervals", label: "Intervalos" }, { value: "note", label: "Nota libre" }]} choose={(value) => set("kind", value as QuickLogKind)} />}
      {category === "circuit" && !draft.kind && choosingIntervalFormat && <Choice title="Elegí el formato" options={[{ value: "amrap", label: "AMRAP" }, { value: "emom", label: "EMOM" }]} choose={(value) => set("kind", value as QuickLogKind)} compact />}
      {draft.kind === "strength" && <div className="space-y-4"><Field label="¿Qué ejercicio hiciste?"><div className="relative"><input ref={inputRef} autoFocus value={draft.exercise} onFocus={() => setSuggestionsOpen(true)} onChange={(event) => { const value = event.target.value; set("exercise", value); setSuggestionsOpen(true); const normalized = normalizeExerciseSearch(value); if (selectedExerciseKey && normalized !== selectedExerciseKey) setSelectedExerciseKey(null); }} maxLength={120} autoComplete="off" placeholder="Empezá a escribir" className="input min-h-12" />{fieldError("exercise")}{draft.exercise.trim() && suggestionsOpen && <div className="mt-2 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">{suggestions.map((option) => <button key={normalizeExerciseName(option.name)} type="button" onClick={() => { set("exercise", option.name); setSelectedExerciseKey(normalizeExerciseSearch(option.name)); setSuggestionsOpen(false); inputRef.current?.focus(); }} className="flex min-h-12 w-full items-center justify-between gap-3 border-b border-zinc-800 px-3 text-left text-sm last:border-0"><strong>{option.name}</strong>{option.muscleGroup && <span className="text-xs text-zinc-500">{option.muscleGroup}</span>}</button>)}{!exactSuggestion && <button type="button" onClick={() => { set("exercise", draft.exercise.trim()); setSelectedExerciseKey(null); setSuggestionsOpen(false); inputRef.current?.focus(); }} className="min-h-11 w-full px-3 text-left text-sm font-semibold text-yellow-300">Usar “{draft.exercise.trim()}”</button>}</div>}</div></Field><div className="grid grid-cols-3 gap-2"><Field label="Peso (kg)"><input type="number" min="0" step="0.01" inputMode="decimal" value={draft.weight} onChange={(event) => set("weight", event.target.value)} placeholder="Opcional" className="input min-h-12" />{fieldError("weight")}</Field><Field label="Repeticiones">{numberInput("repetitions", "8")}</Field><Field label="Series">{numberInput("sets", "4")}</Field></div><button type="button" onClick={() => setAdvanced((value) => !value)} className="text-sm font-bold text-yellow-300">{advanced ? "Ocultar detalles" : "Agregar más detalles"}</button>{advanced && <div className="grid gap-3 rounded-xl border border-zinc-800 p-3 sm:grid-cols-2"><Field label="Esfuerzo"><div className="flex gap-2"><select value={draft.effortType} onChange={(event) => set("effortType", event.target.value as "RIR" | "RPE")} className="input w-24"><option>RPE</option><option>RIR</option></select><input type="number" min="0" max="10" step="0.5" value={draft.effort} onChange={(event) => set("effort", event.target.value)} className="input min-w-0 flex-1" /></div></Field><Field label="Descanso (segundos)">{numberInput("restSeconds", "90", true)}</Field><Field label="Observación" wide><textarea value={draft.note} onChange={(event) => set("note", event.target.value)} rows={2} className="input resize-none" /></Field></div>}</div>}
      {draft.kind === "time" && <div className="space-y-4"><TextField label="Nombre del circuito o desafío" value={draft.title} setValue={(value) => set("title", value)} error={errors.title} /><TextField label="Tiempo final" value={draft.finalTime} setValue={(value) => set("finalTime", value)} error={errors.finalTime} placeholder="12:45" inputMode="numeric" /><TextArea label="Observación opcional" value={draft.note} setValue={(value) => set("note", value)} /></div>}
      {draft.kind === "rounds" && <div className="space-y-4"><TextField label="Nombre del circuito" value={draft.title} setValue={(value) => set("title", value)} error={errors.title} /><div className="grid grid-cols-2 gap-3"><Field label="Vueltas completadas">{numberInput("rounds", "5")}</Field><Field label="Repeticiones adicionales">{numberInput("extraRepetitions", "8", true)}</Field></div><Field label="Duración opcional (min)">{numberInput("durationMinutes", "15", true)}</Field></div>}
      {draft.kind === "amrap" && <div className="space-y-4"><TextField label="Nombre del circuito" value={draft.title} setValue={(value) => set("title", value)} error={errors.title} /><div className="grid grid-cols-3 gap-2"><Field label="Duración">{numberInput("durationMinutes", "12")}</Field><Field label="Vueltas">{numberInput("rounds", "5")}</Field><Field label="Reps. extra">{numberInput("extraRepetitions", "8", true)}</Field></div></div>}
      {draft.kind === "emom" && <div className="space-y-4"><TextField label="Nombre del circuito" value={draft.title} setValue={(value) => set("title", value)} /><div className="grid grid-cols-2 gap-3"><Field label="Duración total (min)">{numberInput("durationMinutes", "10")}</Field><Field label="Minutos completados">{numberInput("completedMinutes", "10")}</Field></div></div>}
      {["time", "rounds", "amrap", "emom"].includes(draft.kind ?? "") && <div><button type="button" onClick={() => setCircuitDetails((value) => !value)} className="text-sm font-bold text-yellow-300">{circuitDetails ? "Ocultar ejercicios" : "Agregar ejercicios del circuito"}</button>{circuitDetails && <TextArea label="Ejercicios del circuito" value={draft.circuitExercises} setValue={(value) => set("circuitExercises", value)} />}</div>}
      {draft.kind === "cardio" && <div className="space-y-4"><TextField label="Actividad" value={draft.activity} setValue={(value) => set("activity", value)} error={errors.activity} placeholder="Caminata" /><div className="grid grid-cols-2 gap-3"><Field label="Duración (min)">{numberInput("durationMinutes", "35")}</Field><Field label="Distancia opcional (km)"><input type="number" min="0" step="0.01" inputMode="decimal" value={draft.distance} onChange={(event) => set("distance", event.target.value)} className="input min-h-12" /></Field></div></div>}
      {draft.kind === "intervals" && <div className="space-y-4"><TextField label="Actividad" value={draft.activity} setValue={(value) => set("activity", value)} error={errors.activity} /><div className="grid grid-cols-3 gap-2"><Field label="Rondas">{numberInput("rounds", "8")}</Field><Field label="Trabajo (s)">{numberInput("workSeconds", "30")}</Field><Field label="Descanso (s)">{numberInput("restSeconds", "30")}</Field></div></div>}
      {draft.kind === "note" && <TextArea label="¿Qué querés anotar?" value={draft.note} setValue={(value) => set("note", value)} error={errors.note} />}
    </div>
    {draft.kind && <footer className="sticky bottom-0 z-10 mt-auto shrink-0 border-t border-zinc-800 bg-[#111]/95 p-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] backdrop-blur"><button type="submit" disabled={saving} className="min-h-12 w-full rounded-xl bg-yellow-400 px-4 font-black text-zinc-950 disabled:opacity-50">{saving ? "Guardando…" : "Guardar"}</button><div className="mt-2 flex items-center justify-between gap-3"><button type="button" disabled={saving} onClick={() => void save(true)} className="min-h-10 text-sm font-semibold text-yellow-300 disabled:opacity-50">Guardar y agregar otro</button><button type="button" disabled={saving} onClick={close} className="min-h-10 text-sm text-zinc-500 disabled:opacity-50">Cancelar</button></div></footer>}
  </form></div>;
}

function Choice({ title, options, choose, compact = false }: { title: string; options: Array<{ value: string; label: string }>; choose: (value: string) => void; compact?: boolean }) { return <section><h3 className="font-bold">{title}</h3><div className={`mt-3 grid gap-3 ${compact ? "grid-cols-2" : ""}`}>{options.map((option) => <button key={option.value} type="button" onClick={() => choose(option.value)} className="min-h-16 rounded-xl border border-zinc-800 bg-zinc-950 px-4 text-left font-bold hover:border-yellow-400/40 hover:text-yellow-300">{option.label}</button>)}</div></section>; }
function TextField({ label, value, setValue, error, placeholder, inputMode }: { label: string; value: string; setValue: (value: string) => void; error?: string; placeholder?: string; inputMode?: "text" | "numeric" }) { return <Field label={label}><input value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} inputMode={inputMode} className="input min-h-12" />{error && <span className="mt-1 block text-xs text-red-300">{error}</span>}</Field>; }
function TextArea({ label, value, setValue, error }: { label: string; value: string; setValue: (value: string) => void; error?: string }) { return <Field label={label}><textarea value={value} onChange={(event) => setValue(event.target.value)} rows={3} maxLength={1000} className="input resize-none" />{error && <span className="mt-1 block text-xs text-red-300">{error}</span>}</Field>; }

export function QuickLogHistory() {
  const [logs, setLogs] = useState<QuickLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [type, setType] = useState<QuickLogType | "">("");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<QuickLog | null>(null);
  const [view, setView] = useState<"chronological" | "exercises">("chronological");
  const [selectedExercise, setSelectedExercise] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    const params = new URLSearchParams(); if (type) params.set("type", type); if (query.trim()) params.set("query", query.trim()); if (from) params.set("from", from); if (to) params.set("to", to);
    try { const response = await fetch(`/api/portal/quick-logs?${params}`, { cache: "no-store" }); const body = await response.json() as { logs?: QuickLog[]; error?: string }; if (!response.ok) throw new Error(body.error); setLogs(body.logs ?? []); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudieron cargar los registros."); }
    finally { setLoading(false); }
  }, [from, query, to, type]);
  useEffect(() => { const timeout = window.setTimeout(load, 250); return () => window.clearTimeout(timeout); }, [load]);
  useEffect(() => {
    if (loading || !window.location.hash.startsWith("#registro-")) return;
    window.setTimeout(() => document.querySelector(window.location.hash)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  }, [loading, logs]);
  const exerciseGroups = useMemo(() => {
    const groups = new Map<string, QuickLog[]>();
    for (const log of logs) {
      if (log.type !== "PROGRESS" || log.metricType !== "carga" || !log.exerciseName.trim()) continue;
      const key = log.exerciseKey || normalizeExerciseName(log.exerciseName);
      groups.set(key, [...(groups.get(key) ?? []), log]);
    }
    return [...groups.entries()].map(([key, items]) => ({
      key,
      name: items[0].exerciseName,
      logs: items,
      latest: items[0],
      maximum: Math.max(...items.map((item) => item.currentValue ?? 0)),
    })).sort((left, right) => right.latest.createdAt.localeCompare(left.latest.createdAt));
  }, [logs]);
  async function remove(log: QuickLog) {
    if (!window.confirm(`¿Eliminar “${log.title || labels[log.type].title}”? Esta acción no se puede deshacer.`)) return;
    const response = await fetch(`/api/portal/quick-logs/${log.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" });
    const body = await response.json() as { error?: string; message?: string }; if (!response.ok) { setError(body.error ?? "No se pudo eliminar."); return; }
    setNotice(body.message ?? "Registro eliminado correctamente."); await load();
  }
  async function removePhoto(log: QuickLog, photoId: string) {
    if (!window.confirm("¿Eliminar esta foto del registro?")) return;
    const response = await fetch(`/api/portal/quick-logs/${log.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photoId }) });
    const body = await response.json() as { error?: string; message?: string }; if (!response.ok) { setError(body.error ?? "No se pudo eliminar la foto."); return; }
    setNotice(body.message ?? "Foto eliminada correctamente."); await load();
  }
  return <div><header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-yellow-400">Registro personal</p><h1 className="mt-1 text-2xl font-bold">Mis registros</h1><p className="mt-1 text-sm text-zinc-500">Consultá tu historial cronológico o la evolución de cada ejercicio.</p></div><button onClick={() => setCreating(true)} className="rounded-xl bg-yellow-400 px-4 py-2.5 text-sm font-bold text-zinc-950">+ Nuevo registro</button></header>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}{notice && <p role="status" className="mt-4 rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-200">{notice}</p>}
    <div className="mt-4 inline-flex rounded-xl border border-zinc-800 bg-zinc-950 p-1" role="tablist" aria-label="Vista de registros"><button type="button" role="tab" aria-selected={view === "chronological"} onClick={() => setView("chronological")} className={`min-h-10 rounded-lg px-3 text-sm font-semibold ${view === "chronological" ? "bg-yellow-400 text-zinc-950" : "text-zinc-400"}`}>Cronológico</button><button type="button" role="tab" aria-selected={view === "exercises"} onClick={() => setView("exercises")} className={`min-h-10 rounded-lg px-3 text-sm font-semibold ${view === "exercises" ? "bg-yellow-400 text-zinc-950" : "text-zinc-400"}`}>Por ejercicio</button></div>
    <section className="mt-4 grid gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-3 sm:grid-cols-2 lg:grid-cols-4"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en mis registros" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-yellow-400" /><select value={type} onChange={(event) => setType(event.target.value as QuickLogType | "")} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"><option value="">Todos</option>{(Object.keys(labels) as QuickLogType[]).map((value) => <option key={value} value={value}>{labels[value].title}</option>)}</select><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="Desde" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" /><input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="Hasta" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" /></section>
    <div className="mt-4 space-y-3">{loading ? <p className="rounded-xl bg-zinc-900 p-8 text-center text-zinc-500">Cargando registros…</p> : view === "chronological" ? logs.length ? logs.map((log) => <QuickLogCard key={log.id} log={log} edit={() => setEditing(log)} remove={() => remove(log)} removePhoto={(photoId) => removePhoto(log, photoId)} />) : <p className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-zinc-500">Todavía no hay registros personales.</p> : exerciseGroups.length ? exerciseGroups.map((group) => <section key={group.key} className="rounded-2xl border border-yellow-400/10 bg-gradient-to-br from-zinc-900 to-[#0b0b0b] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold text-zinc-100">{group.name}</h2><p className="mt-1 text-xs text-zinc-500">{group.logs.length} registro{group.logs.length === 1 ? "" : "s"} · Último: {new Date(`${group.latest.date}T12:00:00`).toLocaleDateString("es-AR")}</p></div><button type="button" onClick={() => setSelectedExercise((value) => value === group.key ? "" : group.key)} className="min-h-10 rounded-lg border border-yellow-400/20 px-3 text-xs font-bold text-yellow-300">{selectedExercise === group.key ? "Ocultar historial" : "Ver historial"}</button></div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><Metric label="Última carga" value={group.latest.currentValue === null ? "Sin carga" : `${group.latest.currentValue.toLocaleString("es-AR")} ${group.latest.unit || "kg"}`} /><Metric label="Máxima histórica" value={`${group.maximum.toLocaleString("es-AR")} ${group.latest.unit || "kg"}`} /><Metric label="Último trabajo" value={group.latest.sets !== null && group.latest.repetitions !== null ? `${group.latest.sets} × ${group.latest.repetitions}` : "Sin datos"} /><Metric label="Última fecha" value={new Date(`${group.latest.date}T12:00:00`).toLocaleDateString("es-AR")} /></div>{selectedExercise === group.key && <div className="mt-4 space-y-3 border-t border-zinc-800 pt-4">{group.logs.map((log) => <QuickLogCard key={log.id} log={log} edit={() => setEditing(log)} remove={() => remove(log)} removePhoto={(photoId) => removePhoto(log, photoId)} />)}</div>}</section>) : <p className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-zinc-500">Todavía no hay ejercicios registrados.</p>}</div>
    {creating && <GuidedQuickLogForm close={() => setCreating(false)} saved={async (keepOpen) => { if (!keepOpen) setCreating(false); setNotice("Registro guardado correctamente."); await load(); }} />}
    {editing && <QuickLogForm type={editing.type} initial={editing} close={() => setEditing(null)} saved={async () => { setEditing(null); setNotice("Registro actualizado correctamente."); await load(); }} />}
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-xl bg-black/55 p-3"><p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-zinc-200">{value}</p></div>;
}

function QuickLogCard({ log, edit, remove, removePhoto }: { log: QuickLog; edit: () => void; remove: () => void; removePhoto: (photoId: string) => void }) {
  const strength = log.type === "PROGRESS" && log.metricType === "carga" && log.sets !== null && log.repetitions !== null;
  const difference = strength && log.previousValue !== null && log.currentValue !== null ? log.currentValue - log.previousValue : null;
  const summary = quickLogSummary(log);
  const createdAt = new Date(log.createdAt);
  const time = Number.isNaN(createdAt.getTime()) ? "" : createdAt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  return <article id={`registro-${log.id}`} className="min-w-0 scroll-mt-24 overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-[#0c0c0c] p-4 shadow-[0_10px_28px_rgba(0,0,0,.2)]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-yellow-400">{labels[log.type].icon} {strength ? "Ejercicio" : labels[log.type].title}</p><h2 className="mt-1 break-words font-bold">{summary}</h2><p className="mt-1 text-xs text-zinc-500">{new Date(`${log.date}T12:00:00`).toLocaleDateString("es-AR")}{time ? ` · ${time}` : ""}</p></div><div className="flex shrink-0 gap-3 text-xs"><button onClick={edit} className="text-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-300">Editar</button><button onClick={remove} className="text-red-300 focus:outline-none focus:ring-2 focus:ring-red-300">Eliminar</button></div></div>
    {strength && <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"><div className="rounded-xl bg-black/55 p-3"><p className="text-[10px] uppercase tracking-wide text-zinc-500">Trabajo actual</p><p className="mt-1 font-bold">{log.sets} × {log.repetitions}</p></div><div className="rounded-xl bg-black/55 p-3"><p className="text-[10px] uppercase tracking-wide text-zinc-500">Carga actual</p><p className="mt-1 font-bold text-yellow-300">{log.currentValue === null ? "Peso corporal" : `${log.currentValue.toLocaleString("es-AR")} ${log.unit || "kg"}`}</p></div><div className="col-span-2 rounded-xl bg-black/55 p-3 sm:col-span-1"><p className="text-[10px] uppercase tracking-wide text-zinc-500">Registro anterior</p><p className="mt-1 text-sm">{log.previousValue === null ? "Sin carga anterior" : `${log.previousSets ?? "—"} × ${log.previousRepetitions ?? "—"} · ${log.previousValue.toLocaleString("es-AR")} ${log.unit || "kg"}`}{difference !== null && <span className="ml-2 text-zinc-500">{difference === 0 ? "Sin cambios" : `${difference > 0 ? "+" : ""}${difference.toLocaleString("es-AR")} ${log.unit || "kg"}`}</span>}</p></div></div>}
    {log.achievements.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{log.achievements.map((achievement) => <span key={achievement.id} className="rounded-full border border-yellow-400/20 bg-yellow-400/[.06] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-yellow-200">{achievement.type === "FIRST_MARK" ? "Primera marca" : achievement.type === "MAX_LOAD" ? "Nueva carga máxima" : achievement.type === "REPETITION_PR" ? "Récord de repeticiones" : `${achievement.recordCount} registros`}</span>)}</div>}{log.content && log.content !== summary && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-zinc-300">{log.content}</p>}{log.feedback && <div className="mt-3 rounded-xl border border-yellow-400/15 bg-yellow-400/[.04] p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">Devolución de {log.feedback.trainerName}</p><p className="mt-1 text-sm text-zinc-200">{log.feedback.text}</p><p className="mt-2 text-[10px] text-zinc-500">{new Date(log.feedback.updatedAt).toLocaleString("es-AR")}</p></div>}{log.mood && <p className="mt-2 text-xs text-zinc-500">Sensación: {log.mood}</p>}{log.hasPain && <p className="mt-2 rounded-lg bg-red-400/10 p-2 text-xs text-red-200">Molestia: {log.painDetails || "Sin detalle"}</p>}{log.photos.length > 0 && <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{log.photos.map((photo) => <div key={photo.id} className="relative min-w-0 overflow-hidden rounded-xl bg-black"><a href={photo.blobUrl} target="_blank" rel="noreferrer" aria-label="Abrir fotografía en tamaño completo" className="group block focus:outline-none focus:ring-2 focus:ring-yellow-300"><img src={photo.blobUrl} alt="Foto adjunta al registro" loading="lazy" className="aspect-square w-full object-cover transition group-hover:opacity-80" /><span className="absolute inset-x-1 bottom-1 rounded bg-black/75 px-2 py-1 text-center text-[10px] text-zinc-200">Ver completa</span></a><button onClick={() => removePhoto(photo.id)} aria-label="Eliminar foto" className="absolute right-1 top-1 rounded-full bg-black/85 px-2 py-1 text-xs text-red-200 focus:outline-none focus:ring-2 focus:ring-red-300">×</button></div>)}</div>}</article>;
}

function QuickLogForm({ type, initial, close, saved }: { type: QuickLogType; initial?: QuickLog; close: () => void; saved: () => void | Promise<void> }) {
  const [form, setForm] = useState({ title: initial?.title ?? "", content: initial?.content ?? "", category: initial?.category ?? "", date: initial?.date ?? today(), durationMinutes: initial?.durationMinutes?.toString() ?? "", exerciseName: initial?.exerciseName ?? "", metricType: initial?.metricType ?? "peso", previousValue: initial?.previousValue?.toString() ?? "", currentValue: initial?.currentValue?.toString() ?? "", unit: initial?.unit ?? "kg", mood: initial?.mood ?? "", hasPain: initial?.hasPain ?? false, painDetails: initial?.painDetails ?? "" });
  const [files, setFiles] = useState<File[]>([]); const [error, setError] = useState(""); const [saving, setSaving] = useState(false); const fileInput = useRef<HTMLInputElement>(null); const requestKey = useRef("");
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);
  const set = (key: keyof typeof form, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = initial ? await fetch(`/api/portal/quick-logs/${initial.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, type }) }) : await fetch("/api/portal/quick-logs", { method: "POST", body: (() => { const body = new FormData(); body.set("type", type); if (!requestKey.current) requestKey.current = window.crypto.randomUUID(); body.set("idempotencyKey", requestKey.current); Object.entries(form).forEach(([key, value]) => body.set(key, String(value))); files.forEach((file) => body.append("photos", file)); return body; })() });
      const body = await response.json() as { error?: string; newAchievements?: CelebrationAchievement[] }; if (!response.ok) throw new Error(body.error ?? "No se pudo guardar."); announceNewAchievements(body.newAchievements); await saved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar."); } finally { setSaving(false); }
  }
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 p-2 sm:p-5" onMouseDown={(event) => event.target === event.currentTarget && close()}><form onSubmit={submit} className="mx-auto my-2 w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:my-8 sm:p-5"><div className="flex justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-yellow-400">Registro rápido</p><h2 className="mt-1 text-xl font-bold">{initial ? "Editar" : "Nuevo"} {labels[type].title.toLowerCase()}</h2></div><button type="button" onClick={close} disabled={saving} className="text-sm text-zinc-400">Cerrar</button></div>{error && <p role="alert" className="mt-3 rounded-lg bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}<div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Título opcional"><input value={form.title} onChange={(event) => set("title", event.target.value)} maxLength={120} className="input" /></Field><Field label="Fecha"><input required type="date" value={form.date} onChange={(event) => set("date", event.target.value)} className="input" /></Field>
      {type === "WORKOUT" && <><Field label="Tipo de entrenamiento"><input value={form.category} onChange={(event) => set("category", event.target.value)} placeholder="Fuerza, movilidad…" className="input" /></Field><Field label="Duración (min)"><input type="number" min="1" max="1440" inputMode="numeric" value={form.durationMinutes} onChange={(event) => set("durationMinutes", event.target.value)} className="input" /></Field></>}
      {type === "NOTE" && <Field label="Categoría"><select value={form.category} onChange={(event) => set("category", event.target.value)} className="input"><option value="">Sin categoría</option>{["técnica", "energía", "molestia", "alimentación", "descanso", "recordatorio", "general"].map((item) => <option key={item}>{item}</option>)}</select></Field>}
      {type === "PROGRESS" && <><Field label="Ejercicio"><input required value={form.exerciseName} onChange={(event) => set("exerciseName", event.target.value)} className="input" /></Field><Field label="Tipo de progreso"><select value={form.metricType} onChange={(event) => set("metricType", event.target.value)} className="input">{["carga", "peso", "repeticiones", "series", "tiempo", "distancia", "técnica", "percepción personal"].map((item) => <option key={item}>{item === "carga" ? "Carga" : item}</option>)}</select></Field><Field label="Valor anterior opcional"><input type="number" min="0" step="any" inputMode="decimal" value={form.previousValue} onChange={(event) => set("previousValue", event.target.value)} className="input" /></Field><Field label={form.metricType === "carga" ? "Carga opcional" : "Nuevo valor"}><input required={form.metricType !== "carga"} type="number" min="0" step="any" inputMode="decimal" value={form.currentValue} onChange={(event) => set("currentValue", event.target.value)} className="input" /></Field><Field label="Unidad"><input value={form.unit} onChange={(event) => set("unit", event.target.value)} className="input" /></Field></>}
      {type === "PHOTO" && <Field label="Categoría"><select value={form.category} onChange={(event) => set("category", event.target.value)} className="input">{["progreso físico", "técnica", "ejercicio", "clase", "postura", "otra"].map((item) => <option key={item}>{item}</option>)}</select></Field>}
      <Field label={type === "WORKOUT" ? "Ejercicios y comentario" : "Comentario"} wide><textarea required={type === "NOTE"} value={form.content} onChange={(event) => set("content", event.target.value)} maxLength={5000} rows={4} className="input resize-y" /></Field><Field label="Sensación general"><select value={form.mood} onChange={(event) => set("mood", event.target.value)} className="input"><option value="">Sin indicar</option>{["Muy buena", "Buena", "Normal", "Difícil", "Muy difícil"].map((item) => <option key={item}>{item}</option>)}</select></Field><label className="flex min-h-11 items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm"><input type="checkbox" checked={form.hasPain} onChange={(event) => set("hasPain", event.target.checked)} className="accent-yellow-400" /> Dolor o molestias</label>{form.hasPain && <Field label="Detalle de la molestia" wide><textarea value={form.painDetails} onChange={(event) => set("painDetails", event.target.value)} maxLength={1000} rows={2} className="input" /></Field>}
      {!initial && <div className="sm:col-span-2"><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 4))} className="sr-only" /><button type="button" onClick={() => fileInput.current?.click()} className={`rounded-lg px-3 py-2 text-sm text-yellow-300 ${type === "PHOTO" ? "border border-dashed border-yellow-400/40" : "border border-zinc-700"}`}>{type === "PHOTO" ? "Tomar o elegir hasta 4 fotos" : "Adjuntar foto opcional"}</button>{previews.length > 0 && <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{previews.map((preview) => <img key={preview} src={preview} alt="Vista previa" className="aspect-square rounded-xl object-cover" />)}</div>}</div>}
    </div><button disabled={saving} className="mt-5 w-full rounded-xl bg-yellow-400 px-4 py-3 font-bold text-zinc-950 disabled:opacity-50">{saving ? "Guardando…" : "Guardar registro"}</button></form></div>;
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={`text-sm ${wide ? "sm:col-span-2" : ""}`}>{label}<span className="mt-1 block [&_.input]:w-full [&_.input]:rounded-lg [&_.input]:border [&_.input]:border-zinc-700 [&_.input]:bg-zinc-950 [&_.input]:px-3 [&_.input]:py-2.5 [&_.input]:text-white [&_.input]:outline-none [&_.input]:focus:border-yellow-400">{children}</span></label>; }
