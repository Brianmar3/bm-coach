"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ModuleShell, inputClass } from "@/componentes/module-shell";
import { RoutineFollowUp } from "@/componentes/routine-follow-up";
import type { Student, TrainingEffortType, TrainingExercise, TrainingRoutine, TrainingRoutineLevel, TrainingRoutineStatus } from "@/types/gestion";

type ExerciseDraft = Omit<TrainingExercise, "id"> & { id?: string; clientId: string };
type DayDraft = { id?: string; dayNumber: number; exercises: ExerciseDraft[] };
type RoutineDraft = { name: string; objective: string; level: TrainingRoutineLevel; status: TrainingRoutineStatus; studentIds: string[]; days: DayDraft[] };

const objectives = ["Hipertrofia", "Fuerza", "Descenso de grasa", "Rehabilitación", "Funcional", "Resistencia", "Movilidad"];
const levels: TrainingRoutineLevel[] = ["principiante", "intermedio", "avanzado"];
const statuses: TrainingRoutineStatus[] = ["activa", "archivada"];
const muscleGroups = ["Pecho", "Espalda", "Hombros", "Bíceps", "Tríceps", "Cuádriceps", "Isquiotibiales", "Glúteos", "Gemelos", "Core", "Cuerpo completo", "Movilidad"];

function newExercise(order: number): ExerciseDraft {
  return { clientId: crypto.randomUUID(), name: "", muscleGroup: "", sets: 3, repetitions: "10-12", weight: null, effortType: "RPE", effortValue: null, restSeconds: 90, observations: "", videoUrl: "", order };
}

function blankRoutine(studentId = ""): RoutineDraft {
  return { name: "", objective: "Hipertrofia", level: "principiante", status: "activa", studentIds: studentId ? [studentId] : [], days: Array.from({ length: 7 }, (_, index) => ({ dayNumber: index + 1, exercises: [] })) };
}

function routineDraft(routine: TrainingRoutine): RoutineDraft {
  return {
    name: routine.name,
    objective: routine.objective,
    level: routine.level,
    status: routine.status,
    studentIds: routine.studentIds,
    days: Array.from({ length: 7 }, (_, index) => {
      const stored = routine.days.find((day) => day.dayNumber === index + 1);
      return { id: stored?.id, dayNumber: index + 1, exercises: (stored?.exercises ?? []).map((exercise) => ({ ...exercise, clientId: crypto.randomUUID() })) };
    }),
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
  const [activeTab, setActiveTab] = useState<"rutinas" | "asignaciones" | "seguimiento">(() => {
    if (typeof window === "undefined") return "rutinas";
    const requested = new URLSearchParams(window.location.search).get("tab");
    return requested === "asignaciones" || requested === "seguimiento" ? requested : "rutinas";
  });
  const [trackingRoutineId, setTrackingRoutineId] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("routineId") ?? "");
  const [trackingStudentId] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("studentId") ?? "");
  const [items, setItems] = useState<TrainingRoutine[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [query, setQuery] = useState("");
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
  const [error, setError] = useState("");

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
    return items.filter((routine) => (!normalized || `${routine.name} ${routine.objective} ${routine.students.map((student) => student.name).join(" ")}`.toLocaleLowerCase("es").includes(normalized)) && (objectiveFilter === "todos" || routine.objective === objectiveFilter) && (studentFilter === "todos" || routine.studentIds.includes(studentFilter)));
  }, [items, objectiveFilter, query, studentFilter]);

  function begin(routine?: TrainingRoutine) {
    if (!routine && students.length === 0) { setError("Primero necesitás crear un alumno real para asignar una rutina."); return; }
    setEditing(routine ?? null);
    setForm(routine ? routineDraft(routine) : blankRoutine(students[0].id));
    setActiveDay(1);
    setError("");
    setOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.objective.trim() || form.studentIds.length === 0) { setError("Completá nombre, objetivo y al menos un alumno."); return; }
    const payload = { ...form, days: form.days.map((day) => ({ id: day.id, dayNumber: day.dayNumber, exercises: [...day.exercises].sort((a, b) => a.order - b.order).map((exercise, index) => ({ id: exercise.id, name: exercise.name, muscleGroup: exercise.muscleGroup, sets: exercise.sets, repetitions: exercise.repetitions, weight: exercise.weight, effortType: exercise.effortType, effortValue: exercise.effortValue, restSeconds: exercise.restSeconds, observations: exercise.observations, videoUrl: exercise.videoUrl, order: index + 1 })) })) };
    setSaving(true); setError("");
    try {
      const response = await fetch(editing ? `/api/rutinas/${editing.id}` : "/api/rutinas", { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo guardar la rutina."));
      const saved = (await response.json()) as TrainingRoutine;
      setItems((current) => editing ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      setOpen(false); setEditing(null);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la rutina en Neon."); }
    finally { setSaving(false); }
  }

  async function duplicate(routine: TrainingRoutine) {
    setDuplicatingId(routine.id); setError("");
    try {
      const response = await fetch(`/api/rutinas/${routine.id}/duplicar`, { method: "POST" });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo duplicar la rutina."));
      const copy = (await response.json()) as TrainingRoutine;
      setItems((current) => [copy, ...current]);
    } catch (duplicateError) { setError(duplicateError instanceof Error ? duplicateError.message : "No se pudo duplicar la rutina en Neon."); }
    finally { setDuplicatingId(""); }
  }

  async function remove(routine: TrainingRoutine) {
    if (!window.confirm(`¿Eliminar la rutina “${routine.name}”? Se eliminarán también sus días y ejercicios.`)) return;
    setError("");
    try {
      const response = await fetch(`/api/rutinas/${routine.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo eliminar la rutina."));
      setItems((current) => current.filter((item) => item.id !== routine.id));
      if (viewing?.id === routine.id) setViewing(null);
    } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar la rutina de Neon."); }
  }

  return <ModuleShell title="Rutinas" subtitle="Diseñá planes personalizados, organizados por días y asignados a alumnos reales." action={activeTab === "seguimiento" ? null : <button onClick={() => begin()} className="rounded-xl bg-yellow-400 px-4 py-3 font-bold text-zinc-950 transition hover:bg-yellow-300">+ Crear rutina</button>}>
    {error && !open && <p role="alert" className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}
    <nav className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-2">{([["rutinas", "Rutinas"], ["asignaciones", "Asignaciones"], ["seguimiento", "Seguimiento de alumnos"]] as const).map(([value, title]) => <button key={value} onClick={() => { setActiveTab(value); if (value !== "seguimiento") setTrackingRoutineId(""); }} className={`shrink-0 rounded-xl px-4 py-3 text-sm font-bold ${activeTab === value ? "bg-yellow-400 text-zinc-950" : "text-zinc-400 hover:bg-zinc-800"}`}>{title}</button>)}</nav>
    {activeTab === "seguimiento" ? <RoutineFollowUp initialRoutineId={trackingRoutineId} initialStudentId={trackingStudentId} /> : <>
    <section className="grid gap-4 sm:grid-cols-3"><Summary label="Rutinas activas" value={items.filter((item) => item.status === "activa").length} /><Summary label="Alumnos con rutina" value={new Set(items.flatMap((item) => item.studentIds)).size} /><Summary label="Ejercicios planificados" value={items.reduce((total, item) => total + exerciseCount(item), 0)} /></section>
    <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><div className="grid gap-3 md:grid-cols-3"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar rutina, objetivo o alumno" className={inputClass} /><select value={objectiveFilter} onChange={(event) => setObjectiveFilter(event.target.value)} className={inputClass}><option value="todos">Todos los objetivos</option>{objectiveOptions.map((objective) => <option key={objective}>{objective}</option>)}</select><select value={studentFilter} onChange={(event) => setStudentFilter(event.target.value)} className={inputClass}><option value="todos">Todos los alumnos</option>{students.map((student) => <option key={student.id} value={student.id}>{student.firstName} {student.lastName}</option>)}</select></div></section>
    <section className="mt-6 grid gap-4 lg:grid-cols-2">{!ready ? <p className="col-span-full rounded-2xl border border-zinc-800 bg-zinc-900 p-12 text-center text-zinc-500">Cargando rutinas…</p> : visible.length === 0 ? <p className="col-span-full rounded-2xl border border-zinc-800 bg-zinc-900 p-12 text-center text-zinc-500">No hay rutinas que coincidan con los filtros.</p> : visible.map((routine) => <RoutineCard key={routine.id} routine={routine} view={() => { setTrackingRoutineId(routine.id); setActiveTab("seguimiento"); }} edit={() => begin(routine)} duplicate={() => duplicate(routine)} remove={() => remove(routine)} duplicating={duplicatingId === routine.id} />)}</section>
    </>}
    {open && <RoutineEditor form={form} setForm={setForm} students={students} activeDay={activeDay} setActiveDay={setActiveDay} error={error} close={() => setOpen(false)} submit={submit} editing={Boolean(editing)} saving={saving} />}
    {viewing && <RoutineDetail routine={viewing} close={() => setViewing(null)} />}
  </ModuleShell>;
}

function Summary({ label: title, value }: { label: string; value: number }) { return <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><p className="text-sm text-zinc-400">{title}</p><p className="mt-1 text-3xl font-bold text-yellow-400">{value}</p></article>; }

function RoutineCard({ routine, view, edit, duplicate, remove, duplicating }: { routine: TrainingRoutine; view: () => void; edit: () => void; duplicate: () => void; remove: () => void; duplicating: boolean }) {
  return <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-yellow-400/40"><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">{routine.name}</h2><span className={`rounded-full px-2 py-1 text-xs font-bold ${routine.status === "activa" ? "bg-emerald-400/10 text-emerald-300" : "bg-zinc-700 text-zinc-300"}`}>{label(routine.status)}</span></div><p className="mt-1 text-sm text-yellow-400">{routine.objective} · {label(routine.level)}</p></div><span className="text-xs text-zinc-500">{showDate(routine.createdAt)}</span></div><div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3"><Info label="Días con ejercicios" value={`${activeDays(routine)}/7`} /><Info label="Ejercicios" value={String(exerciseCount(routine))} /><Info label="Alumnos" value={String(routine.students.length)} /></div><p className="mt-4 truncate text-sm text-zinc-400">{routine.students.map((student) => student.name).join(" · ")}</p><div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold"><button onClick={view} className="text-yellow-400">Ver</button><button onClick={edit} className="text-yellow-400">Editar</button><button onClick={duplicate} disabled={duplicating} className="text-sky-300 disabled:opacity-50">{duplicating ? "Duplicando…" : "Duplicar"}</button><button onClick={remove} className="text-red-300">Eliminar</button></div></article>;
}

function Info({ label: title, value }: { label: string; value: string }) { return <div className="rounded-xl bg-zinc-950 p-3"><p className="text-xs text-zinc-500">{title}</p><p className="mt-1 font-semibold">{value}</p></div>; }

function RoutineEditor({ form, setForm, students, activeDay, setActiveDay, error, close, submit, editing, saving }: { form: RoutineDraft; setForm: (form: RoutineDraft) => void; students: Student[]; activeDay: number; setActiveDay: (day: number) => void; error: string; close: () => void; submit: (event: FormEvent) => void; editing: boolean; saving: boolean }) {
  const currentDay = form.days.find((day) => day.dayNumber === activeDay) ?? form.days[0];
  function updateDay(updater: (day: DayDraft) => DayDraft) { setForm({ ...form, days: form.days.map((day) => day.dayNumber === activeDay ? updater(day) : day) }); }
  function addExercise() { updateDay((day) => ({ ...day, exercises: [...day.exercises, newExercise(day.exercises.length + 1)] })); }
  function updateExercise<K extends keyof ExerciseDraft>(clientId: string, key: K, value: ExerciseDraft[K]) { updateDay((day) => ({ ...day, exercises: day.exercises.map((exercise) => exercise.clientId === clientId ? { ...exercise, [key]: value } : exercise) })); }
  function removeExercise(clientId: string) { updateDay((day) => ({ ...day, exercises: day.exercises.filter((exercise) => exercise.clientId !== clientId).map((exercise, index) => ({ ...exercise, order: index + 1 })) })); }
  function moveExercise(clientId: string, direction: -1 | 1) { updateDay((day) => { const exercises = [...day.exercises].sort((a, b) => a.order - b.order); const index = exercises.findIndex((exercise) => exercise.clientId === clientId); const target = index + direction; if (index < 0 || target < 0 || target >= exercises.length) return day; [exercises[index], exercises[target]] = [exercises[target], exercises[index]]; return { ...day, exercises: exercises.map((exercise, order) => ({ ...exercise, order: order + 1 })) }; }); }
  function toggleStudent(studentId: string) { setForm({ ...form, studentIds: form.studentIds.includes(studentId) ? form.studentIds.filter((id) => id !== studentId) : [...form.studentIds, studentId] }); }
  return <div className="fixed inset-0 z-50 overflow-auto bg-black/80 p-4"><form onSubmit={submit} className="mx-auto my-6 w-full max-w-7xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-white"><div className="flex justify-between gap-4"><div><h2 className="text-xl font-bold">{editing ? "Editar rutina" : "Nueva rutina"}</h2><p className="mt-1 text-sm text-zinc-400">Organizá hasta siete días con todos los ejercicios necesarios.</p></div><button type="button" onClick={close} className="self-start text-zinc-400">Cerrar</button></div>{error && <p role="alert" className="mt-4 rounded-lg bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
    <div className="mt-5 grid gap-4 md:grid-cols-4"><label className="md:col-span-2">Nombre<input required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={`${inputClass} mt-1`} /></label><label>Objetivo<input required list="routine-objectives" maxLength={100} value={form.objective} onChange={(event) => setForm({ ...form, objective: event.target.value })} className={`${inputClass} mt-1`} /><datalist id="routine-objectives">{objectives.map((objective) => <option key={objective} value={objective} />)}</datalist></label><label>Nivel<select value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value as TrainingRoutineLevel })} className={`${inputClass} mt-1`}>{levels.map((level) => <option key={level} value={level}>{label(level)}</option>)}</select></label><label>Estado<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as TrainingRoutineStatus })} className={`${inputClass} mt-1`}>{statuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select></label></div>
    <fieldset className="mt-6"><legend className="font-semibold text-yellow-400">Alumnos asignados</legend><div className="mt-3 flex flex-wrap gap-2">{students.map((student) => { const selected = form.studentIds.includes(student.id); return <label key={student.id} className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${selected ? "border-yellow-400 bg-yellow-400/10 text-yellow-300" : "border-zinc-700 text-zinc-400"}`}><input type="checkbox" checked={selected} onChange={() => toggleStudent(student.id)} className="sr-only" />{student.firstName} {student.lastName}</label>; })}</div></fieldset>
    <div className="mt-7 flex gap-2 overflow-x-auto pb-2">{form.days.map((day) => <button type="button" key={day.dayNumber} onClick={() => setActiveDay(day.dayNumber)} className={`min-w-24 rounded-xl px-3 py-3 text-sm ${activeDay === day.dayNumber ? "bg-yellow-400 font-bold text-zinc-950" : "bg-zinc-800 text-zinc-300"}`}>Día {day.dayNumber}<span className="block text-xs opacity-70">{day.exercises.length} ejercicios</span></button>)}</div>
    <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4"><div className="flex items-center justify-between"><div><h3 className="font-bold">Día {activeDay}</h3><p className="text-sm text-zinc-500">El orden puede editarse o ajustarse con las flechas.</p></div><button type="button" onClick={addExercise} className="rounded-lg bg-yellow-400 px-3 py-2 text-sm font-bold text-zinc-950">+ Ejercicio</button></div><div className="mt-4 space-y-4">{currentDay.exercises.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-500">Este día todavía no tiene ejercicios.</p> : [...currentDay.exercises].sort((a, b) => a.order - b.order).map((exercise) => <ExerciseEditor key={exercise.clientId} exercise={exercise} update={(key, value) => updateExercise(exercise.clientId, key, value)} move={(direction) => moveExercise(exercise.clientId, direction)} remove={() => removeExercise(exercise.clientId)} />)}</div></section>
    <button disabled={saving} className="mt-6 w-full rounded-xl bg-yellow-400 px-5 py-3 font-bold text-zinc-950 transition hover:bg-yellow-300 disabled:opacity-60">{saving ? "Guardando…" : "Guardar rutina"}</button>
  </form></div>;
}

function ExerciseEditor({ exercise, update, move, remove }: { exercise: ExerciseDraft; update: <K extends keyof ExerciseDraft>(key: K, value: ExerciseDraft[K]) => void; move: (direction: -1 | 1) => void; remove: () => void }) {
  return <article className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-yellow-400 font-bold text-zinc-950">{exercise.order}</span><span className="text-sm text-zinc-500">Orden</span><button type="button" onClick={() => move(-1)} className="rounded bg-zinc-800 px-2 py-1 text-zinc-300" aria-label="Mover ejercicio arriba">↑</button><button type="button" onClick={() => move(1)} className="rounded bg-zinc-800 px-2 py-1 text-zinc-300" aria-label="Mover ejercicio abajo">↓</button></div><button type="button" onClick={remove} className="text-sm text-red-300">Eliminar ejercicio</button></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6"><label className="xl:col-span-2">Ejercicio<input required value={exercise.name} onChange={(event) => update("name", event.target.value)} className={`${inputClass} mt-1`} /></label><label>Grupo muscular<input required list="muscle-groups" value={exercise.muscleGroup} onChange={(event) => update("muscleGroup", event.target.value)} className={`${inputClass} mt-1`} /><datalist id="muscle-groups">{muscleGroups.map((group) => <option key={group} value={group} />)}</datalist></label><label>Series<input required type="number" min="1" max="100" value={exercise.sets} onChange={(event) => update("sets", Number(event.target.value))} className={`${inputClass} mt-1`} /></label><label>Repeticiones<input required maxLength={50} value={exercise.repetitions} onChange={(event) => update("repetitions", event.target.value)} className={`${inputClass} mt-1`} /></label><label>Peso (kg)<input type="number" min="0" max="1000" step="0.25" value={exercise.weight ?? ""} onChange={(event) => update("weight", event.target.value === "" ? null : Number(event.target.value))} className={`${inputClass} mt-1`} /></label><label>Esfuerzo<select value={exercise.effortType} onChange={(event) => update("effortType", event.target.value as TrainingEffortType)} className={`${inputClass} mt-1`}><option>RPE</option><option>RIR</option></select></label><label>Valor RPE/RIR<input type="number" min="0" max="10" step="0.5" value={exercise.effortValue ?? ""} onChange={(event) => update("effortValue", event.target.value === "" ? null : Number(event.target.value))} className={`${inputClass} mt-1`} /></label><label>Descanso (seg.)<input type="number" min="0" max="3600" value={exercise.restSeconds ?? ""} onChange={(event) => update("restSeconds", event.target.value === "" ? null : Number(event.target.value))} className={`${inputClass} mt-1`} /></label><label>Orden<input type="number" min="1" max="999" value={exercise.order} onChange={(event) => update("order", Number(event.target.value))} className={`${inputClass} mt-1`} /></label><label className="xl:col-span-2">Video explicativo<input type="url" placeholder="https://…" value={exercise.videoUrl} onChange={(event) => update("videoUrl", event.target.value)} className={`${inputClass} mt-1`} /></label><label className="md:col-span-2 xl:col-span-6">Observaciones<textarea maxLength={1000} rows={2} value={exercise.observations} onChange={(event) => update("observations", event.target.value)} className={`${inputClass} mt-1`} /></label></div></article>;
}

function RoutineDetail({ routine, close }: { routine: TrainingRoutine; close: () => void }) {
  return <div className="fixed inset-0 z-50 overflow-auto bg-black/80 p-4"><section className="mx-auto my-8 w-full max-w-5xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-white"><div className="flex justify-between gap-4"><div><h2 className="text-2xl font-bold">{routine.name}</h2><p className="mt-1 text-yellow-400">{routine.objective} · {label(routine.level)} · {label(routine.status)}</p><p className="mt-2 text-sm text-zinc-500">Asignada a {routine.students.map((student) => student.name).join(" · ")}</p></div><button onClick={close} className="self-start text-zinc-400">Cerrar</button></div><div className="mt-6 space-y-4">{routine.days.map((day) => <article key={day.id} className="rounded-xl border border-zinc-800"><h3 className="border-b border-zinc-800 p-4 font-bold text-yellow-400">Día {day.dayNumber} <span className="ml-2 text-xs font-normal text-zinc-500">{day.exercises.length} ejercicios</span></h3>{day.exercises.length === 0 ? <p className="p-4 text-sm text-zinc-600">Descanso o sin ejercicios planificados.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-zinc-500"><tr><th className="p-3">#</th><th>Ejercicio</th><th>Grupo</th><th>Series × reps</th><th>Peso</th><th>Esfuerzo</th><th>Descanso</th><th>Observaciones</th></tr></thead><tbody>{day.exercises.map((exercise) => <tr key={exercise.id} className="border-t border-zinc-800"><td className="p-3 text-yellow-400">{exercise.order}</td><td className="font-medium">{exercise.videoUrl ? <a href={exercise.videoUrl} target="_blank" rel="noreferrer" className="text-yellow-300 underline decoration-yellow-400/40">{exercise.name}</a> : exercise.name}</td><td>{exercise.muscleGroup}</td><td>{exercise.sets} × {exercise.repetitions}</td><td>{exercise.weight === null ? "—" : `${exercise.weight} kg`}</td><td>{exercise.effortValue === null ? exercise.effortType : `${exercise.effortType} ${exercise.effortValue}`}</td><td>{exercise.restSeconds === null ? "—" : `${exercise.restSeconds} s`}</td><td className="max-w-48 text-zinc-400">{exercise.observations || "—"}</td></tr>)}</tbody></table></div>}</article>)}</div></section></div>;
}
