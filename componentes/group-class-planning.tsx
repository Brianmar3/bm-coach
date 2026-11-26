"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TrainingRoutine } from "@/types/gestion";
import type { ClassNote } from "@/lib/group-class-planning";
import { classRichPlainText } from "@/lib/class-rich-text";
import { ClassNotesEditor, ClassNotesView } from "@/componentes/class-notes-editor";
import RutinasPage from "@/app/rutinas/page";
import { useGroupClassDraft, type ClassDraftContent } from "@/componentes/use-group-class-draft";
import { useTouchClassCopy } from "@/componentes/use-touch-class-copy";
import { classPlanMoveIndex } from "@/lib/class-plan-drag";

type Occurrence = { id: string; date: string; startTime: string; classNameSnapshot: string; status: string; taughtAt: string | null; taughtSnapshot: ClassNote | null };
type Plan = { id: string; date: string; sortOrder: number; routineId: string | null; occurrenceId: string | null; snapshot: ClassNote; occurrence: Occurrence | null };
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
function caretOffsetAtPoint(container: HTMLElement, x: number, y: number) {
  const legacy = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null };
  const caret = document.caretPositionFromPoint?.(x, y);
  const range = caret ? document.createRange() : legacy.caretRangeFromPoint?.(x, y);
  if (caret) range?.setStart(caret.offsetNode, caret.offset);
  if (!range || !container.contains(range.startContainer)) return null;
  range.setEnd(range.startContainer, range.startOffset);
  range.setStart(container, 0);
  return range.toString().length;
}
function makeNote(name: string, modality: string, text: string): ClassNote { return { name: name.trim() || "Clase sin título", modality: modality.trim() || "Otra", blocks: [{ name: "Clase", text }] }; }
function routinePayload(name: string, modality: string, text: string, original?: TrainingRoutine | null) {
  const chunks = text.match(/[\s\S]{1,2000}/g) ?? [""];
  return { name: name.trim() || "Clase sin título", kind: "template", status: "borrador", objective: "Clase grupal", level: "principiante", trainerNotificationsEnabled: false, description: "", startDate: "", durationWeeks: null, priorityMuscles: [], location: "", equipment: [], studentIds: [], tags: ["Tipo de clase: " + (modality.trim() || "Otra"), "Clase libre"], expectedUpdatedAt: original?.updatedAt, days: [{ dayNumber: 1, name: name.trim() || "Clase sin título", objective: "", warmup: "", observations: "", estimatedMinutes: null, exercises: [], blocks: chunks.map((chunk, index) => ({ type: "FREE", name: "Clase", order: index + 1, rounds: null, durationSeconds: null, workSeconds: null, restSeconds: null, restBetweenRoundsSeconds: null, targetRounds: null, instructions: chunk, exercises: [] })) }] };
}

function PlanningDay({ date, plans, history, busy, touchCopy, dragSourceRef, open, add, reorder, dropPlan }: {
  date: string; plans: Plan[]; history: boolean; busy: boolean;
  touchCopy: ReturnType<typeof useTouchClassCopy>;
  dragSourceRef: { current: string | null };
  open: (plan: Plan) => void; add: () => void;
  reorder: (id: string, target: number) => void;
  dropPlan: (id: string, date: string, position: number) => void;
}) {
  const visible = plans.filter((plan) => !history || plan.occurrence?.taughtAt).sort((a, b) => a.sortOrder - b.sortOrder);
  const draggedElement = useRef<HTMLElement | null>(null);
  const suppressClick = useRef(false);
  const [drop, setDrop] = useState<{ id: string; after: boolean } | null>(null);
  const [dropDay, setDropDay] = useState(false);
  function finishDrag() {
    if (draggedElement.current) draggedElement.current.style.visibility = "";
    draggedElement.current = null;
    dragSourceRef.current = null;
    setDrop(null);
    setDropDay(false);
    window.setTimeout(() => { suppressClick.current = false; }, 400);
  }
  return <div data-plan-day={date} data-plan-card={date} data-drop-day={dropDay || undefined}
    onDragOver={(event) => { if (!dragSourceRef.current || busy || history) return; event.preventDefault(); event.dataTransfer.dropEffect = "move"; if (!(event.target as Element).closest("article[data-plan-card]")) { setDrop(null); setDropDay(true); } }}
    onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) { setDrop(null); setDropDay(false); } }}
    onDrop={(event) => { if (!dragSourceRef.current || busy || history) return; event.preventDefault(); setDropDay(false); setDrop(null); dropPlan(dragSourceRef.current, date, visible.length); }}
    className="class-plan-day min-w-0 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-2">
    <h2 className="mb-2 text-sm font-bold capitalize text-[var(--brand-text)]">{dateLabel(date)}</h2>
    <div className="space-y-2">{visible.map((plan, index) => <article key={plan.id} data-plan-card={plan.id}
      draggable={!busy && !history && !plan.occurrence?.taughtAt} tabIndex={0} role="button"
      aria-label={`Abrir ${plan.snapshot.name}`} aria-describedby={!history ? `class-plan-sort-help-${date}` : undefined}
      onDragStart={(event) => {
        if (touchCopy.isTouchPending()) { event.preventDefault(); return; }
        dragSourceRef.current = plan.id; draggedElement.current = event.currentTarget; suppressClick.current = true;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("application/x-bm-class-plan", plan.id);
        window.setTimeout(() => { if (dragSourceRef.current === plan.id && draggedElement.current) draggedElement.current.style.visibility = "hidden"; }, 0);
      }}
      onDragOver={(event) => { if (!dragSourceRef.current || busy || history) return; event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = "move"; setDropDay(false); setDrop({ id: plan.id, after: event.clientY >= event.currentTarget.getBoundingClientRect().top + event.currentTarget.getBoundingClientRect().height / 2 }); }}
      onDrop={(event) => { if (!dragSourceRef.current || busy || history) return; event.preventDefault(); event.stopPropagation(); setDrop(null); dropPlan(dragSourceRef.current, date, index + (event.clientY >= event.currentTarget.getBoundingClientRect().top + event.currentTarget.getBoundingClientRect().height / 2 ? 1 : 0)); }}
      onDragEnd={finishDrag}
      onTouchStart={(event) => { if (!busy && !history && !plan.occurrence?.taughtAt) touchCopy.start(event, plan.id); }}
      onTouchMove={touchCopy.moveBeforeActivation} onTouchEnd={touchCopy.endBeforeActivation} onTouchCancel={touchCopy.endBeforeActivation}
      onContextMenu={(event) => { if (touchCopy.isTouchPending()) event.preventDefault(); }}
      onClick={(event) => { if (suppressClick.current || touchCopy.consumeClick()) { event.preventDefault(); return; } open(plan); }}
      onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && event.target === event.currentTarget) { event.preventDefault(); open(plan); } else if (!busy && !history && !plan.occurrence?.taughtAt && ["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) { event.preventDefault(); const target = event.key === "Home" ? 0 : event.key === "End" ? visible.length - 1 : index + (event.key === "ArrowUp" ? -1 : 1); if (target >= 0 && target < visible.length) reorder(plan.id, target); } }}
      data-drop-before={drop?.id === plan.id && !drop.after || undefined} data-drop-after={drop?.id === plan.id && drop.after || undefined}
      className="class-plan-card cursor-grab rounded-lg border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-2 text-xs text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-[var(--bm-accent)] active:cursor-grabbing">
      <p className="text-[var(--brand-text)]">{plan.snapshot.modality}{plan.occurrence ? " · " + plan.occurrence.startTime : ""}</p><h3 className="mt-1 break-words font-semibold">{plan.snapshot.name}</h3>
      <p className="mt-1 line-clamp-2 whitespace-pre-line text-[var(--foreground-muted)]">{classRichPlainText(noteText(plan.snapshot))}</p>
    </article>)}</div>
    {!history && visible.length > 0 && <p id={`class-plan-sort-help-${date}`} className="sr-only">Arrastrá la tarjeta para cambiar el día o la posición. En celular, mantené presionado. Con teclado, usá las flechas, Inicio o Fin para ordenar dentro del día.</p>}
    {history && !visible.length && <p className="text-xs text-[var(--foreground-muted)]">Sin clases dictadas</p>}
    <button onClick={add} className="mt-2 min-h-12 w-full rounded-lg border border-dashed border-[var(--bm-accent)] px-2 py-2 text-xs font-semibold text-[var(--brand-text)]">+ Agregar clase</button>
  </div>;
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
  const [loadedWeek, setLoadedWeek] = useState<string | null>(null);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [routines, setRoutines] = useState<TrainingRoutine[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [picker, setPicker] = useState<"actions" | "library" | "previous">("actions");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const dragSourceRef = useRef<string | null>(null);
  const selectedPlanDialogRef = useRef<HTMLDivElement>(null);
  const touchCopy = useTouchClassCopy((id, targetId, _at, y) => touchPlanDrop(id, targetId, y), "data-plan-card");
  const [transfer, setTransfer] = useState<{ id: string; action: "move"; date: string } | null>(null);
  const [copyRequest, setCopyRequest] = useState<{ id: string; sourceDate: string; date: string; position?: number; name: string; chooseDate?: boolean } | null>(null);
  const [editorDate, setEditorDate] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [editingRoutine, setEditingRoutine] = useState<TrainingRoutine | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("Funcional");
  const [text, setText] = useState("");
  const [editorFocusRequest, setEditorFocusRequest] = useState(0);
  const [editorCaretOffset, setEditorCaretOffset] = useState<number | null>(null);
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
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);
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
    setPlans(data.plans); setLoadedWeek(week); setOccurrences(data.occurrences); setRecent(data.recent);
    setRoutines((await libraryResponse.json() as TrainingRoutine[]).filter((item) => item.kind === "template" && item.days.length === 1 && item.status !== "archivada"));
  }, [week]);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) void load().catch((value: unknown) => { if (active) setError(value instanceof Error ? value.message : "No se pudo cargar."); }); }); return () => { active = false; }; }, [load]);
  const modalities = [...new Set(["Funcional", "GAP", "Kids", ...routines.map(modality)])];
  const filtered = routines.filter((item) => (!search || item.name.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"))) && (!filter || modality(item) === filter));
  const previous = [...plans.filter((item) => selectedDate && item.date < selectedDate), ...recent.filter((item) => selectedDate && item.date < selectedDate)].sort((a, b) => b.date.localeCompare(a.date));
  function beginEditor(date: string | null = null, plan?: Plan, routine?: TrainingRoutine, variant = false, caretOffset: number | null = null) {
    if (plan || routine) setEditorFocusRequest((current) => current + 1);
    setEditorCaretOffset(caretOffset);
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
  function prepareCopy(id: string, date: string, position?: number, chooseDate = false) {
    const source = plans.find((plan) => plan.id === id) ?? recent.find((plan) => plan.id === id);
    if (!source) return;
    setSelectedDate(null); setSelectedPlan(null); setTransfer(null);
    setCopyRequest({ id, sourceDate: source.date, date, position, name: source.snapshot.name, chooseDate });
  }
  async function confirmCopy() {
    if (!copyRequest?.name.trim() || busy) return;
    const input = copyRequest;
    await run(async () => { await request("/api/clases/planes", "POST", { sourcePlanId: input.id, date: input.date, position: input.position, name: input.name.trim() }); setCopyRequest(null); setNotice("Copia independiente creada."); });
  }
  async function movePlan(id: string, date: string) { await run(async () => { await request("/api/clases/planes", "PATCH", { id, date }); setTransfer(null); setSelectedPlan(null); setNotice("Clase movida."); }); }
  function touchPlanDrop(id: string, targetId: string, y?: number) {
    const source = plans.find((plan) => plan.id === id);
    const target = plans.find((plan) => plan.id === targetId);
    if (!source || source.occurrence?.taughtAt || busy || history) return;
    const targetDate = target?.date ?? (days.includes(targetId) ? targetId : null);
    if (!targetDate) return;
    const destination = plans.filter((plan) => plan.date === targetDate).sort((a, b) => a.sortOrder - b.sortOrder);
    if (!target) {
      const sourceCard = [...document.querySelectorAll<HTMLElement>("article[data-plan-card]")].find((element) => element.dataset.planCard === id);
      const bounds = sourceCard?.getBoundingClientRect();
      if (targetDate === source.date && bounds && y !== undefined && y >= bounds.top && y <= bounds.bottom) return;
      dropPlan(id, targetDate, destination.length);
      return;
    }
    if (y === undefined) return;
    const targetCard = [...document.querySelectorAll<HTMLElement>("article[data-plan-card]")].find((element) => element.dataset.planCard === targetId);
    if (!targetCard) return;
    const bounds = targetCard.getBoundingClientRect();
    dropPlan(id, targetDate, destination.findIndex((plan) => plan.id === targetId) + (y >= bounds.top + bounds.height / 2 ? 1 : 0));
  }
  function dropPlan(id: string, date: string, position: number) {
    const source = plans.find((plan) => plan.id === id);
    if (!source || source.occurrence?.taughtAt || busy || history || !days.includes(date)) return;
    const destination = plans.filter((plan) => plan.date === date).sort((a, b) => a.sortOrder - b.sortOrder);
    if (position < 0 || position > destination.length) return;
    if (source.date === date) {
      const from = destination.findIndex((plan) => plan.id === id);
      if (from >= 0) reorderDay(date, id, classPlanMoveIndex(source.date, date, from, position));
      return;
    }
    prepareCopy(id, date, position);
  }
  async function deletePlan(plan: Plan) { if (!window.confirm("¿Eliminar esta planificación?")) return; await run(async () => { await request("/api/clases/planes", "DELETE", { id: plan.id }); setSelectedPlan(null); setNotice("Planificación eliminada."); }); }
  async function linkOccurrence(plan: Plan, occurrenceId: string | null) { await run(async () => { await request("/api/clases/planes", "PATCH", { id: plan.id, occurrenceId }); setSelectedPlan(null); setNotice(occurrenceId ? "Horario vinculado." : "Horario desvinculado."); }); }
  async function markTaught(plan: Plan) { if (!plan.occurrenceId || !window.confirm("¿Confirmás que esta clase se dictó realmente?")) return; await run(async () => { await request("/api/clases/planificacion", "POST", { occurrenceId: plan.occurrenceId, action: "taught", confirmed: true }); setSelectedPlan(null); setNotice("Clase registrada como dictada."); }); }
  function reorderDay(date: string, id: string, target: number) {
    if (busy) return;
    const dayPlans = plans.filter((plan) => plan.date === date).sort((a, b) => a.sortOrder - b.sortOrder);
    const from = dayPlans.findIndex((plan) => plan.id === id);
    if (from < 0 || target < 0 || target >= dayPlans.length || from === target) return;
    const ordered = [...dayPlans];
    ordered.splice(target, 0, ...ordered.splice(from, 1));
    void run(async () => { await request("/api/clases/planes", "PATCH", { date, orderedIds: ordered.map((plan) => plan.id) }); setNotice("Orden guardado."); });
  }
  function openAdd(date: string) { setSelectedDate(date); setPicker("actions"); setError(""); }
  const selectedDayPlans = selectedPlan ? plans.filter((plan) => plan.date === selectedPlan.date).sort((a, b) => a.sortOrder - b.sortOrder) : [];
  const selectedPlanIndex = selectedDayPlans.findIndex((plan) => plan.id === selectedPlan?.id);
  const taughtCount = loadedWeek === week ? plans.filter((plan) => Boolean(plan.occurrence?.taughtAt)).length : 0;
  const showingHistory = history && taughtCount > 0;
  const control = "min-h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3";
  return <section data-group-class-planning aria-label="Planificación semanal de clases" className="text-zinc-100">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div className="flex gap-2"><button onClick={() => { setDraftKey(null); setView("week"); }} className={view === "week" ? "min-h-11 rounded-xl bg-yellow-400/15 px-3 text-sm text-yellow-300" : "min-h-11 rounded-xl border border-zinc-700 px-3 text-sm"}>Mi semana</button><button onClick={() => { setDraftKey(null); setView("library"); }} className={view === "library" ? "min-h-11 rounded-xl bg-yellow-400/15 px-3 text-sm text-yellow-300" : "min-h-11 rounded-xl border border-zinc-700 px-3 text-sm"}>Biblioteca de clases</button></div><button onClick={() => beginEditor()} className="min-h-11 rounded-xl bg-yellow-400 px-4 text-sm font-bold text-zinc-950">+ Nueva clase</button></div>
    {error && <p role="alert" className="mb-3 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
    {notice && <div role="status" aria-live="polite" className="class-plan-toast"><span aria-hidden="true" className="class-plan-toast-icon">✓</span><span className="min-w-0 flex-1">{notice}</span><button type="button" aria-label="Cerrar notificación" onClick={() => setNotice("")} className="class-plan-toast-close">×</button></div>}
    {view === "week" && <div className="rounded-2xl border border-zinc-800 bg-zinc-900/85 p-3 sm:p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><button aria-label="Semana anterior" onClick={() => setWeek(addDays(week, -7))} className={control}>←</button><button aria-label="Semana siguiente" onClick={() => setWeek(addDays(week, 7))} className={control}>→</button><strong className="ml-1 text-sm">{dateLabel(week)} al {dateLabel(addDays(week, 6))}</strong></div>{(showingHistory || taughtCount > 0) && <button onClick={() => setHistory((value) => !value)} className="min-h-10 text-sm text-yellow-300">{showingHistory ? "Ver planificadas" : `Ver dictadas (${taughtCount})`}</button>}</div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">{days.map((day) => <PlanningDay key={day} date={day} plans={plans.filter((plan) => plan.date === day)} history={showingHistory} busy={busy} touchCopy={touchCopy} dragSourceRef={dragSourceRef} open={setSelectedPlan} add={() => openAdd(day)} reorder={(id, target) => reorderDay(day, id, target)} dropPlan={dropPlan} />)}</div></div>}
    {view === "library" && <div className="rounded-2xl border border-zinc-800 bg-zinc-900/85 p-3 sm:p-4"><div className="flex flex-wrap gap-2"><input aria-label="Buscar clase" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar clase" className={control + " min-w-0 flex-1"}/><select aria-label="Filtrar modalidad" value={filter} onChange={(event) => setFilter(event.target.value)} className={control}><option value="">Todas las modalidades</option>{modalities.map((item) => <option key={item}>{item}</option>)}</select></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((item) => <article key={item.id} className="rounded-xl border border-zinc-700 bg-zinc-950/60 p-3"><p className="text-xs text-yellow-300">{modality(item)} · {item.status === "borrador" ? "Borrador" : "Guardada"}</p><h3 className="mt-1 font-semibold">{item.name}</h3><p className="mt-2 line-clamp-3 whitespace-pre-line text-xs text-zinc-400">{classRichPlainText(routineText(item))}</p><div className="mt-3 flex flex-wrap gap-2"><button onClick={() => beginEditor(null, undefined, item)} className={control + " text-xs"}>{item.tags.includes("Clase libre") ? "Editar" : "Usar como base"}</button><button onClick={() => beginEditor(null, undefined, item, true)} className={control + " text-xs text-yellow-300"}>Crear variante</button></div></article>)}</div>{!filtered.length && <p className="mt-4 text-sm text-zinc-400">Todavía no hay clases guardadas.</p>}</div>}
    {view === "editor" && <div className="mx-auto max-w-3xl rounded-2xl lg:max-w-none border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-3 text-[var(--foreground)] sm:p-5"><div className="mb-3 flex items-center justify-between gap-2"><button onClick={() => { setDraftKey(null); setView(editorDate ? "week" : "library"); }} className="min-h-10 text-sm text-[var(--foreground-muted)]">← Volver</button><span className="text-xs text-[var(--brand-text)]">{editorDate ? dateLabel(editorDate) : "Biblioteca"}</span></div><div className="grid gap-2 sm:grid-cols-2"><label className="text-sm">Nombre de la clase<input value={name} disabled={!draftReady || busy} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="Clase sin título" className={control + " class-note-meta-input mt-1 w-full"}/></label><label className="text-sm">Modalidad<input list="class-modalities" value={type} disabled={!draftReady || busy} onChange={(event) => setType(event.target.value)} maxLength={65} className={control + " class-note-meta-input mt-1 w-full"}/><datalist id="class-modalities">{modalities.map((item) => <option key={item} value={item}/>)}</datalist></label></div><div className="mt-3 text-sm"><p className="mb-1">Tu clase</p><ClassNotesEditor value={text} onChange={setText} disabled={!draftReady || busy} focusRequest={editorFocusRequest} initialCaretOffset={editorCaretOffset} onSave={() => void saveEditor()} /></div><div className="mt-3 flex items-center justify-between gap-2"><span role="status" className="text-xs text-[var(--foreground-muted)]">{draftStatus === "loading" ? "Recuperando borrador…" : draftStatus === "unavailable" ? "Sin conexión: reconectá para recuperar el borrador" : draftStatus === "pending" ? "Cambios pendientes de sincronización" : draftStatus === "saved" ? "Borrador guardado" : ""}</span><button title="Guardar clase (Ctrl+S)" disabled={busy || !draftReady} onClick={() => void saveEditor()} className="min-h-11 rounded-xl bg-[var(--bm-accent)] px-5 font-bold text-[var(--bm-accent-contrast)] disabled:opacity-50">{busy ? "Guardando…" : "Guardar clase"}</button></div></div>}
    {selectedDate && <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3" onClick={(event) => { if (event.target === event.currentTarget) setSelectedDate(null); }}><div role="dialog" aria-modal="true" aria-label={"Agregar clase el " + dateLabel(selectedDate)} className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-yellow-400/30 bg-zinc-900 p-4"><div className="flex items-center justify-between"><h2 className="font-bold capitalize">{dateLabel(selectedDate)}</h2><button aria-label="Cerrar" onClick={() => setSelectedDate(null)} className="min-h-10 min-w-10">×</button></div>{picker !== "actions" && <button onClick={() => setPicker("actions")} className="my-2 min-h-10 text-sm text-yellow-300">← Opciones</button>}{picker === "actions" && <div className="mt-3 grid gap-2"><button onClick={() => beginEditor(selectedDate)} className={control + " text-left"}>Crear clase nueva →</button><button onClick={() => setPicker("library")} className={control + " text-left"}>Seleccionar de la biblioteca →</button><button onClick={() => setPicker("previous")} className={control + " text-left"}>Copiar planificación anterior →</button></div>}{picker === "library" && <div className="mt-2 grid gap-2">{routines.map((item) => <button key={item.id} disabled={busy} onClick={() => void addFromLibrary(item.id)} className={control + " text-left text-sm"}>{modality(item)} · {item.name}</button>)}{!routines.length && <p className="text-sm text-zinc-400">La biblioteca está vacía.</p>}</div>}{picker === "previous" && <div className="mt-2 grid gap-2">{previous.map((item) => <button key={item.id} disabled={busy} onClick={() => prepareCopy(item.id, selectedDate)} className={control + " text-left text-sm"}>{item.date} · {item.snapshot.modality} · {item.snapshot.name}</button>)}{!previous.length && <p className="text-sm text-zinc-400">Todavía no hay planificaciones anteriores.</p>}</div>}</div></div>}
    {selectedPlan && <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3" onClick={(event) => { if (event.target === event.currentTarget) setSelectedPlan(null); }}><div role="dialog" aria-modal="true" aria-label="Opciones de clase planificada" ref={selectedPlanDialogRef} tabIndex={-1} className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-yellow-400/30 bg-zinc-900 p-4"><div className="flex items-start justify-between gap-2"><div><p className="text-xs text-yellow-300">{selectedPlan.date} · {selectedPlan.snapshot.modality}</p><h2 className="font-bold">{selectedPlan.snapshot.name}</h2></div><button aria-label="Cerrar" onClick={() => setSelectedPlan(null)} className="min-h-10 min-w-10">×</button></div><div role={selectedPlan.occurrence?.taughtAt ? undefined : "button"} tabIndex={selectedPlan.occurrence?.taughtAt ? undefined : 0} aria-label={selectedPlan.occurrence?.taughtAt ? undefined : "Editar contenido de la clase"} onClick={(event) => { if (!selectedPlan.occurrence?.taughtAt) beginEditor(selectedPlan.date, selectedPlan, undefined, false, caretOffsetAtPoint(event.currentTarget, event.clientX, event.clientY)); }} onKeyDown={(event) => { if (!selectedPlan.occurrence?.taughtAt && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); beginEditor(selectedPlan.date, selectedPlan); } }} className={selectedPlan.occurrence?.taughtAt ? "" : "cursor-text focus-visible:outline-2 focus-visible:outline-[var(--bm-accent)]"}><ClassNotesView className="mt-3 break-words rounded-xl bg-[var(--surface)] p-3 text-sm" value={selectedPlan.occurrence?.taughtAt && selectedPlan.occurrence.taughtSnapshot ? noteText(selectedPlan.occurrence.taughtSnapshot) : noteText(selectedPlan.snapshot)} /></div>{selectedPlan.occurrence?.taughtAt ? <p className="mt-3 text-sm text-emerald-300">Clase dictada: historial conservado.</p> : <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => beginEditor(selectedPlan.date, selectedPlan)} className={control}>Editar clase</button><button onClick={() => { prepareCopy(selectedPlan.id, selectedPlan.date, undefined, true); }} className={control}>Copiar a…</button><button onClick={() => { setTransfer({ id: selectedPlan.id, action: "move", date: selectedPlan.date }); setSelectedPlan(null); }} className={control}>Mover a…</button><button onClick={() => beginEditor(selectedPlan.date, selectedPlan, undefined, true)} className={control}>Crear variante</button>{selectedDayPlans.length > 1 && <div className="col-span-2 flex gap-2" aria-label="Orden de la clase en el día"><button disabled={busy || selectedPlanIndex <= 0} onClick={() => { reorderDay(selectedPlan.date, selectedPlan.id, selectedPlanIndex - 1); setSelectedPlan(null); }} className={control + " flex-1 text-sm disabled:opacity-40"}>Subir en el día</button><button disabled={busy || selectedPlanIndex >= selectedDayPlans.length - 1} onClick={() => { reorderDay(selectedPlan.date, selectedPlan.id, selectedPlanIndex + 1); setSelectedPlan(null); }} className={control + " flex-1 text-sm disabled:opacity-40"}>Bajar en el día</button></div>}<label className="col-span-2 text-xs text-zinc-400">Horario real (opcional)<select value={selectedPlan.occurrenceId ?? ""} disabled={busy} onChange={(event) => void linkOccurrence(selectedPlan, event.target.value || null)} className={control + " mt-1 w-full text-sm"}><option value="">Sin horario asociado</option>{occurrences.filter((item) => item.date === selectedPlan.date && item.status === "SCHEDULED" && !item.taughtAt && (!plans.some((plan) => plan.occurrenceId === item.id) || item.id === selectedPlan.occurrenceId)).map((item) => <option key={item.id} value={item.id}>{item.startTime} · {item.classNameSnapshot}</option>)}</select></label>{selectedPlan.occurrenceId && <button onClick={() => void markTaught(selectedPlan)} className="col-span-2 min-h-11 rounded-lg border border-emerald-400/40 text-emerald-300">Confirmar que se dictó</button>}<button onClick={() => void deletePlan(selectedPlan)} className="col-span-2 min-h-11 text-sm text-red-300">Eliminar planificación</button></div>}</div></div>}
    {copyRequest && <div role="presentation" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-3" onClick={(event) => { if (event.target === event.currentTarget) setCopyRequest(null); }}><form role="dialog" aria-modal="true" aria-label="Copiar clase" onSubmit={(event) => { event.preventDefault(); void confirmCopy(); }} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setCopyRequest(null); } }} className="w-full max-w-sm rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-4 text-[var(--foreground)] shadow-2xl"><h2 className="font-bold">Copiar clase</h2><p className="mt-3 text-sm text-[var(--foreground-muted)]">Origen: {dateLabel(copyRequest.sourceDate)}</p><p className="text-sm text-[var(--foreground-muted)]">Destino: {copyRequest.date ? dateLabel(copyRequest.date) : "Seleccioná una fecha"}</p>{copyRequest.chooseDate && <label className="mt-3 block text-sm">Fecha de destino<input type="date" required value={copyRequest.date} onChange={(event) => setCopyRequest({ ...copyRequest, date: event.target.value })} className={control + " class-note-meta-input mt-1 w-full"} /></label>}<label className="mt-3 block text-sm">Nombre de la copia<input autoFocus value={copyRequest.name} maxLength={120} onChange={(event) => setCopyRequest({ ...copyRequest, name: event.target.value })} className={control + " class-note-meta-input mt-1 w-full"} /></label><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setCopyRequest(null)} className="min-h-11 px-3">Cancelar</button><button type="submit" disabled={busy || !copyRequest.name.trim()} className="min-h-11 rounded-lg bg-[var(--bm-accent)] px-4 font-bold text-[var(--bm-accent-contrast)] disabled:opacity-50">Copiar clase</button></div></form></div>}
    {transfer && <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3" onClick={(event) => { if (event.target === event.currentTarget) setTransfer(null); }}><div role="dialog" aria-modal="true" aria-label="Mover clase" className="w-full max-w-sm rounded-2xl border border-yellow-400/30 bg-zinc-900 p-4"><h2 className="font-bold">Mover a…</h2><label className="mt-3 block text-sm">Fecha de destino<input type="date" value={transfer.date} onChange={(event) => setTransfer({ ...transfer, date: event.target.value })} className={control + " class-note-meta-input mt-1 w-full"}/></label><div className="mt-3 flex flex-wrap gap-2">{days.map((day) => <button key={day} onClick={() => setTransfer({ ...transfer, date: day })} className={"min-h-10 rounded-lg border px-2 text-xs " + (transfer.date === day ? "border-yellow-400 text-yellow-300" : "border-zinc-700")}>{dateLabel(day).split(" ")[0]}</button>)}</div><div className="mt-4 flex justify-end gap-2"><button onClick={() => setTransfer(null)} className="min-h-11 px-3">Cancelar</button><button disabled={busy} onClick={() => void movePlan(transfer.id, transfer.date)} className="min-h-11 rounded-lg bg-yellow-400 px-4 font-bold text-zinc-950">Mover</button></div></div></div>}
    {view !== "editor" && <section className="mt-6 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-4 text-[var(--foreground)] sm:p-5" aria-labelledby="complete-classes-heading"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="complete-classes-heading" className="text-lg font-bold">Clases completas</h2><p className="mt-1 text-sm text-[var(--foreground-muted)]">Consultá, reutilizá y organizá tus clases completas guardadas.</p></div><button type="button" aria-expanded={completeClassesOpen} aria-controls="complete-classes-content" onClick={() => setCompleteClassesOpen((current) => !current)} className="min-h-11 rounded-xl border border-[var(--border-soft)] px-4 text-sm font-bold text-[var(--brand-text)]">{completeClassesOpen ? "Ocultar clases completas" : "Ver clases completas"}</button></div>{completeClassesOpen && <div id="complete-classes-content" className="mt-4"><RutinasPage classLibraryOnly /></div>}</section>}
  </section>;
}
