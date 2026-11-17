"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { TrainingRoutine } from "@/types/gestion";
import type { ClassNote } from "@/lib/group-class-planning";

type Occurrence = { id: string; date: string; startTime: string; endTime: string; classNameSnapshot: string; status: string; plannedRoutineId: string | null; plannedSnapshot: ClassNote | null; taughtSnapshot: ClassNote | null; taughtAt: string | null };
type Block = { key: string; name: string; text: string };
const suggestions = ["Movilidad", "Activación", "Fuerza", "Potencia", "Circuito", "Juego final", "Observaciones"];
const emptyBlock = (name = "Bloque nuevo"): Block => ({ key: crypto.randomUUID(), name, text: "" });
const argentinaToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
function weekStart(value: string) { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7); return date.toISOString().slice(0, 10); }
function addDays(value: string, count: number) { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + count); return date.toISOString().slice(0, 10); }
function modality(routine: TrainingRoutine) { return routine.tags.find((tag) => tag.toLocaleLowerCase("es").startsWith("tipo de clase:"))?.slice(14).trim() || "Otra"; }
function noteFromRoutine(routine: TrainingRoutine): Block[] {
  const day = routine.days[0];
  const blocks = day?.blocks.map((block) => ({ key: crypto.randomUUID(), name: block.name, text: [block.instructions, ...block.exercises.map((exercise) => `${exercise.name}${exercise.sets ? ` · ${exercise.sets} series` : ""}${exercise.repetitions ? ` · ${exercise.repetitions} repeticiones` : ""}${exercise.observations ? ` · ${exercise.observations}` : ""}`)].filter(Boolean).join("\n") })) ?? [];
  if (day?.warmup) blocks.unshift(emptyBlock("Entrada en calor"));
  if (day?.warmup) blocks[0].text = day.warmup;
  if (day?.observations) blocks.push({ key: crypto.randomUUID(), name: "Observaciones", text: day.observations });
  return blocks;
}
function routinePayload(name: string, type: string, blocks: Block[], original?: TrainingRoutine | null) {
  return {
    name: name.trim() || "Clase sin título",
    kind: "template", status: "borrador", objective: "Clase grupal", level: "principiante",
    trainerNotificationsEnabled: false, description: "", startDate: "", durationWeeks: null,
    priorityMuscles: [], location: "", equipment: [], studentIds: [],
    tags: [`Tipo de clase: ${type.trim() || "Otra"}`, "Clase libre"],
    expectedUpdatedAt: original?.updatedAt,
    days: [{ dayNumber: 1, name: name.trim() || "Clase sin título", objective: "", warmup: "", observations: "", estimatedMinutes: null, exercises: [], blocks: blocks.map((block, index) => ({ type: "FREE", name: block.name.trim() || `Bloque ${index + 1}`, order: index + 1, rounds: null, durationSeconds: null, workSeconds: null, restSeconds: null, restBetweenRoundsSeconds: null, targetRounds: null, instructions: block.text, exercises: [] })) }],
  };
}

export function GroupClassPlanning() {
  const [tab, setTab] = useState<"week" | "library" | "editor">("week");
  const [week, setWeek] = useState(() => weekStart(argentinaToday()));
  const [routines, setRoutines] = useState<TrainingRoutine[]>([]);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("Funcional");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [editing, setEditing] = useState<TrainingRoutine | null>(null);
  const [source, setSource] = useState<TrainingRoutine | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Occurrence | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const loadLibrary = useCallback(async () => {
    const response = await fetch("/api/clases/biblioteca", { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudo cargar la biblioteca de clases.");
    const data = await response.json() as TrainingRoutine[];
    setRoutines(data.filter((item) => item.kind === "template" && item.days.length === 1 && item.status !== "archivada"));
  }, []);
  const loadWeek = useCallback(async () => {
    const response = await fetch(`/api/clases/planificacion?start=${week}`, { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudo cargar la semana.");
    setOccurrences(await response.json() as Occurrence[]);
  }, [week]);
  useEffect(() => { void Promise.resolve().then(() => Promise.all([loadLibrary(), loadWeek()])).catch((value: unknown) => setError(value instanceof Error ? value.message : "No se pudo cargar la planificación.")); }, [loadLibrary, loadWeek]);
  const filtered = useMemo(() => routines.filter((item) => (!query || item.name.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es"))) && (!typeFilter || modality(item) === typeFilter) && (!dateFilter || occurrences.some((occurrence) => occurrence.date === dateFilter && occurrence.plannedRoutineId === item.id))), [routines, query, typeFilter, dateFilter, occurrences]);
  const types = [...new Set(["Funcional", "GAP", "Kids", ...routines.map(modality)])];
  const days = Array.from({ length: 7 }, (_, index) => addDays(week, index));

  function startEditor(routine?: TrainingRoutine, variant = false) {
    setEditing(routine && !variant && routine.tags.includes("Clase libre") ? routine : null);
    setSource(variant ? routine ?? null : null);
    setName(routine ? variant ? `${routine.name} (variante)` : routine.name : "");
    setType(routine ? modality(routine) : "Funcional");
    setBlocks(routine ? noteFromRoutine(routine) : [emptyBlock("Movilidad"), emptyBlock("Activación")]);
    setError(""); setNotice(""); setTab("editor");
  }
  async function save() {
    setBusy(true); setError("");
    try {
      const response = await fetch(editing ? `/api/rutinas/${editing.id}` : "/api/rutinas", { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(routinePayload(name, type, blocks, editing)) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "No se pudo guardar la clase.");
      await loadLibrary(); setEditing(null); setSource(null); setTab("library"); setNotice("Clase guardada en la biblioteca.");
    } catch (value) { setError(value instanceof Error ? value.message : "No se pudo guardar."); } finally { setBusy(false); }
  }
  async function changeOccurrence(occurrence: Occurrence, action: "assign" | "taught", routineId?: string | null) {
    if (action === "taught" && !window.confirm("¿Confirmás que esta clase se dictó realmente? Se guardará una copia para el historial.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/clases/planificacion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ occurrenceId: occurrence.id, action, routineId, confirmed: action === "taught" }) });
      const body = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(body.error || "No se pudo guardar.");
      setNotice(body.message || "Guardado."); await loadWeek(); setSelected(null);
    } catch (value) { setError(value instanceof Error ? value.message : "No se pudo guardar."); } finally { setBusy(false); }
  }
  function move(index: number, direction: number) { const next = [...blocks]; const target = index + direction; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; setBlocks(next); }
  function updateBlock(key: string, field: "name" | "text", value: string) { setBlocks((current) => current.map((block) => block.key === key ? { ...block, [field]: value } : block)); }

  return <section className="mb-7 rounded-2xl border border-zinc-800 bg-zinc-900/85 p-3 text-zinc-100 sm:p-5" aria-label="Planificación semanal de clases">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-yellow-400">Gestión de clases</p><h2 className="mt-1 text-xl font-bold">Planificación semanal</h2></div><button onClick={() => startEditor()} className="min-h-11 rounded-xl bg-yellow-400 px-4 text-sm font-bold text-zinc-950">+ Crear clase</button></div>
    <nav aria-label="Planificación de clases" className="mt-4 flex gap-2 overflow-x-auto border-b border-zinc-700 pb-3">{([ ["week", "Mi semana"], ["library", "Biblioteca de clases"] ] as const).map(([key, label]) => <button key={key} onClick={() => setTab(key)} className={`min-h-10 shrink-0 rounded-lg px-3 text-sm font-semibold ${tab === key ? "bg-yellow-400/15 text-yellow-300" : "text-zinc-400"}`}>{label}</button>)}</nav>
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
    {notice && <p role="status" className="mt-3 rounded-lg bg-emerald-400/10 p-3 text-sm text-emerald-200">{notice}</p>}
    {tab === "week" && <div className="mt-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex gap-2"><button aria-label="Semana anterior" onClick={() => setWeek(addDays(week, -7))} className="min-h-10 rounded-lg border border-zinc-700 px-3">←</button><button aria-label="Semana siguiente" onClick={() => setWeek(addDays(week, 7))} className="min-h-10 rounded-lg border border-zinc-700 px-3">→</button></div><span className="text-sm text-zinc-300">{week} al {addDays(week, 6)}</span><button onClick={() => setShowHistory((value) => !value)} className="min-h-10 text-sm text-yellow-300">{showHistory ? "Ocultar historial" : "Ver historial"}</button></div>
      <div className="mt-3 grid gap-2 lg:grid-cols-7">{days.map((day) => <div key={day} className="min-w-0 rounded-xl border border-zinc-700 bg-zinc-950/60 p-2"><h3 className="mb-2 text-sm font-bold text-yellow-200">{new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`))}</h3>{occurrences.filter((item) => item.date === day && (!showHistory || item.taughtAt)).map((item) => <button key={item.id} onClick={() => setSelected(item)} className="mb-2 block min-h-12 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-left text-xs"><span className="font-semibold">{item.startTime} · {item.classNameSnapshot}</span><span className={`mt-1 block ${item.taughtAt ? "text-emerald-300" : item.status === "CANCELLED" ? "text-red-300" : "text-zinc-400"}`}>{item.taughtAt ? `Dictada: ${item.taughtSnapshot?.name ?? "Clase"}` : item.status === "CANCELLED" ? "Cancelada" : item.plannedSnapshot ? `Planificada: ${item.plannedSnapshot.name}` : "Sin planificación"}</span></button>)}{!occurrences.some((item) => item.date === day && (!showHistory || item.taughtAt)) && <p className="text-xs text-zinc-500">{showHistory ? "Sin clases dictadas" : "Sin horarios"}</p>}</div>)}</div></div>}
    {tab === "library" && <div className="mt-4"><div className="grid gap-2 sm:grid-cols-3"><input aria-label="Buscar clase por nombre" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre" className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3"/><select aria-label="Filtrar por modalidad" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3"><option value="">Todas las modalidades</option>{types.map((item) => <option key={item}>{item}</option>)}</select><input type="date" aria-label="Filtrar por fecha planificada de esta semana" value={dateFilter} min={week} max={addDays(week, 6)} onChange={(event) => setDateFilter(event.target.value)} className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3"/></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((item) => <article key={item.id} className="rounded-xl border border-zinc-700 bg-zinc-950/70 p-3"><p className="text-xs text-yellow-300">{modality(item)} · {item.status === "borrador" ? "Borrador" : "Guardada"}</p><h3 className="mt-1 font-semibold">{item.name}</h3><p className="mt-1 text-xs text-zinc-400">{item.days[0]?.blocks.length ?? 0} bloques</p><div className="mt-3 flex flex-wrap gap-2"><button onClick={() => startEditor(item, !item.tags.includes("Clase libre"))} className="min-h-10 rounded-lg border border-zinc-700 px-3 text-xs">{item.tags.includes("Clase libre") ? "Editar" : "Usar como base"}</button><button onClick={() => startEditor(item, true)} className="min-h-10 rounded-lg border border-zinc-700 px-3 text-xs text-yellow-300">Crear variante</button></div></article>)}</div>{!filtered.length && <p className="mt-4 text-sm text-zinc-400">No se encontraron clases guardadas.</p>}</div>}
    {tab === "editor" && <div className="mt-4 max-w-3xl"><p className="mb-3 text-sm text-zinc-400">{editing ? "Editar borrador" : source ? `Variante independiente de ${source.name}` : "Nueva clase"}</p><div className="grid gap-2 sm:grid-cols-2"><label className="text-sm">Nombre de la clase<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="Clase sin título" className="mt-1 min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3"/></label><label className="text-sm">Modalidad<input list="group-class-modalities" value={type} onChange={(event) => setType(event.target.value)} maxLength={65} className="mt-1 min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3"/><datalist id="group-class-modalities">{types.map((item) => <option key={item} value={item}/>)}</datalist></label></div><div className="mt-4 space-y-2">{blocks.map((block, index) => <article key={block.key} className="rounded-xl border border-zinc-700 bg-zinc-950/70 p-3"><div className="flex gap-2"><input aria-label={`Nombre del bloque ${index + 1}`} value={block.name} onChange={(event) => updateBlock(block.key, "name", event.target.value)} maxLength={120} className="min-h-10 min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2 font-semibold"/><button aria-label={`Subir bloque ${index + 1}`} onClick={() => move(index, -1)} disabled={index === 0} className="min-h-10 min-w-10 disabled:opacity-30">↑</button><button aria-label={`Bajar bloque ${index + 1}`} onClick={() => move(index, 1)} disabled={index === blocks.length - 1} className="min-h-10 min-w-10 disabled:opacity-30">↓</button><button aria-label={`Quitar bloque ${index + 1}`} onClick={() => setBlocks((current) => current.filter((item) => item.key !== block.key))} className="min-h-10 min-w-10 text-red-300">×</button></div><textarea aria-label={`Contenido de ${block.name}`} value={block.text} onChange={(event) => updateBlock(block.key, "text", event.target.value)} maxLength={2000} rows={4} placeholder="Escribí libremente tu clase…" className="mt-2 w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-sm"/></article>)}</div><div className="mt-3 flex flex-wrap gap-2"><select aria-label="Tipo de bloque para agregar" id="new-class-block" className="min-h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3">{suggestions.map((item) => <option key={item}>{item}</option>)}</select><button onClick={() => setBlocks((current) => [...current, emptyBlock((document.getElementById("new-class-block") as HTMLSelectElement)?.value || "Bloque nuevo")])} className="min-h-11 rounded-lg border border-yellow-400/40 px-3 text-sm text-yellow-300">+ Agregar bloque</button></div><div className="mt-5 flex justify-end gap-2 border-t border-zinc-700 pt-3"><button onClick={() => setTab("library")} className="min-h-11 rounded-lg border border-zinc-700 px-4">Salir</button><button disabled={busy} onClick={() => void save()} className="min-h-11 rounded-lg bg-yellow-400 px-4 font-bold text-zinc-950 disabled:opacity-50">{busy ? "Guardando…" : "Guardar borrador"}</button></div></div>}
    {selected && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-3" onClick={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><div role="dialog" aria-modal="true" aria-label="Planificación de clase" className="mx-auto my-8 max-w-xl rounded-2xl border border-zinc-700 bg-zinc-900 p-4"><div className="flex justify-between gap-2"><div><p className="text-xs text-yellow-300">{selected.date} · {selected.startTime}</p><h3 className="text-lg font-bold">{selected.classNameSnapshot}</h3></div><button aria-label="Cerrar planificación" onClick={() => setSelected(null)} className="min-h-11 min-w-11">×</button></div><p className="mt-2 text-sm text-zinc-400">{selected.taughtAt ? "Dictada" : selected.status === "CANCELLED" ? "Cancelada" : selected.plannedSnapshot ? "Planificada" : "Sin planificación"}</p>{!selected.taughtAt && selected.status !== "CANCELLED" && <div className="mt-3"><label className="text-sm">Clase de la biblioteca<select aria-label="Asignar clase guardada" value={selected.plannedRoutineId || ""} disabled={busy} onChange={(event) => void changeOccurrence(selected, "assign", event.target.value || null)} className="mt-1 min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3"><option value="">Sin planificación</option>{routines.map((item) => <option key={item.id} value={item.id}>{modality(item)} · {item.name}</option>)}</select></label></div>}{(selected.taughtSnapshot || selected.plannedSnapshot) && <div className="mt-4 space-y-2"><p className="font-semibold">{(selected.taughtSnapshot || selected.plannedSnapshot)?.name}</p>{(selected.taughtSnapshot || selected.plannedSnapshot)?.blocks.map((block, index) => <div key={index} className="rounded-lg bg-zinc-950 p-3"><p className="text-sm font-bold text-yellow-200">{block.name}</p><p className="mt-1 whitespace-pre-wrap text-sm">{block.text || "Sin notas"}</p></div>)}</div>}{selected.plannedSnapshot && !selected.taughtAt && selected.status !== "CANCELLED" && <button disabled={busy} onClick={() => void changeOccurrence(selected, "taught")} className="mt-4 min-h-11 w-full rounded-lg bg-yellow-400 px-3 font-bold text-zinc-950 disabled:opacity-50">Confirmar que se dictó</button>}</div></div>}
  </section>;
}
