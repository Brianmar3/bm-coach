"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { inputClass } from "@/componentes/module-shell";
import type { AdminFollowUpData, AdminWorkoutExercise, AdminWorkoutSession } from "@/types/follow-up";

const emptyData: AdminFollowUpData = { sessions: [], routines: [], studentsWithoutTraining: [] };
const moneyNumber = (value: number | null, suffix = "") => value === null ? "—" : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value)}${suffix}`;
const showDate = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("es-AR");
const statusLabel = { pending: "Pendiente", in_progress: "En progreso", completed: "Finalizado" } as const;

export function RoutineFollowUp({ initialRoutineId = "", initialStudentId = "" }: { initialRoutineId?: string; initialStudentId?: string }) {
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("todos");
  const [dateFilter, setDateFilter] = useState("");
  const [routineId, setRoutineId] = useState(initialRoutineId);
  const [painOnly, setPainOnly] = useState(false);
  const [selected, setSelected] = useState<AdminWorkoutSession | null>(null);
  const [reply, setReply] = useState("");
  const [privateNote, setPrivateNote] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (initialStudentId) params.set("studentId", initialStudentId);
    const response = await fetch(`/api/seguimiento?${params}`, { cache: "no-store" });
    const body = await response.json() as AdminFollowUpData & { error?: string };
    if (!response.ok) throw new Error(body.error ?? "No se pudo cargar el seguimiento.");
    setData(body);
  }, [initialStudentId]);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(); if (initialStudentId) params.set("studentId", initialStudentId);
    fetch(`/api/seguimiento?${params}`, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const body = await response.json() as AdminFollowUpData & { error?: string };
      if (!response.ok) throw new Error(body.error);
      setData(body);
    }).catch((value: unknown) => { if (!(value instanceof Error && value.name === "AbortError")) setError(value instanceof Error ? value.message : "No se pudo cargar."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [initialStudentId]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    return data.sessions.filter((session) =>
      (!normalized || session.studentName.toLocaleLowerCase("es").includes(normalized)) &&
      (status === "todos" || session.status === status) &&
      (!dateFilter || session.date === dateFilter) &&
      (!routineId || session.routineId === routineId) &&
      (!painOnly || session.hasPain),
    );
  }, [data.sessions, dateFilter, painOnly, query, routineId, status]);

  async function sendFeedback(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true); setError("");
    try {
      const operations = [
        reply.trim() ? { body: reply, private: false } : null,
        privateNote.trim() ? { body: privateNote, private: true } : null,
        reviewed ? { reviewed: true } : null,
      ].filter(Boolean);
      for (const operation of operations) {
        const response = await fetch("/api/seguimiento", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: selected.id, ...operation }) });
        const body = await response.json() as { error?: string };
        if (!response.ok) throw new Error(body.error ?? "No se pudo guardar.");
      }
      setReply(""); setPrivateNote(""); setReviewed(false); await load();
    } catch (value) { setError(value instanceof Error ? value.message : "No se pudo guardar."); }
    finally { setSaving(false); }
  }

  return <section>
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}
    <div className="grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:grid-cols-2 xl:grid-cols-5">
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar alumno" className={inputClass} />
      <select value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass}><option value="todos">Todos los estados</option><option value="in_progress">En progreso</option><option value="completed">Finalizados</option><option value="pending">Pendientes</option></select>
      <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className={inputClass} />
      <select value={routineId} onChange={(event) => setRoutineId(event.target.value)} className={inputClass}><option value="">Todas las rutinas</option>{data.routines.map((routine) => <option key={routine.id} value={routine.id}>{routine.name}</option>)}</select>
      <label className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm"><input type="checkbox" checked={painOnly} onChange={(event) => setPainOnly(event.target.checked)} className="accent-yellow-400" /> Con dolor o molestias</label>
    </div>
    <div className="mt-5 grid gap-4 lg:grid-cols-2">{loading ? <p className="col-span-full rounded-2xl bg-zinc-900 p-10 text-center text-zinc-500">Cargando seguimiento…</p> : visible.length ? visible.map((session) => <SessionCard key={session.id} session={session} open={() => setSelected(session)} />) : <p className="col-span-full rounded-2xl border border-dashed border-zinc-700 p-10 text-center text-zinc-500">No hay sesiones que coincidan con los filtros.</p>}</div>
    {selected && <SessionDetail session={selected} close={() => setSelected(null)} reply={reply} setReply={setReply} privateNote={privateNote} setPrivateNote={setPrivateNote} reviewed={reviewed} setReviewed={setReviewed} saving={saving} submit={sendFeedback} />}
  </section>;
}

function SessionCard({ session, open }: { session: AdminWorkoutSession; open: () => void }) {
  const alerts = [session.hasPain ? "Dolor/molestia" : "", (session.difficulty ?? 0) >= 4 ? "Dificultad alta" : "", session.status !== "completed" ? "Sesión incompleta" : "", session.pendingComments ? `${session.pendingComments} comentario pendiente` : ""].filter(Boolean);
  return <button onClick={open} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-left transition hover:border-yellow-400/40"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{session.studentName}</h3><p className="mt-1 text-sm text-yellow-400">{session.routine} · Día {session.dayNumber}</p></div><span className={`rounded-full px-2 py-1 text-xs font-bold ${session.status === "completed" ? "bg-emerald-400/10 text-emerald-300" : "bg-yellow-400/10 text-yellow-300"}`}>{statusLabel[session.status]}</span></div><div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"><Value label="Fecha" value={showDate(session.date)} /><Value label="Duración" value={session.durationMinutes ? `${session.durationMinutes} min` : "—"} /><Value label="Ejercicios" value={String(session.exerciseCount)} /><Value label="Series hechas" value={String(session.completedSets)} /></div>{session.finalComment && <p className="mt-3 line-clamp-2 text-sm text-zinc-400">{session.finalComment}</p>}{alerts.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{alerts.map((alert) => <span key={alert} className="rounded-full bg-red-400/10 px-2 py-1 text-[10px] font-bold text-red-300">{alert}</span>)}</div>}<p className="mt-3 text-[10px] text-zinc-600">Actualizado {new Date(session.updatedAt).toLocaleString("es-AR")}</p></button>;
}

function SessionDetail({ session, close, reply, setReply, privateNote, setPrivateNote, reviewed, setReviewed, saving, submit }: { session: AdminWorkoutSession; close: () => void; reply: string; setReply: (value: string) => void; privateNote: string; setPrivateNote: (value: string) => void; reviewed: boolean; setReviewed: (value: boolean) => void; saving: boolean; submit: (event: FormEvent) => void }) {
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 p-3 sm:p-5"><section className="mx-auto my-3 max-w-5xl rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:my-8 sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-wider text-yellow-400">Detalle del entrenamiento</p><h2 className="mt-1 text-2xl font-bold">{session.studentName}</h2><p className="mt-1 text-zinc-400">{session.routine} · Día {session.dayNumber}</p></div><button onClick={close} className="text-zinc-400">Cerrar</button></div>
    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><Value label="Fecha" value={showDate(session.date)} /><Value label="Inicio" value={session.startTime} /><Value label="Duración" value={session.durationMinutes ? `${session.durationMinutes} min` : "—"} /><Value label="Estado" value={statusLabel[session.status]} /><Value label="Energía antes" value={moneyNumber(session.energyBefore, "/5")} /><Value label="Dificultad" value={moneyNumber(session.difficulty, "/5")} /><Value label="Energía después" value={moneyNumber(session.energyAfter, "/5")} /><Value label="Última actualización" value={new Date(session.updatedAt).toLocaleString("es-AR")} /></div>
    {(session.finalComment || session.hasPain) && <div className="mt-5 grid gap-3 sm:grid-cols-2">{session.finalComment && <Alert title="Comentario general" text={session.finalComment} />}{session.hasPain && <Alert title="Dolor o molestia informado" text={session.painDetails || "Sin detalle de zona."} danger />}</div>}
    <div className="mt-6 space-y-4">{session.exercises.map((exercise) => <ExerciseDetail key={exercise.id} exercise={exercise} />)}</div>
    <form onSubmit={submit} className="mt-6 rounded-2xl border border-yellow-400/20 bg-zinc-950 p-4"><h3 className="font-bold text-yellow-300">Devolución del entrenador</h3><textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={3} placeholder="Respuesta visible para el alumno" className={`${inputClass} mt-3`} /><textarea value={privateNote} onChange={(event) => setPrivateNote(event.target.value)} rows={2} placeholder="Nota privada (no visible para el alumno)" className={`${inputClass} mt-3 border-purple-400/30`} /><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} className="accent-yellow-400" /> Marcar comentarios de la sesión como revisados</label><button disabled={saving || (!reply.trim() && !privateNote.trim() && !reviewed)} className="mt-4 w-full rounded-xl bg-yellow-400 p-3 font-bold text-zinc-950 disabled:opacity-50">Enviar devolución</button></form>
  </section></div>;
}

function ExerciseDetail({ exercise }: { exercise: AdminWorkoutExercise }) {
  const currentBest = exercise.sets.filter((set) => set.completed).sort((left, right) => (right.weight ?? 0) - (left.weight ?? 0))[0];
  const comparison = exercise.previous && currentBest ? compare(exercise.previous, currentBest) : null;
  return <details open className="rounded-2xl border border-zinc-800 bg-zinc-950"><summary className="cursor-pointer list-none p-4"><div className="flex items-start justify-between"><div><h3 className="font-bold">{exercise.name}</h3><p className="mt-1 text-xs text-zinc-500">{exercise.targetSets} series · {exercise.targetRepetitions} reps · {exercise.restSeconds ?? "—"} s descanso</p></div>{comparison && <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${comparison.tone}`}>{comparison.label}</span>}</div></summary><div className="border-t border-zinc-800 p-4"><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Value label="Carga sugerida" value={moneyNumber(exercise.suggestedWeight, " kg")} /><Value label="Esfuerzo objetivo" value={exercise.targetEffort === null ? exercise.effortType : `${exercise.effortType} ${exercise.targetEffort}`} /><Value label="Series objetivo" value={String(exercise.targetSets)} /><Value label="Repeticiones" value={exercise.targetRepetitions} /></div>{exercise.coachInstructions && <Alert title="Indicaciones del entrenador" text={exercise.coachInstructions} />}{exercise.studentObservation && <Alert title="Observación del alumno" text={exercise.studentObservation} />}
    {exercise.previous && <p className="mt-4 rounded-xl bg-yellow-400/5 p-3 text-xs text-yellow-200">Sesión anterior ({showDate(exercise.previous.date)}): {moneyNumber(exercise.previous.weight, " kg")} · {moneyNumber(exercise.previous.repetitions, " reps")} · esfuerzo {moneyNumber(exercise.previous.effort)}</p>}
    <div className="mt-4 grid gap-2 sm:grid-cols-2">{exercise.sets.map((set) => <article key={set.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3"><div className="flex justify-between"><p className="font-bold">Serie {set.setNumber}</p><span className={set.completed ? "text-xs text-emerald-300" : "text-xs text-zinc-500"}>{set.completed ? "Completada" : "No completada"}</span></div><div className="mt-3 grid grid-cols-3 gap-2"><Value label="Peso" value={moneyNumber(set.weight, " kg")} /><Value label="Reps" value={moneyNumber(set.repetitions)} /><Value label="RIR/esfuerzo" value={moneyNumber(set.effort)} /></div>{set.observation && <p className="mt-2 text-xs text-zinc-400">{set.observation}</p>}</article>)}</div></div></details>;
}

function compare(previous: NonNullable<AdminWorkoutExercise["previous"]>, current: AdminWorkoutExercise["sets"][number]) {
  const weightChange = (current.weight ?? 0) - (previous.weight ?? 0); const repsChange = (current.repetitions ?? 0) - (previous.repetitions ?? 0);
  if (weightChange > 0) return { label: `Aumentó carga +${moneyNumber(weightChange, " kg")}`, tone: "bg-emerald-400/10 text-emerald-300" };
  if (weightChange < 0 || repsChange < -3) return { label: weightChange < 0 ? "Disminuyó carga" : "Bajaron repeticiones", tone: "bg-red-400/10 text-red-300" };
  if (repsChange > 0) return { label: `Mejoró repeticiones +${repsChange}`, tone: "bg-emerald-400/10 text-emerald-300" };
  return { label: "Mantuvo", tone: "bg-zinc-700 text-zinc-300" };
}
function Value({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-black/30 p-3"><p className="text-[10px] text-zinc-500">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>; }
function Alert({ title, text, danger = false }: { title: string; text: string; danger?: boolean }) { return <div className={`mt-3 rounded-xl p-3 ${danger ? "bg-red-400/10 text-red-200" : "bg-zinc-900 text-zinc-300"}`}><p className="text-xs font-bold">{title}</p><p className="mt-1 text-sm">{text}</p></div>; }
