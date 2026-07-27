"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ModuleShell, inputClass } from "@/componentes/module-shell";
import { RoutineFollowUp } from "@/componentes/routine-follow-up";
import type { Student, TrainingEffortType, TrainingExercise, TrainingRoutine, TrainingRoutineKind, TrainingRoutineLevel, TrainingRoutineStatus } from "@/types/gestion";

type ExerciseDraft = Omit<TrainingExercise, "id"> & { id?: string; clientId: string };
type DayDraft = { id?: string; clientId: string; dayNumber: number; name: string; objective: string; observations: string; estimatedMinutes: number | null; exercises: ExerciseDraft[] };
type RoutineDraft = {
  name: string;
  kind: TrainingRoutineKind;
  description: string;
  objective: string;
  level: TrainingRoutineLevel;
  status: TrainingRoutineStatus;
  startDate: string;
  durationWeeks: number | null;
  priorityMuscles: string[];
  location: string;
  equipment: string[];
  tags: string[];
  studentIds: string[];
  days: DayDraft[];
};
type RoutineVersionItem = { id: string; version: number; summary: string; createdAt: string };
type CopyMode = "saveAsTemplate" | "useTemplate" | "copyToStudent";
type CopyFlow = { source: TrainingRoutine; mode: CopyMode };

const objectives = ["Hipertrofia", "Fuerza", "Descenso de grasa", "Rehabilitación", "Funcional", "Resistencia", "Movilidad"];
const levels: TrainingRoutineLevel[] = ["principiante", "intermedio", "avanzado"];
const statuses: TrainingRoutineStatus[] = ["borrador", "activa", "finalizada", "archivada"];
const muscleGroups = ["Pecho", "Espalda", "Hombros", "Bíceps", "Tríceps", "Cuádriceps", "Isquiotibiales", "Glúteos", "Gemelos", "Core", "Cuerpo completo", "Movilidad"];

function newExercise(order: number): ExerciseDraft {
  return { clientId: crypto.randomUUID(), name: "", muscleGroup: "", sets: 3, repetitions: "10-12", weight: null, effortType: "RIR", effortValue: 2, restSeconds: 90, observations: "", videoUrl: "", tempo: "", alternativeExercise: "", equipment: "", optional: false, order };
}

function blankRoutine(kind: TrainingRoutineKind = "assigned"): RoutineDraft {
  return {
    name: "",
    kind,
    description: "",
    objective: "Hipertrofia",
    level: "principiante",
    status: "borrador",
    startDate: "",
    durationWeeks: null,
    priorityMuscles: [],
    location: "",
    equipment: [],
    tags: [],
    studentIds: [],
    days: [{ clientId: crypto.randomUUID(), dayNumber: 1, name: "Día 1", objective: "", observations: "", estimatedMinutes: null, exercises: [] }],
  };
}

function routineDraft(routine: TrainingRoutine): RoutineDraft {
  return {
    name: routine.name,
    kind: routine.kind,
    description: routine.description,
    objective: routine.objective,
    level: routine.level,
    status: routine.status,
    startDate: routine.startDate,
    durationWeeks: routine.durationWeeks,
    priorityMuscles: routine.priorityMuscles,
    location: routine.location,
    equipment: routine.equipment,
    tags: routine.tags,
    studentIds: routine.studentIds,
    days: routine.days.map((day) => ({
      id: day.id,
      clientId: crypto.randomUUID(),
      dayNumber: day.dayNumber,
      name: day.name,
      objective: day.objective,
      observations: day.observations,
      estimatedMinutes: day.estimatedMinutes,
      exercises: day.exercises.map((exercise) => ({ ...exercise, clientId: crypto.randomUUID() })),
    })),
  };
}

function showDate(value: string) { return new Date(value).toLocaleDateString("es-AR"); }
function label(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
function exerciseCount(routine: TrainingRoutine) { return routine.days.reduce((total, day) => total + day.exercises.length, 0); }
function activeDays(routine: TrainingRoutine) { return routine.days.filter((day) => day.exercises.length > 0).length; }

async function responseError(response: Response, fallback: string) {
  try { return ((await response.json()) as { error?: string }).error ?? fallback; } catch { return fallback; }
}

export default function RutinasPage() {
  const [activeTab, setActiveTab] = useState<"rutinas" | "plantillas" | "asignaciones" | "seguimiento">(() => {
    if (typeof window === "undefined") return "rutinas";
    const requested = new URLSearchParams(window.location.search).get("tab");
    return requested === "plantillas" || requested === "asignaciones" || requested === "seguimiento" ? requested : "rutinas";
  });
  const [trackingRoutineId, setTrackingRoutineId] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("routineId") ?? "");
  const [trackingStudentId] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("studentId") ?? "");
  const [items, setItems] = useState<TrainingRoutine[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"activas" | "borradores" | "finalizadas" | "archivadas" | "todas">("activas");
  const [objectiveFilter, setObjectiveFilter] = useState("todos");
  const [studentFilter, setStudentFilter] = useState("todos");
  const [form, setForm] = useState<RoutineDraft>(blankRoutine());
  const [editing, setEditing] = useState<TrainingRoutine | null>(null);
  const [viewing, setViewing] = useState<TrainingRoutine | null>(null);
  const [activeDay, setActiveDay] = useState(1);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState("");
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [historyRoutine, setHistoryRoutine] = useState<TrainingRoutine | null>(null);
  const [versions, setVersions] = useState<RoutineVersionItem[]>([]);
  const [copyFlow, setCopyFlow] = useState<CopyFlow | null>(null);
  const [replaceOnActivate, setReplaceOnActivate] = useState(false);
  const copyRequestInFlight = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/rutinas", { signal: controller.signal, cache: "no-store" }).then(async (response) => { if (!response.ok) throw new Error(await responseError(response, "No se pudieron cargar las rutinas.")); return response.json() as Promise<TrainingRoutine[]>; }),
      fetch("/api/alumnos", { signal: controller.signal, cache: "no-store" }).then(async (response) => { if (!response.ok) throw new Error(await responseError(response, "No se pudieron cargar los alumnos.")); return response.json() as Promise<Student[]>; }),
    ]).then(([routines, realStudents]) => { setItems(routines); setStudents(realStudents); }).catch((loadError: unknown) => { if (loadError instanceof Error && loadError.name !== "AbortError") setError(loadError.message); }).finally(() => setReady(true));
    return () => controller.abort();
  }, []);

  const objectiveOptions = useMemo(() => [...new Set([...objectives, ...items.map((item) => item.objective)])].sort((a, b) => a.localeCompare(b, "es")), [items]);
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    return items.filter((routine) =>
      routine.kind === (activeTab === "plantillas" ? "template" : "assigned")
      &&
      (statusFilter === "todas"
        || (statusFilter === "activas" && routine.status === "activa")
        || (statusFilter === "borradores" && routine.status === "borrador")
        || (statusFilter === "finalizadas" && routine.status === "finalizada")
        || (statusFilter === "archivadas" && routine.status === "archivada"))
      && (!normalized || `${routine.name} ${routine.description} ${routine.objective} ${routine.tags.join(" ")} ${routine.equipment.join(" ")} ${routine.historicalStudents.map((student) => student.name).join(" ")}`.toLocaleLowerCase("es").includes(normalized))
      && (objectiveFilter === "todos" || routine.objective === objectiveFilter)
      && (studentFilter === "todos" || (routine.status === "archivada" ? routine.historicalStudents.some((student) => student.id === studentFilter) : routine.studentIds.includes(studentFilter))));
  }, [activeTab, items, objectiveFilter, query, statusFilter, studentFilter]);

  function begin(routine?: TrainingRoutine) {
    setEditing(routine ?? null);
    setForm(routine ? routineDraft(routine) : blankRoutine(activeTab === "plantillas" ? "template" : "assigned"));
    setActiveDay(1);
    setError("");
    setReplaceOnActivate(false);
    setOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!form.name.trim() || !form.objective.trim()) { setError("Completá nombre y objetivo."); return; }
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const intent = submitter instanceof HTMLButtonElement ? submitter.value : "current";
    const requestedStatus = intent === "draft" ? "borrador" : intent === "activate" ? "activa" : form.status;
    const payload = {
      ...form,
      status: requestedStatus,
      replaceActive: requestedStatus === "activa" && replaceOnActivate,
      days: form.days.map((day) => ({
        id: day.id,
        dayNumber: day.dayNumber,
        name: day.name,
        objective: day.objective,
        observations: day.observations,
        estimatedMinutes: day.estimatedMinutes,
        exercises: [...day.exercises].sort((a, b) => a.order - b.order).map((exercise, index) => ({
          id: exercise.id,
          name: exercise.name,
          muscleGroup: exercise.muscleGroup,
          sets: exercise.sets,
          repetitions: exercise.repetitions,
          weight: exercise.weight,
          effortType: exercise.effortType,
          effortValue: exercise.effortValue,
          restSeconds: exercise.restSeconds,
          observations: exercise.observations,
          videoUrl: exercise.videoUrl,
          tempo: exercise.tempo,
          alternativeExercise: exercise.alternativeExercise,
          equipment: exercise.equipment,
          optional: exercise.optional,
          order: index + 1,
        })),
      })),
    };
    setSaving(true); setError("");
    try {
      const response = await fetch(editing ? `/api/rutinas/${editing.id}` : "/api/rutinas", { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo guardar la rutina."));
      const saved = (await response.json()) as TrainingRoutine;
      setItems((current) => editing ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      setOpen(false); setEditing(null); setNotice(requestedStatus === "activa" ? "Rutina activada correctamente." : "Rutina guardada correctamente.");
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la rutina en Neon."); }
    finally { setSaving(false); }
  }

  async function duplicate(routine: TrainingRoutine) {
    if (copyRequestInFlight.current) return;
    copyRequestInFlight.current = true;
    setDuplicatingId(routine.id); setError("");
    try {
      const response = await fetch(`/api/rutinas/${routine.id}/duplicar`, { method: "POST" });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo duplicar la rutina."));
      const copy = (await response.json()) as TrainingRoutine;
      setItems((current) => [copy, ...current]);
    } catch (duplicateError) { setError(duplicateError instanceof Error ? duplicateError.message : "No se pudo duplicar la rutina en Neon."); }
    finally { setDuplicatingId(""); copyRequestInFlight.current = false; }
  }

  async function createCopy({ source, mode, name, studentId, startDate, desiredStatus, replaceActive }: { source: TrainingRoutine; mode: CopyMode; name: string; studentId?: string; startDate: string; desiredStatus: "borrador" | "activa"; replaceActive: boolean }) {
    if (copyRequestInFlight.current) return;
    copyRequestInFlight.current = true;
    setDuplicatingId(source.id); setError("");
    try {
      const response = await fetch(`/api/rutinas/${source.id}/duplicar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, name, studentId, startDate, status: "borrador" }) });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo crear la copia."));
      const copy = await response.json() as TrainingRoutine;
      setItems((current) => [copy, ...current]);
      setCopyFlow(null);
      if (mode === "saveAsTemplate") {
        setActiveTab("plantillas");
        setNotice("Plantilla creada sin datos personales ni historial.");
      } else {
        setActiveTab("rutinas");
        setEditing(copy);
        setForm({ ...routineDraft(copy), status: desiredStatus });
        setReplaceOnActivate(replaceActive);
        setActiveDay(1);
        setOpen(true);
        setNotice("La copia se creó como borrador. Revisala antes de guardarla o activarla.");
      }
    } catch (copyError) { setError(copyError instanceof Error ? copyError.message : "No se pudo crear la copia."); }
    finally { setDuplicatingId(""); copyRequestInFlight.current = false; }
  }

  async function remove(routine: TrainingRoutine) {
    if (!window.confirm("Esta acción eliminará definitivamente la rutina. No se puede deshacer.")) return;
    setActionId(routine.id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/rutinas/${routine.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo eliminar la rutina."));
      const result = await response.json() as { message: string };
      setItems((current) => current.filter((item) => item.id !== routine.id));
      if (viewing?.id === routine.id) setViewing(null);
      setNotice(result.message);
    } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar la rutina de Neon."); }
    finally { setActionId(""); }
  }

  async function archive(routine: TrainingRoutine) {
    if (!window.confirm(`¿Archivar “${routine.name}”? La rutina dejará de estar activa, pero conservará todo su historial.`)) return;
    setActionId(routine.id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/rutinas/${routine.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "archive" }) });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo archivar la rutina."));
      const result = await response.json() as { message: string; routine: TrainingRoutine };
      setItems((current) => current.map((item) => item.id === routine.id ? result.routine : item));
      setViewing((current) => current?.id === routine.id ? result.routine : current);
      setNotice(result.message);
    } catch (archiveError) { setError(archiveError instanceof Error ? archiveError.message : "No se pudo archivar la rutina."); }
    finally { setActionId(""); }
  }

  async function restore(routine: TrainingRoutine) {
    if (!window.confirm(`¿Restaurar “${routine.name}” como rutina activa?`)) return;
    setActionId(routine.id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/rutinas/${routine.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo restaurar la rutina."));
      const result = await response.json() as { message: string; routine: TrainingRoutine };
      setItems((current) => current.map((item) => item.id === routine.id ? result.routine : item));
      setViewing((current) => current?.id === routine.id ? result.routine : current);
      setNotice(result.message);
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "No se pudo restaurar la rutina.");
    } finally { setActionId(""); }
  }

  async function openHistory(routine: TrainingRoutine) {
    setError(""); setHistoryRoutine(routine); setVersions([]);
    try {
      const response = await fetch(`/api/rutinas/${routine.id}/versiones`, { cache: "no-store" });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo cargar el historial."));
      setVersions(await response.json() as RoutineVersionItem[]);
    } catch (historyError) { setError(historyError instanceof Error ? historyError.message : "No se pudo cargar el historial."); }
  }

  async function restoreVersion(versionId: string) {
    if (!historyRoutine || !window.confirm("¿Restaurar esta versión? La versión actual se conservará en el historial.")) return;
    setActionId(historyRoutine.id);
    try {
      const response = await fetch(`/api/rutinas/${historyRoutine.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "restoreVersion", versionId }) });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo restaurar la versión."));
      const restored = await response.json() as TrainingRoutine;
      setItems((current) => current.map((item) => item.id === restored.id ? restored : item));
      setHistoryRoutine(restored); setNotice("Versión restaurada correctamente");
      await openHistory(restored);
    } catch (restoreError) { setError(restoreError instanceof Error ? restoreError.message : "No se pudo restaurar la versión."); }
    finally { setActionId(""); }
  }

  return <ModuleShell title="Rutinas" subtitle="Diseñá, reutilizá y asigná planes independientes sin alterar el historial." action={activeTab === "seguimiento" || activeTab === "asignaciones" ? null : <button onClick={() => begin()} className="rounded-xl bg-yellow-400 px-4 py-3 font-bold text-zinc-950 transition hover:bg-yellow-300">+ {activeTab === "plantillas" ? "Crear plantilla" : "Crear rutina"}</button>}>
    {error && !open && <p role="alert" className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}
    {notice && !open && <p role="status" className="mb-5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">{notice}</p>}
    <nav className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-2">{([["rutinas", "Rutinas"], ["plantillas", "Plantillas de rutinas"], ["asignaciones", "Asignaciones"], ["seguimiento", "Seguimiento de alumnos"]] as const).map(([value, title]) => <button key={value} onClick={() => { setActiveTab(value); if (value !== "seguimiento") setTrackingRoutineId(""); }} className={`shrink-0 rounded-xl px-4 py-3 text-sm font-bold ${activeTab === value ? "bg-yellow-400 text-zinc-950" : "text-zinc-400 hover:bg-zinc-800"}`}>{title}</button>)}</nav>
    {activeTab === "seguimiento" ? <RoutineFollowUp initialRoutineId={trackingRoutineId} initialStudentId={trackingStudentId} /> : <>
    <section className="grid gap-4 sm:grid-cols-3"><Summary label={activeTab === "plantillas" ? "Plantillas activas" : "Rutinas activas"} value={items.filter((item) => item.kind === (activeTab === "plantillas" ? "template" : "assigned") && item.status === "activa").length} /><Summary label={activeTab === "plantillas" ? "Plantillas archivadas" : "Alumnos con rutina"} value={activeTab === "plantillas" ? items.filter((item) => item.kind === "template" && item.status === "archivada").length : new Set(items.filter((item) => item.kind === "assigned").flatMap((item) => item.studentIds)).size} /><Summary label="Ejercicios planificados" value={visible.reduce((total, item) => total + exerciseCount(item), 0)} /></section>
    <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar rutina, objetivo o alumno" className={inputClass} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className={inputClass}><option value="activas">Activas</option><option value="borradores">Borradores</option><option value="finalizadas">Finalizadas</option><option value="archivadas">Archivadas</option><option value="todas">Todas</option></select><select value={objectiveFilter} onChange={(event) => setObjectiveFilter(event.target.value)} className={inputClass}><option value="todos">Todos los objetivos</option>{objectiveOptions.map((objective) => <option key={objective}>{objective}</option>)}</select><select value={studentFilter} onChange={(event) => setStudentFilter(event.target.value)} className={inputClass}><option value="todos">Todos los alumnos</option>{students.map((student) => <option key={student.id} value={student.id}>{student.firstName} {student.lastName}</option>)}</select></div></section>
    <section className="mt-6 grid gap-4 lg:grid-cols-2">{!ready ? <p className="col-span-full rounded-2xl border border-zinc-800 bg-zinc-900 p-12 text-center text-zinc-500">Cargando rutinas…</p> : visible.length === 0 ? <p className="col-span-full rounded-2xl border border-zinc-800 bg-zinc-900 p-12 text-center text-zinc-500">{activeTab === "plantillas" ? "No hay plantillas que coincidan con los filtros." : statusFilter === "archivadas" ? "No hay rutinas archivadas." : "No hay rutinas que coincidan con los filtros."}</p> : visible.map((routine) => <RoutineCard key={routine.id} routine={routine} view={() => setViewing(routine)} history={() => openHistory(routine)} tracking={() => { setTrackingRoutineId(routine.id); setActiveTab("seguimiento"); }} edit={() => begin(routine)} duplicate={() => duplicate(routine)} saveAsTemplate={() => setCopyFlow({ source: routine, mode: "saveAsTemplate" })} useTemplate={() => setCopyFlow({ source: routine, mode: "useTemplate" })} copyToStudent={() => setCopyFlow({ source: routine, mode: "copyToStudent" })} archive={() => archive(routine)} remove={() => remove(routine)} restore={() => restore(routine)} duplicating={duplicatingId === routine.id} busy={actionId === routine.id} />)}</section>
    </>}
    {open && <RoutineEditor form={form} setForm={setForm} students={students} activeDay={activeDay} setActiveDay={setActiveDay} error={error} close={() => setOpen(false)} submit={submit} editing={Boolean(editing)} saving={saving} />}
    {viewing && <RoutineDetail routine={viewing} close={() => setViewing(null)} />}
    {copyFlow && <RoutineCopyDialog flow={copyFlow} students={students} routines={items} busy={duplicatingId === copyFlow.source.id} close={() => setCopyFlow(null)} submit={createCopy} />}
    {historyRoutine && <div className="fixed inset-0 z-50 overflow-auto bg-black/80 p-4"><section className="mx-auto my-10 max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6"><div className="flex justify-between gap-4"><div><h2 className="text-xl font-bold">Historial de {historyRoutine.name}</h2><p className="text-sm text-zinc-400">Las versiones más recientes aparecen primero.</p></div><button onClick={() => setHistoryRoutine(null)} className="text-zinc-400">Cerrar</button></div><div className="mt-5 space-y-3">{versions.length === 0 ? <p className="rounded-xl bg-zinc-950 p-5 text-sm text-zinc-500">Todavía no hay versiones guardadas.</p> : versions.map((version) => <article key={version.id} className="flex flex-col gap-3 rounded-xl bg-zinc-950 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">Versión {version.version}</p><p className="text-sm text-zinc-400">{version.summary} · {new Date(version.createdAt).toLocaleString("es-AR")}</p></div><button disabled={actionId === historyRoutine.id} onClick={() => restoreVersion(version.id)} className="rounded-lg border border-yellow-400/40 px-3 py-2 text-sm text-yellow-300 disabled:opacity-50">Restaurar versión</button></article>)}</div></section></div>}
  </ModuleShell>;
}

function RoutineCopyDialog({ flow, students, routines, busy, close, submit }: {
  flow: CopyFlow;
  students: Student[];
  routines: TrainingRoutine[];
  busy: boolean;
  close: () => void;
  submit: (input: { source: TrainingRoutine; mode: CopyMode; name: string; studentId?: string; startDate: string; desiredStatus: "borrador" | "activa"; replaceActive: boolean }) => Promise<void>;
}) {
  const needsStudent = flow.mode !== "saveAsTemplate";
  const [query, setQuery] = useState("");
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState(`${flow.source.name} (copia)`);
  const [startDate, setStartDate] = useState(flow.source.startDate);
  const [desiredStatus, setDesiredStatus] = useState<"borrador" | "activa">("borrador");
  const [activeChoice, setActiveChoice] = useState<"draft" | "replace">("draft");
  const selectedStudent = students.find((student) => student.id === studentId);
  const activeRoutine = studentId ? routines.find((routine) => routine.kind === "assigned" && routine.status === "activa" && routine.studentIds.includes(studentId)) : undefined;
  const normalize = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es").replace(/\s+/g, " ").trim();
  const matches = useMemo(() => {
    const term = normalize(query);
    if (!term) return students.slice(0, 10);
    return students.filter((student) => normalize(`${student.firstName} ${student.lastName} ${student.phone}`).includes(term)).slice(0, 10);
  }, [query, students]);

  useEffect(() => {
    function keydown(event: KeyboardEvent) { if (event.key === "Escape" && !busy) close(); }
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [busy, close]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy || !name.trim() || (needsStudent && !studentId)) return;
    const replaceActive = desiredStatus === "activa" && Boolean(activeRoutine) && activeChoice === "replace";
    await submit({ source: flow.source, mode: flow.mode, name: name.trim(), studentId: studentId || undefined, startDate, desiredStatus: activeRoutine && activeChoice === "draft" ? "borrador" : desiredStatus, replaceActive });
  }

  return <div role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget && !busy) close(); }} className="fixed inset-0 z-[70] flex items-end bg-black/80 p-0 sm:items-center sm:justify-center sm:p-4">
    <form onSubmit={onSubmit} role="dialog" aria-modal="true" aria-labelledby="copy-routine-title" className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 text-white shadow-2xl sm:max-w-2xl sm:rounded-2xl sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><h2 id="copy-routine-title" className="text-xl font-bold">{flow.mode === "saveAsTemplate" ? "Guardar como plantilla" : flow.mode === "useTemplate" ? "Usar plantilla" : "Copiar a otro alumno"}</h2><p className="mt-1 text-sm text-zinc-400">Se creará una copia independiente, sin sesiones ni resultados.</p></div><button type="button" onClick={close} disabled={busy} className="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 disabled:opacity-50">Cerrar</button></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2">Nombre<input autoFocus={!needsStudent} required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className={`${inputClass} mt-1`} /></label>{flow.mode !== "saveAsTemplate" && <label>Fecha de inicio<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={`${inputClass} mt-1`} /></label>}</div>
      {needsStudent && <section className="mt-5"><div className="flex items-center justify-between gap-3"><label htmlFor="copy-student-search" className="font-semibold text-yellow-400">Alumno</label>{selectedStudent && <button type="button" onClick={() => { setStudentId(""); setQuery(""); setDesiredStatus("borrador"); }} className="text-sm text-zinc-400">Limpiar selección</button>}</div><input id="copy-student-search" aria-label="Buscar alumno por nombre, apellido o teléfono" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, apellido o teléfono" className={`${inputClass} mt-2`} />{selectedStudent ? <div className="mt-3 rounded-xl border border-yellow-400/40 bg-yellow-400/10 p-3"><p className="font-bold text-yellow-200">{selectedStudent.firstName} {selectedStudent.lastName}</p><p className="text-sm text-zinc-400">{selectedStudent.phone || "Sin teléfono"}</p></div> : <div className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950 p-2">{matches.length ? matches.map((student) => <button key={student.id} type="button" onClick={() => { setStudentId(student.id); setQuery(`${student.firstName} ${student.lastName}`); }} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-yellow-400"><span className="font-medium">{student.firstName} {student.lastName}</span><span className="text-xs text-zinc-500">{student.phone || "Sin teléfono"}</span></button>) : <p className="p-4 text-center text-sm text-zinc-500">No se encontraron alumnos.</p>}</div>}</section>}
      {needsStudent && selectedStudent && <section className="mt-5 rounded-xl border border-zinc-700 p-4"><p className="font-semibold">Estado después de revisar</p><p className="mt-1 text-sm text-zinc-400">La copia se crea siempre como borrador y se abre en el editor antes de activarla.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => setDesiredStatus("borrador")} className={`rounded-lg px-3 py-2 text-sm ${desiredStatus === "borrador" ? "bg-yellow-400 font-bold text-zinc-950" : "bg-zinc-800"}`}>Guardar borrador</button><button type="button" onClick={() => setDesiredStatus("activa")} className={`rounded-lg px-3 py-2 text-sm ${desiredStatus === "activa" ? "bg-yellow-400 font-bold text-zinc-950" : "bg-zinc-800"}`}>Activar después de revisar</button></div>{activeRoutine && desiredStatus === "activa" && <div className="mt-4 rounded-xl border border-orange-400/40 bg-orange-400/10 p-3"><p className="font-semibold text-orange-200">Este alumno ya tiene activa “{activeRoutine.name}”.</p><label className="mt-3 flex gap-2 text-sm"><input type="radio" checked={activeChoice === "draft"} onChange={() => setActiveChoice("draft")} /> Crear la nueva como borrador</label><label className="mt-2 flex gap-2 text-sm"><input type="radio" checked={activeChoice === "replace"} onChange={() => setActiveChoice("replace")} /> Al confirmar la activación, finalizar la actual y activar la nueva</label></div>}</section>}
      <div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" onClick={close} disabled={busy} className="rounded-xl border border-zinc-700 px-4 py-3 text-sm font-bold disabled:opacity-50">Cancelar</button><button type="submit" disabled={busy || !name.trim() || (needsStudent && !studentId)} className="rounded-xl bg-yellow-400 px-4 py-3 text-sm font-bold text-zinc-950 disabled:opacity-50">{busy ? "Creando…" : flow.mode === "saveAsTemplate" ? "Crear plantilla" : "Crear borrador y revisar"}</button></div>
    </form>
  </div>;
}

function Summary({ label: title, value }: { label: string; value: number }) { return <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><p className="text-sm text-zinc-400">{title}</p><p className="mt-1 text-3xl font-bold text-yellow-400">{value}</p></article>; }

function RoutineCard({ routine, view, history, tracking, edit, duplicate, saveAsTemplate, useTemplate, copyToStudent, archive, remove, restore, duplicating, busy }: {
  routine: TrainingRoutine;
  view: () => void;
  history: () => void;
  tracking: () => void;
  edit: () => void;
  duplicate: () => void;
  saveAsTemplate: () => void;
  useTemplate: () => void;
  copyToStudent: () => void;
  archive: () => void;
  remove: () => void;
  restore: () => void;
  duplicating: boolean;
  busy: boolean;
}) {
  const archived = routine.status === "archivada";
  return <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-yellow-400/40">
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold">{routine.name}</h2>
          <span className={`rounded-full px-2 py-1 text-xs font-bold ${archived ? "bg-zinc-700 text-zinc-300" : "bg-emerald-400/10 text-emerald-300"}`}>{label(routine.status)}</span>
        </div>
        <p className="mt-1 text-sm text-yellow-400">{routine.objective} · {label(routine.level)}</p>
      </div>
      <span className="text-xs text-zinc-500">{showDate(routine.createdAt)}</span>
    </div>
    <div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
      <Info label="Días con ejercicios" value={`${activeDays(routine)}/${routine.days.length}`} />
      <Info label="Ejercicios" value={String(exerciseCount(routine))} />
      <Info label={archived ? "Alumnos históricos" : "Alumnos"} value={String(archived ? routine.historicalStudents.length : routine.students.length)} />
    </div>
    <p className="mt-4 truncate text-sm text-zinc-400">{(archived ? routine.historicalStudents : routine.students).map((student) => student.name).join(" · ") || "Sin alumnos asignados"}</p>
    {archived && routine.archivedAt && <p className="mt-2 text-xs text-zinc-500">Archivada el {showDate(routine.archivedAt)}</p>}
    <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold">
      <button onClick={view} className="text-yellow-400">Ver contenido</button>
      <button onClick={history} className="text-yellow-400">Ver historial</button>
      {routine.kind === "assigned" && <button onClick={tracking} className="text-yellow-400">Ver seguimiento</button>}
      {!archived && <button onClick={edit} className="text-yellow-400">Editar</button>}
      {!archived && <button onClick={archive} disabled={busy} className="text-orange-300 disabled:opacity-50">{busy ? "Archivando…" : "Archivar"}</button>}
      {archived && <button onClick={restore} disabled={busy} className="text-emerald-300 disabled:opacity-50">{busy ? "Restaurando…" : "Restaurar"}</button>}
      <button onClick={duplicate} disabled={duplicating} className="text-sky-300 disabled:opacity-50">{duplicating ? "Duplicando…" : "Duplicar"}</button>
      {routine.kind === "assigned" && <button onClick={saveAsTemplate} disabled={duplicating} className="text-sky-300 disabled:opacity-50">Guardar como plantilla</button>}
      {routine.kind === "assigned" && <button onClick={copyToStudent} disabled={duplicating} className="text-sky-300 disabled:opacity-50">Copiar a otro alumno</button>}
      {routine.kind === "template" && !archived && <button onClick={useTemplate} disabled={duplicating} className="text-yellow-300 disabled:opacity-50">Usar plantilla</button>}
      {archived && <button onClick={remove} disabled={busy} className="text-red-300 disabled:opacity-50">{busy ? "Eliminando…" : "Eliminar definitivamente"}</button>}
    </div>
  </article>;
}

function Info({ label: title, value }: { label: string; value: string }) { return <div className="rounded-xl bg-zinc-950 p-3"><p className="text-xs text-zinc-500">{title}</p><p className="mt-1 font-semibold">{value}</p></div>; }

function RoutineEditor({ form, setForm, students, activeDay, setActiveDay, error, close, submit, editing, saving }: { form: RoutineDraft; setForm: (form: RoutineDraft) => void; students: Student[]; activeDay: number; setActiveDay: (day: number) => void; error: string; close: () => void; submit: (event: FormEvent) => void; editing: boolean; saving: boolean }) {
  const currentDay = form.days.find((day) => day.dayNumber === activeDay) ?? form.days[0];
  function updateDay(updater: (day: DayDraft) => DayDraft) { setForm({ ...form, days: form.days.map((day) => day.dayNumber === activeDay ? updater(day) : day) }); }
  function addExercise() { updateDay((day) => ({ ...day, exercises: [...day.exercises, newExercise(day.exercises.length + 1)] })); }
  function updateExercise<K extends keyof ExerciseDraft>(clientId: string, key: K, value: ExerciseDraft[K]) { updateDay((day) => ({ ...day, exercises: day.exercises.map((exercise) => exercise.clientId === clientId ? { ...exercise, [key]: value } : exercise) })); }
  function removeExercise(clientId: string) {
    if (!window.confirm("¿Eliminar este ejercicio del día? El historial previo se conservará.")) return;
    updateDay((day) => ({ ...day, exercises: day.exercises.filter((exercise) => exercise.clientId !== clientId).map((exercise, index) => ({ ...exercise, order: index + 1 })) }));
  }
  function moveExercise(clientId: string, direction: -1 | 1) { updateDay((day) => { const exercises = [...day.exercises].sort((a, b) => a.order - b.order); const index = exercises.findIndex((exercise) => exercise.clientId === clientId); const target = index + direction; if (index < 0 || target < 0 || target >= exercises.length) return day; [exercises[index], exercises[target]] = [exercises[target], exercises[index]]; return { ...day, exercises: exercises.map((exercise, order) => ({ ...exercise, order: order + 1 })) }; }); }
  function toggleStudent(studentId: string) { setForm({ ...form, studentIds: form.studentIds.includes(studentId) ? form.studentIds.filter((id) => id !== studentId) : [...form.studentIds, studentId] }); }
  function addDay() {
    if (form.days.length >= 14) return;
    const next = form.days.length + 1;
    setForm({ ...form, days: [...form.days, { clientId: crypto.randomUUID(), dayNumber: next, name: `Día ${next}`, objective: "", observations: "", estimatedMinutes: null, exercises: [] }] });
    setActiveDay(next);
  }
  function moveDay(direction: -1 | 1) {
    const index = form.days.findIndex((day) => day.dayNumber === activeDay);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= form.days.length) return;
    const days = [...form.days];
    [days[index], days[target]] = [days[target], days[index]];
    const reordered = days.map((day, dayIndex) => ({ ...day, dayNumber: dayIndex + 1 }));
    setForm({ ...form, days: reordered });
    setActiveDay(target + 1);
  }
  function duplicateDay() {
    if (form.days.length >= 14) return;
    const index = form.days.findIndex((day) => day.dayNumber === activeDay);
    if (index < 0) return;
    const source = form.days[index];
    const duplicate: DayDraft = {
      clientId: crypto.randomUUID(),
      dayNumber: source.dayNumber + 1,
      name: `${source.name} (copia)`,
      objective: source.objective,
      observations: source.observations,
      estimatedMinutes: source.estimatedMinutes,
      exercises: source.exercises.map((exercise) => ({ ...exercise, id: undefined, clientId: crypto.randomUUID() })),
    };
    const days = [...form.days.slice(0, index + 1), duplicate, ...form.days.slice(index + 1)].map((day, dayIndex) => ({ ...day, dayNumber: dayIndex + 1 }));
    setForm({ ...form, days });
    setActiveDay(index + 2);
  }
  function removeDay() {
    if (form.days.length === 1 || !window.confirm(`¿Eliminar “${currentDay.name}”? Sus sesiones históricas no se modificarán.`)) return;
    const index = form.days.findIndex((day) => day.dayNumber === activeDay);
    const days = form.days.filter((day) => day.dayNumber !== activeDay).map((day, dayIndex) => ({ ...day, dayNumber: dayIndex + 1 }));
    setForm({ ...form, days });
    setActiveDay(Math.min(index + 1, days.length));
  }
  return <div className="fixed inset-0 z-50 overflow-auto bg-black/80 p-4"><form onSubmit={submit} className="mx-auto my-6 w-full max-w-7xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-white"><div className="flex justify-between gap-4"><div><h2 className="text-xl font-bold">{editing ? "Editar rutina" : "Nueva rutina"}</h2><p className="mt-1 text-sm text-zinc-400">Organizá la programación por días y conservá el orden de cada ejercicio.</p></div><button type="button" onClick={close} className="self-start text-zinc-400">Cerrar</button></div>{error && <p role="alert" className="mt-4 rounded-lg bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><label className="md:col-span-2">Nombre<input required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={`${inputClass} mt-1`} /></label><label>Objetivo<input required list="routine-objectives" maxLength={100} value={form.objective} onChange={(event) => setForm({ ...form, objective: event.target.value })} className={`${inputClass} mt-1`} /><datalist id="routine-objectives">{objectives.map((objective) => <option key={objective} value={objective} />)}</datalist></label><label>Nivel<select value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value as TrainingRoutineLevel })} className={`${inputClass} mt-1`}>{levels.map((level) => <option key={level} value={level}>{label(level)}</option>)}</select></label><label>Fecha de inicio<input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} className={`${inputClass} mt-1`} /></label><label>Duración (semanas)<input type="number" min="1" max="104" value={form.durationWeeks ?? ""} onChange={(event) => setForm({ ...form, durationWeeks: event.target.value ? Number(event.target.value) : null })} className={`${inputClass} mt-1`} /></label><label>Lugar<input maxLength={100} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Casa, gimnasio o Salón BM Training" className={`${inputClass} mt-1`} /></label><label>Estado<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as TrainingRoutineStatus })} className={`${inputClass} mt-1`}>{statuses.filter((status) => form.kind === "assigned" || status !== "finalizada").map((status) => <option key={status} value={status}>{label(status)}</option>)}</select></label><label className="md:col-span-2">Descripción<textarea maxLength={1000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={`${inputClass} mt-1`} /></label><label className="md:col-span-2">Músculos prioritarios<input value={form.priorityMuscles.join(", ")} onChange={(event) => setForm({ ...form, priorityMuscles: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} placeholder="Pecho, espalda, glúteos" className={`${inputClass} mt-1`} /></label><label className="md:col-span-2">Equipamiento<input value={form.equipment.join(", ")} onChange={(event) => setForm({ ...form, equipment: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} placeholder="Mancuernas, bandas" className={`${inputClass} mt-1`} /></label><label className="md:col-span-2">Etiquetas<input value={form.tags.join(", ")} onChange={(event) => setForm({ ...form, tags: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} placeholder="Full body, casa, 3 días" className={`${inputClass} mt-1`} /></label></div>
    {form.kind === "assigned" && <fieldset className="mt-6"><legend className="font-semibold text-yellow-400">Alumnos asignados</legend><div className="mt-3 flex flex-wrap gap-2">{students.map((student) => { const selected = form.studentIds.includes(student.id); return <label key={student.id} className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${selected ? "border-yellow-400 bg-yellow-400/10 text-yellow-300" : "border-zinc-700 text-zinc-400"}`}><input type="checkbox" checked={selected} onChange={() => toggleStudent(student.id)} className="sr-only" />{student.firstName} {student.lastName}</label>; })}</div></fieldset>}
    <div className="mt-7 flex items-center gap-2 overflow-x-auto pb-2">{form.days.map((day) => <button type="button" key={day.clientId} onClick={() => setActiveDay(day.dayNumber)} className={`min-w-32 rounded-xl px-3 py-3 text-left text-sm ${activeDay === day.dayNumber ? "bg-yellow-400 font-bold text-zinc-950" : "bg-zinc-800 text-zinc-300"}`}><span className="block truncate">Día {day.dayNumber} · {day.name}</span><span className="block text-xs opacity-70">{day.exercises.length} ejercicios</span></button>)}<button type="button" onClick={addDay} disabled={form.days.length >= 14} className="shrink-0 rounded-xl border border-dashed border-zinc-600 px-4 py-3 text-sm text-zinc-300 disabled:opacity-40">+ Día</button></div>
    <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div className="grid flex-1 gap-3 sm:grid-cols-2"><label>Nombre del día<input required maxLength={100} value={currentDay.name} onChange={(event) => updateDay((day) => ({ ...day, name: event.target.value }))} className={`${inputClass} mt-1`} /></label><label>Duración estimada (min)<input type="number" min="1" max="1440" value={currentDay.estimatedMinutes ?? ""} onChange={(event) => updateDay((day) => ({ ...day, estimatedMinutes: event.target.value ? Number(event.target.value) : null }))} className={`${inputClass} mt-1`} /></label><label>Objetivo del día<input maxLength={200} value={currentDay.objective} onChange={(event) => updateDay((day) => ({ ...day, objective: event.target.value }))} className={`${inputClass} mt-1`} /></label><label>Observaciones<textarea maxLength={1000} value={currentDay.observations} onChange={(event) => updateDay((day) => ({ ...day, observations: event.target.value }))} className={`${inputClass} mt-1`} /></label></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => moveDay(-1)} className="rounded-lg bg-zinc-800 px-3 py-2 text-sm">← Mover</button><button type="button" onClick={() => moveDay(1)} className="rounded-lg bg-zinc-800 px-3 py-2 text-sm">Mover →</button><button type="button" onClick={duplicateDay} className="rounded-lg bg-zinc-800 px-3 py-2 text-sm">Duplicar día</button><button type="button" onClick={removeDay} disabled={form.days.length === 1} className="rounded-lg bg-red-400/10 px-3 py-2 text-sm text-red-300 disabled:opacity-40">Eliminar día</button><button type="button" onClick={addExercise} className="rounded-lg bg-yellow-400 px-3 py-2 text-sm font-bold text-zinc-950">+ Ejercicio</button></div></div><div className="mt-4 space-y-4">{currentDay.exercises.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-500">Este día todavía no tiene ejercicios.</p> : [...currentDay.exercises].sort((a, b) => a.order - b.order).map((exercise) => <ExerciseEditor key={exercise.clientId} exercise={exercise} update={(key, value) => updateExercise(exercise.clientId, key, value)} move={(direction) => moveExercise(exercise.clientId, direction)} remove={() => removeExercise(exercise.clientId)} />)}</div></section>
    <div className="mt-6 flex flex-wrap justify-end gap-3"><button type="submit" name="intent" value="draft" disabled={saving} className="rounded-xl border border-yellow-400/50 px-5 py-3 font-bold text-yellow-300 disabled:opacity-60">{saving ? "Guardando…" : "Guardar borrador"}</button><button type="submit" name="intent" value="current" disabled={saving} className="rounded-xl bg-zinc-700 px-5 py-3 font-bold text-white disabled:opacity-60">{saving ? "Guardando…" : `Guardar como ${label(form.status)}`}</button><button type="submit" name="intent" value="activate" disabled={saving} className="rounded-xl bg-yellow-400 px-5 py-3 font-bold text-zinc-950 transition hover:bg-yellow-300 disabled:opacity-60">{saving ? "Activando…" : "Activar rutina"}</button></div>
  </form></div>;
}

function ExerciseEditor({ exercise, update, move, remove }: { exercise: ExerciseDraft; update: <K extends keyof ExerciseDraft>(key: K, value: ExerciseDraft[K]) => void; move: (direction: -1 | 1) => void; remove: () => void }) {
  const repetitionValues = exercise.repetitions.match(/\d+/g)?.map(Number) ?? [];
  const minimumRepetitions = repetitionValues[0] ?? "";
  const maximumRepetitions = repetitionValues[1] ?? repetitionValues[0] ?? "";
  function updateRepetitions(minimum: string, maximum: string) {
    if (!minimum && !maximum) update("repetitions", "");
    else if (!maximum || minimum === maximum) update("repetitions", minimum || maximum);
    else update("repetitions", `${minimum}-${maximum}`);
  }
  return <article className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-yellow-400 font-bold text-zinc-950">{exercise.order}</span><span className="text-sm text-zinc-500">Orden</span><button type="button" onClick={() => move(-1)} className="rounded bg-zinc-800 px-2 py-1 text-zinc-300" aria-label="Mover ejercicio arriba">↑</button><button type="button" onClick={() => move(1)} className="rounded bg-zinc-800 px-2 py-1 text-zinc-300" aria-label="Mover ejercicio abajo">↓</button></div><button type="button" onClick={remove} className="text-sm text-red-300">Eliminar ejercicio</button></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6"><label className="xl:col-span-2">Ejercicio<input required value={exercise.name} onChange={(event) => update("name", event.target.value)} className={`${inputClass} mt-1`} /></label><label>Grupo muscular<input required list="muscle-groups" value={exercise.muscleGroup} onChange={(event) => update("muscleGroup", event.target.value)} className={`${inputClass} mt-1`} /><datalist id="muscle-groups">{muscleGroups.map((group) => <option key={group} value={group} />)}</datalist></label><label>Series<input required type="number" min="1" max="100" value={exercise.sets} onChange={(event) => update("sets", Number(event.target.value))} className={`${inputClass} mt-1`} /></label><label>Reps mínimas<input required type="number" min="1" max="1000" value={minimumRepetitions} onChange={(event) => updateRepetitions(event.target.value, String(maximumRepetitions))} className={`${inputClass} mt-1`} /></label><label>Reps máximas<input required type="number" min="1" max="1000" value={maximumRepetitions} onChange={(event) => updateRepetitions(String(minimumRepetitions), event.target.value)} className={`${inputClass} mt-1`} /></label><label>Peso inicial (kg)<input type="number" min="0" max="1000" step="0.25" value={exercise.weight ?? ""} onChange={(event) => update("weight", event.target.value === "" ? null : Number(event.target.value))} className={`${inputClass} mt-1`} /></label><label>Esfuerzo objetivo<select value={exercise.effortType} onChange={(event) => update("effortType", event.target.value as TrainingEffortType)} className={`${inputClass} mt-1`}><option>RIR</option><option>RPE</option></select></label><label>RIR/RPE objetivo<input type="number" min="0" max="10" step="0.5" value={exercise.effortValue ?? ""} onChange={(event) => update("effortValue", event.target.value === "" ? null : Number(event.target.value))} className={`${inputClass} mt-1`} /></label><label>Descanso (seg.)<input type="number" min="0" max="3600" value={exercise.restSeconds ?? ""} onChange={(event) => update("restSeconds", event.target.value === "" ? null : Number(event.target.value))} className={`${inputClass} mt-1`} /></label><label>Tempo<input maxLength={40} value={exercise.tempo} onChange={(event) => update("tempo", event.target.value)} placeholder="3-1-1" className={`${inputClass} mt-1`} /></label><label>Equipamiento<input maxLength={120} value={exercise.equipment} onChange={(event) => update("equipment", event.target.value)} className={`${inputClass} mt-1`} /></label><label className="xl:col-span-2">Ejercicio alternativo<input maxLength={120} value={exercise.alternativeExercise} onChange={(event) => update("alternativeExercise", event.target.value)} className={`${inputClass} mt-1`} /></label><label className="flex items-center gap-2 self-end rounded-xl border border-zinc-700 px-3 py-3"><input type="checkbox" checked={exercise.optional} onChange={(event) => update("optional", event.target.checked)} /> Opcional</label><label className="xl:col-span-2">Video demostrativo<input type="url" placeholder="https://…" value={exercise.videoUrl} onChange={(event) => update("videoUrl", event.target.value)} className={`${inputClass} mt-1`} /></label><label className="md:col-span-2 xl:col-span-6">Observaciones técnicas<textarea maxLength={1000} rows={2} value={exercise.observations} onChange={(event) => update("observations", event.target.value)} className={`${inputClass} mt-1`} /></label></div></article>;
}

function RoutineDetail({ routine, close }: { routine: TrainingRoutine; close: () => void }) {
  return <div className="fixed inset-0 z-50 overflow-auto bg-black/80 p-4"><section className="mx-auto my-8 w-full max-w-5xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-white"><div className="flex justify-between gap-4"><div><h2 className="text-2xl font-bold">{routine.name}</h2><p className="mt-1 text-yellow-400">{routine.objective} · {label(routine.level)} · {label(routine.status)}</p><p className="mt-2 text-sm text-zinc-500">Asignada a {routine.students.map((student) => student.name).join(" · ")}</p></div><button onClick={close} className="self-start text-zinc-400">Cerrar</button></div><div className="mt-6 space-y-4">{routine.days.map((day) => <article key={day.id} className="rounded-xl border border-zinc-800"><h3 className="border-b border-zinc-800 p-4 font-bold text-yellow-400">Día {day.dayNumber} <span className="ml-2 text-xs font-normal text-zinc-500">{day.exercises.length} ejercicios</span></h3>{day.exercises.length === 0 ? <p className="p-4 text-sm text-zinc-600">Descanso o sin ejercicios planificados.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-zinc-500"><tr><th className="p-3">#</th><th>Ejercicio</th><th>Grupo</th><th>Series × reps</th><th>Peso</th><th>Esfuerzo</th><th>Descanso</th><th>Observaciones</th></tr></thead><tbody>{day.exercises.map((exercise) => <tr key={exercise.id} className="border-t border-zinc-800"><td className="p-3 text-yellow-400">{exercise.order}</td><td className="font-medium">{exercise.videoUrl ? <a href={exercise.videoUrl} target="_blank" rel="noreferrer" className="text-yellow-300 underline decoration-yellow-400/40">{exercise.name}</a> : exercise.name}</td><td>{exercise.muscleGroup}</td><td>{exercise.sets} × {exercise.repetitions}</td><td>{exercise.weight === null ? "—" : `${exercise.weight} kg`}</td><td>{exercise.effortValue === null ? exercise.effortType : `${exercise.effortType} ${exercise.effortValue}`}</td><td>{exercise.restSeconds === null ? "—" : `${exercise.restSeconds} s`}</td><td className="max-w-48 text-zinc-400">{exercise.observations || "—"}</td></tr>)}</tbody></table></div>}</article>)}</div></section></div>;
}
