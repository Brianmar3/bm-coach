"use client";
/* eslint-disable @next/next/no-img-element -- Blob URLs are validated uploads */

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { QuickLog, QuickLogType } from "@/types/quick-log";

const labels: Record<QuickLogType, { title: string; icon: string }> = {
  WORKOUT: { title: "Entrenamiento", icon: "✓" },
  NOTE: { title: "Nota", icon: "▤" },
  PROGRESS: { title: "Progreso", icon: "↗" },
  PHOTO: { title: "Foto", icon: "▣" },
};
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());

export function QuickLogLauncher() {
  const [type, setType] = useState<QuickLogType | null>(null);
  return <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3"><h2 className="text-xs font-bold uppercase tracking-[.16em] text-yellow-400">Registro rápido</h2><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{(Object.keys(labels) as QuickLogType[]).map((value) => <button key={value} onClick={() => setType(value)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-3 py-2 text-sm font-semibold text-zinc-200"><span className="text-yellow-400">{labels[value].icon}</span>{labels[value].title}</button>)}</div>{type && <QuickLogForm type={type} close={() => setType(null)} saved={() => setType(null)} />}</section>;
}

export function QuickNoteButton() {
  const [open, setOpen] = useState(false);
  return <>{<button onClick={() => setOpen(true)} aria-label="Crear nota rápida" className="fixed bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] right-4 z-30 grid h-12 w-12 place-items-center rounded-full bg-yellow-400 text-lg font-black text-zinc-950 shadow-[0_8px_24px_rgba(0,0,0,.55),0_0_16px_rgba(250,204,21,.18)] transition hover:bg-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-200 md:bottom-6 md:right-6 md:h-auto md:w-auto md:grid-flow-col md:gap-2 md:px-4 md:py-2.5 md:text-sm"><span aria-hidden="true">✎</span><span className="hidden md:inline">Nota rápida</span></button>}{open && <QuickLogForm type="NOTE" close={() => setOpen(false)} saved={() => setOpen(false)} />}</>;
}

export function QuickLogHistory() {
  const [logs, setLogs] = useState<QuickLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [type, setType] = useState<QuickLogType | "">("");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [creating, setCreating] = useState<QuickLogType | null>(null);
  const [editing, setEditing] = useState<QuickLog | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    const params = new URLSearchParams(); if (type) params.set("type", type); if (query.trim()) params.set("query", query.trim()); if (from) params.set("from", from); if (to) params.set("to", to);
    try { const response = await fetch(`/api/portal/quick-logs?${params}`, { cache: "no-store" }); const body = await response.json() as { logs?: QuickLog[]; error?: string }; if (!response.ok) throw new Error(body.error); setLogs(body.logs ?? []); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudieron cargar los registros."); }
    finally { setLoading(false); }
  }, [from, query, to, type]);
  useEffect(() => { const timeout = window.setTimeout(load, 250); return () => window.clearTimeout(timeout); }, [load]);
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
  return <div><header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-yellow-400">Registro personal</p><h1 className="mt-1 text-2xl font-bold">Mis registros</h1><p className="mt-1 text-sm text-zinc-500">Tus notas, entrenamientos, progresos y fotos, en orden cronológico.</p></div><button onClick={() => setCreating("NOTE")} className="rounded-xl bg-yellow-400 px-4 py-2.5 text-sm font-bold text-zinc-950">+ Nueva nota</button></header>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}{notice && <p role="status" className="mt-4 rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-200">{notice}</p>}
    <section className="mt-4 grid gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-3 sm:grid-cols-2 lg:grid-cols-4"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en mis registros" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-yellow-400" /><select value={type} onChange={(event) => setType(event.target.value as QuickLogType | "")} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"><option value="">Todos</option>{(Object.keys(labels) as QuickLogType[]).map((value) => <option key={value} value={value}>{labels[value].title}</option>)}</select><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="Desde" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" /><input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="Hasta" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" /></section>
    <div className="mt-4 space-y-3">{loading ? <p className="rounded-xl bg-zinc-900 p-8 text-center text-zinc-500">Cargando registros…</p> : logs.length ? logs.map((log) => <QuickLogCard key={log.id} log={log} edit={() => setEditing(log)} remove={() => remove(log)} removePhoto={(photoId) => removePhoto(log, photoId)} />) : <p className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-zinc-500">Todavía no hay registros personales.</p>}</div>
    {creating && <QuickLogForm type={creating} close={() => setCreating(null)} saved={async () => { setCreating(null); setNotice("Registro guardado correctamente."); await load(); }} />}
    {editing && <QuickLogForm type={editing.type} initial={editing} close={() => setEditing(null)} saved={async () => { setEditing(null); setNotice("Registro actualizado correctamente."); await load(); }} />}
  </div>;
}

function QuickLogCard({ log, edit, remove, removePhoto }: { log: QuickLog; edit: () => void; remove: () => void; removePhoto: (photoId: string) => void }) {
  const summary = log.content || (log.type === "PROGRESS" ? `${log.exerciseName}: ${log.previousValue ?? "Sin valor anterior"} → ${log.currentValue} ${log.unit}` : log.category);
  const createdAt = new Date(log.createdAt);
  const time = Number.isNaN(createdAt.getTime()) ? "" : createdAt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  return <article className="min-w-0 overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-[#0c0c0c] p-4 shadow-[0_10px_28px_rgba(0,0,0,.2)]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-yellow-400">{labels[log.type].icon} {labels[log.type].title}</p><h2 className="mt-1 break-words font-bold">{log.title || labels[log.type].title}</h2><p className="mt-1 text-xs text-zinc-500">{new Date(`${log.date}T12:00:00`).toLocaleDateString("es-AR")}{time ? ` · ${time}` : ""}{log.category ? ` · ${log.category}` : ""}</p></div><div className="flex shrink-0 gap-3 text-xs"><button onClick={edit} className="text-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-300">Editar</button><button onClick={remove} className="text-red-300 focus:outline-none focus:ring-2 focus:ring-red-300">Eliminar</button></div></div>{summary && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-zinc-300">{summary}</p>}{log.mood && <p className="mt-2 text-xs text-zinc-500">Sensación: {log.mood}</p>}{log.hasPain && <p className="mt-2 rounded-lg bg-red-400/10 p-2 text-xs text-red-200">Molestia: {log.painDetails || "Sin detalle"}</p>}{log.photos.length > 0 && <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{log.photos.map((photo) => <div key={photo.id} className="relative min-w-0 overflow-hidden rounded-xl bg-black"><a href={photo.blobUrl} target="_blank" rel="noreferrer" aria-label="Abrir fotografía en tamaño completo" className="group block focus:outline-none focus:ring-2 focus:ring-yellow-300"><img src={photo.blobUrl} alt="Foto adjunta al registro" loading="lazy" className="aspect-square w-full object-cover transition group-hover:opacity-80" /><span className="absolute inset-x-1 bottom-1 rounded bg-black/75 px-2 py-1 text-center text-[10px] text-zinc-200">Ver completa</span></a><button onClick={() => removePhoto(photo.id)} aria-label="Eliminar foto" className="absolute right-1 top-1 rounded-full bg-black/85 px-2 py-1 text-xs text-red-200 focus:outline-none focus:ring-2 focus:ring-red-300">×</button></div>)}</div>}</article>;
}

function QuickLogForm({ type, initial, close, saved }: { type: QuickLogType; initial?: QuickLog; close: () => void; saved: () => void | Promise<void> }) {
  const [form, setForm] = useState({ title: initial?.title ?? "", content: initial?.content ?? "", category: initial?.category ?? "", date: initial?.date ?? today(), durationMinutes: initial?.durationMinutes?.toString() ?? "", exerciseName: initial?.exerciseName ?? "", metricType: initial?.metricType ?? "peso", previousValue: initial?.previousValue?.toString() ?? "", currentValue: initial?.currentValue?.toString() ?? "", unit: initial?.unit ?? "kg", mood: initial?.mood ?? "", hasPain: initial?.hasPain ?? false, painDetails: initial?.painDetails ?? "" });
  const [files, setFiles] = useState<File[]>([]); const [error, setError] = useState(""); const [saving, setSaving] = useState(false); const fileInput = useRef<HTMLInputElement>(null);
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);
  const set = (key: keyof typeof form, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = initial ? await fetch(`/api/portal/quick-logs/${initial.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, type }) }) : await fetch("/api/portal/quick-logs", { method: "POST", body: (() => { const body = new FormData(); body.set("type", type); Object.entries(form).forEach(([key, value]) => body.set(key, String(value))); files.forEach((file) => body.append("photos", file)); return body; })() });
      const body = await response.json() as { error?: string }; if (!response.ok) throw new Error(body.error ?? "No se pudo guardar."); await saved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar."); } finally { setSaving(false); }
  }
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 p-2 sm:p-5" onMouseDown={(event) => event.target === event.currentTarget && close()}><form onSubmit={submit} className="mx-auto my-2 w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:my-8 sm:p-5"><div className="flex justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-yellow-400">Registro rápido</p><h2 className="mt-1 text-xl font-bold">{initial ? "Editar" : "Nuevo"} {labels[type].title.toLowerCase()}</h2></div><button type="button" onClick={close} disabled={saving} className="text-sm text-zinc-400">Cerrar</button></div>{error && <p role="alert" className="mt-3 rounded-lg bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}<div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Título opcional"><input value={form.title} onChange={(event) => set("title", event.target.value)} maxLength={120} className="input" /></Field><Field label="Fecha"><input required type="date" value={form.date} onChange={(event) => set("date", event.target.value)} className="input" /></Field>
      {type === "WORKOUT" && <><Field label="Tipo de entrenamiento"><input value={form.category} onChange={(event) => set("category", event.target.value)} placeholder="Fuerza, movilidad…" className="input" /></Field><Field label="Duración (min)"><input type="number" min="1" max="1440" inputMode="numeric" value={form.durationMinutes} onChange={(event) => set("durationMinutes", event.target.value)} className="input" /></Field></>}
      {type === "NOTE" && <Field label="Categoría"><select value={form.category} onChange={(event) => set("category", event.target.value)} className="input"><option value="">Sin categoría</option>{["técnica", "energía", "molestia", "alimentación", "descanso", "recordatorio", "general"].map((item) => <option key={item}>{item}</option>)}</select></Field>}
      {type === "PROGRESS" && <><Field label="Ejercicio"><input required value={form.exerciseName} onChange={(event) => set("exerciseName", event.target.value)} className="input" /></Field><Field label="Tipo de progreso"><select value={form.metricType} onChange={(event) => set("metricType", event.target.value)} className="input">{["peso", "repeticiones", "series", "tiempo", "distancia", "técnica", "percepción personal"].map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Valor anterior opcional"><input type="number" min="0" step="any" inputMode="decimal" value={form.previousValue} onChange={(event) => set("previousValue", event.target.value)} className="input" /></Field><Field label="Nuevo valor"><input required type="number" min="0" step="any" inputMode="decimal" value={form.currentValue} onChange={(event) => set("currentValue", event.target.value)} className="input" /></Field><Field label="Unidad"><input value={form.unit} onChange={(event) => set("unit", event.target.value)} className="input" /></Field></>}
      {type === "PHOTO" && <Field label="Categoría"><select value={form.category} onChange={(event) => set("category", event.target.value)} className="input">{["progreso físico", "técnica", "ejercicio", "clase", "postura", "otra"].map((item) => <option key={item}>{item}</option>)}</select></Field>}
      <Field label={type === "WORKOUT" ? "Ejercicios y comentario" : "Comentario"} wide><textarea required={type === "NOTE"} value={form.content} onChange={(event) => set("content", event.target.value)} maxLength={5000} rows={4} className="input resize-y" /></Field><Field label="Sensación general"><select value={form.mood} onChange={(event) => set("mood", event.target.value)} className="input"><option value="">Sin indicar</option>{["Muy buena", "Buena", "Normal", "Difícil", "Muy difícil"].map((item) => <option key={item}>{item}</option>)}</select></Field><label className="flex min-h-11 items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm"><input type="checkbox" checked={form.hasPain} onChange={(event) => set("hasPain", event.target.checked)} className="accent-yellow-400" /> Dolor o molestias</label>{form.hasPain && <Field label="Detalle de la molestia" wide><textarea value={form.painDetails} onChange={(event) => set("painDetails", event.target.value)} maxLength={1000} rows={2} className="input" /></Field>}
      {!initial && <div className="sm:col-span-2"><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 4))} className="sr-only" /><button type="button" onClick={() => fileInput.current?.click()} className={`rounded-lg px-3 py-2 text-sm text-yellow-300 ${type === "PHOTO" ? "border border-dashed border-yellow-400/40" : "border border-zinc-700"}`}>{type === "PHOTO" ? "Tomar o elegir hasta 4 fotos" : "Adjuntar foto opcional"}</button>{previews.length > 0 && <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{previews.map((preview) => <img key={preview} src={preview} alt="Vista previa" className="aspect-square rounded-xl object-cover" />)}</div>}</div>}
    </div><button disabled={saving} className="mt-5 w-full rounded-xl bg-yellow-400 px-4 py-3 font-bold text-zinc-950 disabled:opacity-50">{saving ? "Guardando…" : "Guardar registro"}</button></form></div>;
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={`text-sm ${wide ? "sm:col-span-2" : ""}`}>{label}<span className="mt-1 block [&_.input]:w-full [&_.input]:rounded-lg [&_.input]:border [&_.input]:border-zinc-700 [&_.input]:bg-zinc-950 [&_.input]:px-3 [&_.input]:py-2.5 [&_.input]:text-white [&_.input]:outline-none [&_.input]:focus:border-yellow-400">{children}</span></label>; }
