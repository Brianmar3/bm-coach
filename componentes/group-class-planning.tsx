"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TrainingRoutine } from "@/types/gestion";
import type { ClassNote } from "@/lib/group-class-planning";
import { classRichPlainText } from "@/lib/class-rich-text";
import { ClassNotesEditor, ClassNotesView } from "@/componentes/class-notes-editor";
import RutinasPage from "@/app/rutinas/page";
import { useGroupClassDraft, type ClassDraftContent } from "@/componentes/use-group-class-draft";
import { useTouchClassCopy } from "@/componentes/use-touch-class-copy";

type Occurrence = { id: string; date: string; startTime: string; classNameSnapshot: string; status: string; taughtAt: string | null; taughtSnapshot: ClassNote | null };
type Plan = { id: string; date: string; routineId: string | null; occurrenceId: string | null; snapshot: ClassNote; occurrence: Occurrence | null };
type Recent = { id: string; date: string; snapshot: ClassNote };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
function addDays(value: string, count: number) { const date = new Date(value + "T12:00:00Z"); date.setUTCDate(date.getUTCDate() + count); return date.toISOString().slice(0, 10); }
function weekStart(value: string) { return addDays(value, -((new Date(value + "T12:00:00Z").getUTCDay() + 6) % 7)); }
function dateLabel(value: string) { return new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(value + "T12:00:00Z")); }
function modality(routine: TrainingRoutine) { return routine.tags.find((tag) => tag.toLocaleLowerCase("es").startsWith("tipo de clase:"))?.slice(14).trim() || "Otra"; }
function routineText(routine: TrainingRoutine) {
  const day = routine.days[0];
  if (routine.tags.includes("Clase libre") && day?.blocks.every((block) => block.name === "Clase")) return [...day.blocks].sort((a, b) => a.order - b.order).map((block) => block.instructions).join("");
  return [day?.warmup && "Entrada en calor:\n" + day.warmup, ...(day?.blocks ?? []).map((block) => block.name + ":\n" + [block.instructions, ...block.exercises.map((exercise) => exercise.name + (exercise.sets ? " · " + exercise.sets + " series" : "") + (exercise.repetitions ? " · " + exercise.repetitions + " repeticiones" : "") + (exercise.observations ? " · " + exercise.observations : ""))].filter(Boolean).join("\n")), day?.observations && "Observaciones:\n" + day.observations].filter(Boolean).join("\n\n");
}
function noteText(note: ClassNote) { return note.blocks.every((block) => block.name === "Clase") ? note.blocks.map((block) => block.text).join("") : note.blocks.map((block) => block.name + ":\n" + block.text).join("\n\n"); }
function makeNote(name: string, modality: string, text: string): ClassNote { return { name: name.trim() || "Clase sin título", modality: modality.trim() || "Otra", blocks: [{ name: "Clase", text }] }; }
function routinePayload(name: string, modality: string, text: string, original?: TrainingRoutine | null) {
  const chunks = text.match(/[\s\S]{1,2000}/g) ?? [""];
  return { name: name.trim() || "Clase sin título", kind: "template", status: "borrador", objective: "Clase grupal", level: "principiante", trainerNotificationsEnabled: false, description: "", startDate: "", durationWeeks: null, priorityMuscles: [], location: "", equipment: [], studentIds: [], tags: ["Tipo de clase: " + (modality.trim() || "Otra"), "Clase libre"], expectedUpdatedAt: original?.updatedAt, days: [{ dayNumber: 1, name: name.trim() || "Clase sin título", objective: "", warmup: "", observations: "", estimatedMinutes: null, exercises: [], blocks: chunks.map((chunk, index) => ({ type: "FREE", name: "Clase", order: index + 1, rounds: null, durationSeconds: null, workSeconds: null, restSeconds: null, restBetweenRoundsSeconds: null, targetRounds: null, instructions: chunk, exercises: [] })) }] };
}
async function request(path: string, method: string, body: object) {
  const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json() as { id?: string; error?: string };
  if (!response.ok) throw new Error(data.error || "No se pudo guardar.");
  return data;
}

export function GroupClassPlanning() {
  const [view, setView] = useState<"week" | "library" | "editor">("week");
  const [week, setWeek] = useState(() => weekStart(today()));
  const [plans, setPlans] = useState<Plan[]>([]);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [routines, setRoutines] = useState<TrainingRoutine[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [picker, setPicker] = useState<"actions" | "library" | "previous">("actions");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const selectedPlanDialogRef = useRef<HTMLDivElement>(null);
  const lastDropRef = useRef<{ id: string; date: string; at: number } | null>(null);
  const touchCopy = useTouchClassCopy((id, date, at) => copyOnDrop(id, date, at));
  const [transfer, setTransfer] = useState<{ id: string; action: "move" | "copy"; date: string } | null>(null);
  const [editorDate, setEditorDate] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [editingRoutine, setEditingRoutine] = useState<TrainingRoutine | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("Funcional");
  const [text, setText] = useState("");
  const [draftKey, setDraftKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [history, setHistory] = useState(false);
  const [completeClassesOpen, setCompleteClassesOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const hydrateDraft = useCallback((draft: ClassDraftContent) => { setName(draft.name); setType(draft.modality); setText(draft.text); }, []);
  const draftContent = useMemo(() => ({ name, modality: type, text }), [name, type, text]);
  const { ready: draftReady, status: draftStatus, clearSavedDraft } = useGroupClassDraft(draftKey, draftContent, hydrateDraft, busy);
  useEffect(() => { if (new URLSearchParams(window.location.search).get("clases") === "completas") queueMicrotask(() => setCompleteClassesOpen(true)); }, []);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(week, index)), [week]);
  useEffect(() => {
    if (!selectedPlan || view === "editor") return;
    selectedPlanDialogRef.current?.focus();
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || selectedDate || transfer || !selectedPlanDialogRef.current?.contains(document.activeElement)) return;
      event.preventDefault();
      setSelectedPlan(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [selectedPlan, selectedDate, transfer, view]);
  const load = useCallback(async () => {
    const [planResponse, libraryResponse] = await Promise.all([fetch("/api/clases/planes?start=" + week, { cache: "no-store" }), fetch("/api/clases/biblioteca", { cache: "no-store" })]);
    if (!planResponse.ok || !libraryResponse.ok) throw new Error("No se pudo cargar la planificación.");
    const data = await planResponse.json() as { plans: Plan[]; occurrences: Occurrence[]; recent: Recent[] };
    setPlans(data.plans); setOccurrences(data.occurrences); setRecent(data.recent);
    setRoutines((await libraryResponse.json() as TrainingRoutine[]).filter((item) => item.kind === "template" && item.days.length === 1 && item.status !== "archivada"));
  }, [week]);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) void load().catch((value: unknown) => { if (active) setError(value instanceof Error ? value.message : "No se pudo cargar."); }); }); return () => { active = false; }; }, [load]);
  const modalities = [...new Set(["Funcional", "GAP", "Kids", ...routines.map(modality)])];
  const filtered = routines.filter((item) => (!search || item.name.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"))) && (!filter || modality(item) === filter));
  const previous = [...plans.filter((item) => selectedDate && item.date < selectedDate), ...recent.filter((item) => selectedDate && item.date < selectedDate)].sort((a, b) => b.date.localeCompare(a.date));
  function beginEditor(date: string | null = null, plan?: Plan, routine?: TrainingRoutine, variant = false) {
    setDraftKey(plan ? `${variant ? "variant" : "plan"}:${plan.id}` : routine ? `${variant ? "variant" : "routine"}:${routine.id}` : `new:${date ?? "library"}`);
    setEditorDate(date); setEditingPlan(plan && !variant ? plan.id : null); setEditingRoutine(routine && !variant && routine.tags.includes("Clase libre") ? routine : null);
    setName(plan?.snapshot.name ?? routine?.name ?? ""); setType(plan?.snapshot.modality ?? (routine ? modality(routine) : "Funcional")); setText(plan ? noteText(plan.snapshot) : routine ? routineText(routine) : "");
    setSelectedDate(null); setSelectedPlan(null); setError(""); setView("editor");
  }
  async function run(action: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); await load(); } catch (value) { setError(value instanceof Error ? value.message : "No se pudo guardar."); } finally { setBusy(false); }
  }
  async function saveEditor() {
    if (classRichPlainText(text).length > 12000 || text.length > 36000) { setError("La clase supera el límite de 12.000 caracteres."); return; }
    await run(async () => {
      if (editingPlan) await request("/api/clases/planes", "PATCH", { id: editingPlan, snapshot: makeNote(name, type, text) });
      else {
        const saved = await request(editingRoutine ? "/api/rutinas/" + editingRoutine.id : "/api/rutinas", editingRoutine ? "PUT" : "POST", routinePayload(name, type, text, editingRoutine));
        if (editorDate) await request("/api/clases/planes", "POST", { date: editorDate, routineId: saved.id });
      }
      let cleanupFailed = false;
      try { await clearSavedDraft(); } catch { cleanupFailed = true; }
      setDraftKey(null);
      setView(editorDate ? "week" : "library"); setNotice(cleanupFailed ? "Clase guardada. El borrador automático no pudo retirarse." : "Clase guardada."); setEditingPlan(null); setEditingRoutine(null);
    });
  }
  async function addFromLibrary(id: string) { if (!selectedDate) return; const date = selectedDate; await run(async () => { await request("/api/clases/planes", "POST", { date, routineId: id }); setSelectedDate(null); setNotice("Clase agregada."); }); }
  async function copyPlan(id: string, date: string) { await run(async () => { await request("/api/clases/planes", "POST", { sourcePlanId: id, date }); setSelectedDate(null); setTransfer(null); setNotice("Copia independiente creada."); }); }
  async function movePlan(id: string, date: string) { await run(async () => { await request("/api/clases/planes", "PATCH", { id, date }); setTransfer(null); setSelectedPlan(null); setNotice("Clase movida."); }); }
  function copyOnDrop(id: string, date: string, at: number) {
    const source = plans.find((plan) => plan.id === id);
    if (!source || source.occurrence?.taughtAt || source.date === date || busy) return;
    const last = lastDropRef.current;
    if (last?.id === id && last.date === date && at - last.at < 1200) return;
    lastDropRef.current = { id, date, at };
    void copyPlan(id, date);
  }
  async function deletePlan(plan: Plan) { if (!window.confirm("¿Eliminar esta planificación?")) return; await run(async () => { await request("/api/clases/planes", "DELETE", { id: plan.id }); setSelectedPlan(null); setNotice("Planificación eliminada."); }); }
  async function linkOccurrence(plan: Plan, occurrenceId: string | null) { await run(async () => { await request("/api/clases/planes", "PATCH", { id: plan.id, occurrenceId }); setSelectedPlan(null); setNotice(occurrenceId ? "Horario vinculado." : "Horario desvinculado."); }); }
  async function markTaught(plan: Plan) { if (!plan.occurrenceId || !window.confirm("¿Confirmás que esta clase se dictó realmente?")) return; await run(async () => { await request("/api/clases/planificacion", "POST", { occurrenceId: plan.occurrenceId, action: "taught", confirmed: true }); setSelectedPlan(null); setNotice("Clase registrada como dictada."); }); }
  function openAdd(date: string) { setSelectedDate(date); setPicker("actions"); setError(""); }
  const control = "min-h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3";
  return <section data-group-class-planning aria-label="Planificación semanal de clases" className="text-zinc-100">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div className="flex gap-2"><button onClick={() => { setDraftKey(null); setView("week"); }} className={view === "week" ? "min-h-11 rounded-xl bg-yellow-400/15 px-3 text-sm text-yellow-300" : "min-h-11 rounded-xl border border-zinc-700 px-3 text-sm"}>Mi semana</button><button onClick={() => { setDraftKey(null); setView("library"); }} className={view === "library" ? "min-h-11 rounded-xl bg-yellow-400/15 px-3 text-sm text-yellow-300" : "min-h-11 rounded-xl border border-zinc-700 px-3 text-sm"}>Biblioteca de clases</button></div><button onClick={() => beginEditor()} className="min-h-11 rounded-xl bg-yellow-400 px-4 text-sm font-bold text-zinc-950">+ Nueva clase</button></div>
    {error && <p role="alert" className="mb-3 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
    {notice && <p role="status" className="mb-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">{notice}</p>}
    {view === "week" && <div className="rounded-2xl border border-zinc-800 bg-zinc-900/85 p-3 sm:p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><button aria-label="Semana anterior" onClick={() => setWeek(addDays(week, -7))} className={control}>←</button><button aria-label="Semana siguiente" onClick={() => setWeek(addDays(week, 7))} className={control}>→</button><strong className="ml-1 text-sm">{dateLabel(week)} al {dateLabel(addDays(week, 6))}</strong></div><button onClick={() => setHistory((value) => !value)} className="min-h-10 text-sm text-yellow-300">{history ? "Ver planificadas" : "Ver dictadas"}</button></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">{days.map((day) => <div key={day} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }} data-plan-day={day} onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData("text/plain"); touchCopy.stopMouse(); if (id) copyOnDrop(id, day, event.timeStamp); }} className="min-w-0 rounded-xl border border-zinc-700 bg-zinc-950/65 p-2"><h2 className="mb-2 text-sm font-bold capitalize text-yellow-300">{dateLabel(day)}</h2><div className="space-y-2">{plans.filter((plan) => plan.date === day && (!history || plan.occurrence?.taughtAt)).map((plan) => <article key={plan.id} draggable={!plan.occurrence?.taughtAt} tabIndex={0} role="group" aria-label={`Abrir ${plan.snapshot.name}`} onDragStart={(event) => { if (touchCopy.isTouchPending()) { event.preventDefault(); return; } event.dataTransfer.setData("text/plain", plan.id); touchCopy.startMouse(event); }} onDragEnd={touchCopy.stopMouse} onTouchStart={(event) => { if (!plan.occurrence?.taughtAt) touchCopy.start(event, plan.id); }} onTouchMove={touchCopy.moveBeforeActivation} onTouchEnd={touchCopy.endBeforeActivation} onTouchCancel={touchCopy.endBeforeActivation} onContextMenu={(event) => { if (touchCopy.isTouchPending()) event.preventDefault(); }} onClick={(event) => { if (touchCopy.consumeClick()) { event.preventDefault(); return; } if ((event.target as HTMLElement).closest("button")) return; setSelectedPlan(plan); }} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setSelectedPlan(plan); } }} className="rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-xs"><p className="text-yellow-300">{plan.snapshot.modality}{plan.occurrence ? " · " + plan.occurrence.startTime : ""}</p><h3 className="mt-1 break-words font-semibold">{plan.snapshot.name}</h3><p className="mt-1 line-clamp-3 whitespace-pre-line text-zinc-400">{classRichPlainText(noteText(plan.snapshot))}</p><button onClick={() => setSelectedPlan(plan)} className="mt-2 min-h-9 w-full rounded-md border border-zinc-700 px-2 text-left text-yellow-200">{plan.occurrence?.taughtAt ? "Ver clase dictada" : "Editar · Copiar · Mover"}</button></article>)}{history && !plans.some((plan) => plan.date === day && plan.occurrence?.taughtAt) && <p className="text-xs text-zinc-500">Sin clases dictadas</p>}<button onClick={() => openAdd(day)} className="min-h-12 w-full rounded-lg border border-dashed border-yellow-400/40 px-2 py-2 text-xs font-semibold text-yellow-300">+ Agregar clase</button></div></div>)}</div></div>}
    {view === "library" && <div className="rounded-2xl border border-zinc-800 bg-zinc-900/85 p-3 sm:p-4"><div className="flex flex-wrap gap-2"><input aria-label="Buscar clase" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar clase" className={control + " min-w-0 flex-1"}/><select aria-label="Filtrar modalidad" value={filter} onChange={(event) => setFilter(event.target.value)} className={control}><option value="">Todas las modalidades</option>{modalities.map((item) => <option key={item}>{item}</option>)}</select></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((item) => <article key={item.id} className="rounded-xl border border-zinc-700 bg-zinc-950/60 p-3"><p className="text-xs text-yellow-300">{modality(item)} · {item.status === "borrador" ? "Borrador" : "Guardada"}</p><h3 className="mt-1 font-semibold">{item.name}</h3><p className="mt-2 line-clamp-3 whitespace-pre-line text-xs text-zinc-400">{classRichPlainText(routineText(item))}</p><div className="mt-3 flex flex-wrap gap-2"><button onClick={() => beginEditor(null, undefined, item)} className={control + " text-xs"}>{item.tags.includes("Clase libre") ? "Editar" : "Usar como base"}</button><button onClick={() => beginEditor(null, undefined, item, true)} className={control + " text-xs text-yellow-300"}>Crear variante</button></div></article>)}</div>{!filtered.length && <p className="mt-4 text-sm text-zinc-400">Todavía no hay clases guardadas.</p>}</div>}
    {view === "editor" && <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-3 text-[var(--foreground)] sm:p-5"><div className="mb-3 flex items-center justify-between gap-2"><button onClick={() => { setDraftKey(null); setView(editorDate ? "week" : "library"); }} className="min-h-10 text-sm text-[var(--foreground-muted)]">← Volver</button><span className="text-xs text-[var(--brand-text)]">{editorDate ? dateLabel(editorDate) : "Biblioteca"}</span></div><div className="grid gap-2 sm:grid-cols-2"><label className="text-sm">Nombre de la clase<input value={name} disabled={!draftReady || busy} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="Clase sin título" className={control + " class-note-meta-input mt-1 w-full"}/></label><label className="text-sm">Modalidad<input list="class-modalities" value={type} disabled={!draftReady || busy} onChange={(event) => setType(event.target.value)} maxLength={65} className={control + " class-note-meta-input mt-1 w-full"}/><datalist id="class-modalities">{modalities.map((item) => <option key={item} value={item}/>)}</datalist></label></div><div className="mt-3 text-sm"><p className="mb-1">Tu clase</p><ClassNotesEditor value={text} onChange={setText} disabled={!draftReady || busy} /></div><div className="mt-3 flex items-center justify-between gap-2"><span role="status" className="text-xs text-[var(--foreground-muted)]">{draftStatus === "loading" ? "Recuperando borrador…" : draftStatus === "unavailable" ? "Sin conexión: reconectá para recuperar el borrador" : draftStatus === "pending" ? "Cambios pendientes de sincronización" : draftStatus === "saved" ? "Borrador guardado" : ""}</span><button disabled={busy || !draftReady} onClick={() => void saveEditor()} className="min-h-11 rounded-xl bg-[var(--bm-accent)] px-5 font-bold text-[var(--bm-accent-contrast)] disabled:opacity-50">{busy ? "Guardando…" : "Guardar clase"}</button></div></div>}
    {selectedDate && <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3" onClick={(event) => { if (event.target === event.currentTarget) setSelectedDate(null); }}><div role="dialog" aria-modal="true" aria-label={"Agregar clase el " + dateLabel(selectedDate)} className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-yellow-400/30 bg-zinc-900 p-4"><div className="flex items-center justify-between"><h2 className="font-bold capitalize">{dateLabel(selectedDate)}</h2><button aria-label="Cerrar" onClick={() => setSelectedDate(null)} className="min-h-10 min-w-10">×</button></div>{picker !== "actions" && <button onClick={() => setPicker("actions")} className="my-2 min-h-10 text-sm text-yellow-300">← Opciones</button>}{picker === "actions" && <div className="mt-3 grid gap-2"><button onClick={() => beginEditor(selectedDate)} className={control + " text-left"}>Crear clase nueva →</button><button onClick={() => setPicker("library")} className={control + " text-left"}>Seleccionar de la biblioteca →</button><button onClick={() => setPicker("previous")} className={control + " text-left"}>Copiar planificación anterior →</button></div>}{picker === "library" && <div className="mt-2 grid gap-2">{routines.map((item) => <button key={item.id} disabled={busy} onClick={() => void addFromLibrary(item.id)} className={control + " text-left text-sm"}>{modality(item)} · {item.name}</button>)}{!routines.length && <p className="text-sm text-zinc-400">La biblioteca está vacía.</p>}</div>}{picker === "previous" && <div className="mt-2 grid gap-2">{previous.map((item) => <button key={item.id} disabled={busy} onClick={() => void copyPlan(item.id, selectedDate)} className={control + " text-left text-sm"}>{item.date} · {item.snapshot.modality} · {item.snapshot.name}</button>)}{!previous.length && <p className="text-sm text-zinc-400">Todavía no hay planificaciones anteriores.</p>}</div>}</div></div>}
    {selectedPlan && <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3" onClick={(event) => { if (event.target === event.currentTarget) setSelectedPlan(null); }}><div role="dialog" aria-modal="true" aria-label="Opciones de clase planificada" ref={selectedPlanDialogRef} tabIndex={-1} className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-yellow-400/30 bg-zinc-900 p-4"><div className="flex items-start justify-between gap-2"><div><p className="text-xs text-yellow-300">{selectedPlan.date} · {selectedPlan.snapshot.modality}</p><h2 className="font-bold">{selectedPlan.snapshot.name}</h2></div><button aria-label="Cerrar" onClick={() => setSelectedPlan(null)} className="min-h-10 min-w-10">×</button></div><ClassNotesView className="mt-3 break-words rounded-xl bg-[var(--surface)] p-3 text-sm" value={selectedPlan.occurrence?.taughtAt && selectedPlan.occurrence.taughtSnapshot ? noteText(selectedPlan.occurrence.taughtSnapshot) : noteText(selectedPlan.snapshot)} />{selectedPlan.occurrence?.taughtAt ? <p className="mt-3 text-sm text-emerald-300">Clase dictada: historial conservado.</p> : <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => beginEditor(selectedPlan.date, selectedPlan)} className={control}>Editar clase</button><button onClick={() => { setTransfer({ id: selectedPlan.id, action: "copy", date: selectedPlan.date }); setSelectedPlan(null); }} className={control}>Copiar a…</button><button onClick={() => { setTransfer({ id: selectedPlan.id, action: "move", date: selectedPlan.date }); setSelectedPlan(null); }} className={control}>Mover a…</button><button onClick={() => beginEditor(selectedPlan.date, selectedPlan, undefined, true)} className={control}>Crear variante</button><label className="col-span-2 text-xs text-zinc-400">Horario real (opcional)<select value={selectedPlan.occurrenceId ?? ""} disabled={busy} onChange={(event) => void linkOccurrence(selectedPlan, event.target.value || null)} className={control + " mt-1 w-full text-sm"}><option value="">Sin horario asociado</option>{occurrences.filter((item) => item.date === selectedPlan.date && item.status === "SCHEDULED" && !item.taughtAt && (!plans.some((plan) => plan.occurrenceId === item.id) || item.id === selectedPlan.occurrenceId)).map((item) => <option key={item.id} value={item.id}>{item.startTime} · {item.classNameSnapshot}</option>)}</select></label>{selectedPlan.occurrenceId && <button onClick={() => void markTaught(selectedPlan)} className="col-span-2 min-h-11 rounded-lg border border-emerald-400/40 text-emerald-300">Confirmar que se dictó</button>}<button onClick={() => void deletePlan(selectedPlan)} className="col-span-2 min-h-11 text-sm text-red-300">Eliminar planificación</button></div>}</div></div>}
    {transfer && <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3" onClick={(event) => { if (event.target === event.currentTarget) setTransfer(null); }}><div role="dialog" aria-modal="true" aria-label={transfer.action === "move" ? "Mover clase" : "Copiar clase"} className="w-full max-w-sm rounded-2xl border border-yellow-400/30 bg-zinc-900 p-4"><h2 className="font-bold">{transfer.action === "move" ? "Mover a…" : "Copiar a…"}</h2><label className="mt-3 block text-sm">Fecha de destino<input type="date" value={transfer.date} onChange={(event) => setTransfer({ ...transfer, date: event.target.value })} className={control + " class-note-meta-input mt-1 w-full"}/></label><div className="mt-3 flex flex-wrap gap-2">{days.map((day) => <button key={day} onClick={() => setTransfer({ ...transfer, date: day })} className={"min-h-10 rounded-lg border px-2 text-xs " + (transfer.date === day ? "border-yellow-400 text-yellow-300" : "border-zinc-700")}>{dateLabel(day).split(" ")[0]}</button>)}</div><div className="mt-4 flex justify-end gap-2"><button onClick={() => setTransfer(null)} className="min-h-11 px-3">Cancelar</button><button disabled={busy} onClick={() => void (transfer.action === "move" ? movePlan(transfer.id, transfer.date) : copyPlan(transfer.id, transfer.date))} className="min-h-11 rounded-lg bg-yellow-400 px-4 font-bold text-zinc-950">{transfer.action === "move" ? "Mover" : "Copiar"}</button></div></div></div>}
    {view !== "editor" && <section className="mt-6 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-4 text-[var(--foreground)] sm:p-5" aria-labelledby="complete-classes-heading"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="complete-classes-heading" className="text-lg font-bold">Clases completas</h2><p className="mt-1 text-sm text-[var(--foreground-muted)]">Consultá, reutilizá y organizá tus clases completas guardadas.</p></div><button type="button" aria-expanded={completeClassesOpen} aria-controls="complete-classes-content" onClick={() => setCompleteClassesOpen((current) => !current)} className="min-h-11 rounded-xl border border-[var(--border-soft)] px-4 text-sm font-bold text-[var(--brand-text)]">{completeClassesOpen ? "Ocultar clases completas" : "Ver clases completas"}</button></div>{completeClassesOpen && <div id="complete-classes-content" className="mt-4"><RutinasPage classLibraryOnly /></div>}</section>}
  </section>;
}
