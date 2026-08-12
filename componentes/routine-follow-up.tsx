"use client";
/* eslint-disable @next/next/no-img-element -- profile photos are validated object-storage URLs */

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { inputClass } from "@/componentes/module-shell";
import { DEFAULT_PROFILE_AVATAR } from "@/lib/profile-avatars";
import { routineTrainingLocation, type RoutineTrainingLocation } from "@/lib/routine-follow-up-filters";
import type { AdminFollowUpData, AdminStudentFollowUp, AdminWorkoutExercise, AdminWorkoutSession } from "@/types/follow-up";

const emptyData: AdminFollowUpData = { sessions: [], students: [], classSessions: [], routines: [], studentsWithoutTraining: [] };
const moneyNumber = (value: number | null, suffix = "") => value === null ? "—" : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value)}${suffix}`;
const showDate = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("es-AR");
const statusLabel = { pending: "Pendiente", in_progress: "En progreso", completed: "Finalizado" } as const;

export function RoutineFollowUp({ initialStudentId = "" }: { initialStudentId?: string }) {
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("todos");
  const [dateFilter, setDateFilter] = useState("");
  const [trainingLocation, setTrainingLocation] = useState<"all" | RoutineTrainingLocation>("all");
  const [painOnly, setPainOnly] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<AdminStudentFollowUp | null>(null);
  const [detailTab, setDetailTab] = useState<"resumen" | "sesiones" | "progreso" | "molestias">("resumen");
  const [selected, setSelected] = useState<AdminWorkoutSession | null>(null);
  const [reply, setReply] = useState("");
  const [privateNote, setPrivateNote] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");

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
    return data.students.filter((student) => {
      const sessions = data.sessions.filter((session) => session.studentId === student.studentId);
      const matchingSessions = sessions.filter((session) =>
        (status === "todos" || session.status === status) &&
        (!dateFilter || session.date === dateFilter));
      const hasSessionFilter = status !== "todos" || Boolean(dateFilter);
      return (!normalized || student.studentName.toLocaleLowerCase("es").includes(normalized))
        && (!hasSessionFilter || matchingSessions.length > 0)
        && (trainingLocation === "all" || routineTrainingLocation(student.activeRoutine?.location ?? "") === trainingLocation)
        && (!painOnly || Boolean(student.latestPainReport));
    });
  }, [data.sessions, data.students, dateFilter, painOnly, query, status, trainingLocation]);
  const attention = visible.filter((student) => student.latestPainReport || student.sessionCount === 0).slice(0, 5);

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

  async function deleteSession() {
    if (!selected || !window.confirm("Esta acción eliminará definitivamente este registro de entrenamiento y no se puede deshacer.")) return;
    setDeleting(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/seguimiento", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: selected.id }) });
      const body = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(body.error ?? "No se pudo eliminar el registro.");
      setData((current) => ({ ...current, sessions: current.sessions.filter((session) => session.id !== selected.id) }));
      setSelected(null); setNotice(body.message ?? "Registro eliminado correctamente.");
      await load();
    } catch (value) { setError(value instanceof Error ? value.message : "No se pudo eliminar el registro."); }
    finally { setDeleting(false); }
  }

  async function deleteAllForRoutine() {
    if (!selected?.routineId) return;
    const count = data.sessions.filter((session) => session.studentId === selected.studentId && session.routineId === selected.routineId).length;
    if (!window.confirm(`Se eliminarán ${count} registros de esta rutina para ${selected.studentName}. ¿Querés continuar?`)) return;
    if (!window.confirm("Confirmación final: esta acción no se puede deshacer.")) return;
    setDeleting(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/seguimiento", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deleteAll: true, studentId: selected.studentId, routineId: selected.routineId }) });
      const body = await response.json() as { error?: string; message?: string; deleted?: number };
      if (!response.ok) throw new Error(body.error ?? "No se pudieron eliminar los registros.");
      setData((current) => ({ ...current, sessions: current.sessions.filter((session) => session.studentId !== selected.studentId || session.routineId !== selected.routineId) }));
      setSelected(null); setNotice(body.message ?? `${body.deleted ?? count} registros eliminados.`);
      await load();
    } catch (value) { setError(value instanceof Error ? value.message : "No se pudieron eliminar los registros."); }
    finally { setDeleting(false); }
  }

  return <section>
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}
    {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-400/10 p-4 text-sm text-emerald-200">{notice}</p>}
    <div className="grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:grid-cols-2 xl:grid-cols-5">
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar alumno" className={inputClass} />
      <select value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass}><option value="todos">Todos los estados</option><option value="in_progress">En progreso</option><option value="completed">Finalizados</option><option value="pending">Pendientes</option></select>
      <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className={inputClass} />
      <select aria-label="Lugar de entrenamiento" value={trainingLocation} onChange={(event) => setTrainingLocation(event.target.value as "all" | RoutineTrainingLocation)} className={inputClass}><option value="all">Todos los lugares</option><option value="gym">Gimnasio</option><option value="studio">Salón</option><option value="home">Casa</option></select>
      <label className="flex min-h-11 items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm"><input type="checkbox" checked={painOnly} onChange={(event) => setPainOnly(event.target.checked)} className="accent-yellow-400" /> Con molestia activa</label>
    </div>
    {!loading && attention.length > 0 && <section className="mt-4 rounded-2xl border border-red-400/15 bg-red-400/[.035] p-3"><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black text-zinc-100">Necesitan atención · {attention.length}</h2><span className="text-[10px] text-zinc-500">Prioridades reales</span></div><div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{attention.map((student) => <button key={student.studentId} type="button" onClick={() => { setSelectedStudent(student); setDetailTab(student.latestPainReport ? "molestias" : "resumen"); }} className="min-h-11 rounded-xl border border-zinc-800 bg-black/25 px-3 py-2 text-left text-xs"><strong className="text-zinc-200">{student.studentName}</strong><span className="ml-2 text-zinc-500">— {student.latestPainReport ? "molestia reportada" : "sin registros"}</span></button>)}</div></section>}
    <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-800 bg-[#111]">{loading ? <p className="p-10 text-center text-zinc-500">Cargando seguimiento…</p> : visible.length ? <><div className="hidden grid-cols-[1.2fr_1.2fr_100px_80px_90px_90px_110px] gap-3 border-b border-zinc-800 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500 lg:grid"><span>Alumno</span><span>Rutina</span><span>Última sesión</span><span>Sesiones</span><span>Duración</span><span>Series</span><span>Estado</span></div><div className="divide-y divide-zinc-800">{visible.map((student) => <StudentFollowUpCard key={student.studentId} student={student} open={() => { setSelectedStudent(student); setDetailTab("resumen"); }} />)}</div></> : <p className="p-10 text-center text-zinc-500">No hay alumnos que coincidan con los filtros.</p>}</div>
    {selectedStudent && <StudentFollowUpDetail student={selectedStudent} sessions={data.sessions.filter((session) => session.studentId === selectedStudent.studentId)} tab={detailTab} setTab={setDetailTab} close={() => setSelectedStudent(null)} openSession={(session) => setSelected(session)} />}
    {selected && <SessionDetail session={selected} close={() => setSelected(null)} reply={reply} setReply={setReply} privateNote={privateNote} setPrivateNote={setPrivateNote} reviewed={reviewed} setReviewed={setReviewed} saving={saving} deleting={deleting} submit={sendFeedback} deleteSession={deleteSession} deleteAll={deleteAllForRoutine} />}
  </section>;
}

function StudentFollowUpCard({ student, open }: { student: AdminStudentFollowUp; open: () => void }) {
  const state = student.latestPainReport ? "Necesita atención" : student.sessionCount === 0 ? "Sin registros" : "Al día";
  return <button type="button" onClick={open} className="w-full p-4 text-left transition hover:bg-white/[.025]"><div className="flex items-start justify-between gap-3 lg:hidden"><div className="flex min-w-0 items-center gap-3"><img src={student.profileImageUrl || DEFAULT_PROFILE_AVATAR.src} alt="" className="size-10 shrink-0 rounded-full border border-yellow-400/20 object-cover" /><div className="min-w-0"><h3 className="truncate text-sm font-bold">{student.studentName}</h3><p className="truncate text-xs text-yellow-300">{student.activeRoutine?.name ?? "Sin rutina activa"}</p></div></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${student.latestPainReport ? "bg-red-400/10 text-red-300" : student.sessionCount ? "bg-emerald-400/10 text-emerald-300" : "bg-zinc-700 text-zinc-300"}`}>{state}</span></div><div className="mt-3 grid grid-cols-3 gap-2 text-xs lg:hidden"><span><small className="block text-zinc-500">Última</small>{student.latestSession ? showDate(student.latestSession.date) : "—"}</span><span><small className="block text-zinc-500">Sesiones</small>{student.sessionCount || "—"}</span><span><small className="block text-zinc-500">Promedio</small>{student.averageDuration ? `${student.averageDuration} min` : "—"}</span></div><div className="hidden min-h-[64px] grid-cols-[1.2fr_1.2fr_100px_80px_90px_90px_110px] items-center gap-3 lg:grid"><div className="flex min-w-0 items-center gap-3"><img src={student.profileImageUrl || DEFAULT_PROFILE_AVATAR.src} alt="" className="size-9 shrink-0 rounded-full border border-yellow-400/20 object-cover" /><strong className="truncate text-sm">{student.studentName}</strong></div><span className="truncate text-xs text-yellow-300">{student.activeRoutine?.name ?? "Sin rutina activa"}</span><span className="text-xs text-zinc-300">{student.latestSession ? showDate(student.latestSession.date) : "Sin registros"}</span><span className="text-xs text-zinc-300">{student.sessionCount || "—"}</span><span className="text-xs text-zinc-300">{student.averageDuration ? `${student.averageDuration} min` : "—"}</span><span className="text-xs text-zinc-300">{student.completedSets || "—"}</span><span className={`rounded-full px-2 py-1 text-center text-[10px] font-bold ${student.latestPainReport ? "bg-red-400/10 text-red-300" : student.sessionCount ? "bg-emerald-400/10 text-emerald-300" : "bg-zinc-700 text-zinc-300"}`}>{state}</span></div></button>;
}

function StudentFollowUpDetail({ student, sessions, tab, setTab, close, openSession }: { student: AdminStudentFollowUp; sessions: AdminWorkoutSession[]; tab: "resumen" | "sesiones" | "progreso" | "molestias"; setTab: (tab: "resumen" | "sesiones" | "progreso" | "molestias") => void; close: () => void; openSession: (session: AdminWorkoutSession) => void }) {
  const painSessions = sessions.filter((session) => session.hasPain);
  return <div className="fixed inset-0 z-40 overflow-y-auto bg-black/85 p-2 sm:p-5"><section className="mx-auto my-2 min-h-[calc(100dvh-1rem)] max-w-6xl rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:my-8 sm:min-h-0 sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-yellow-400">Seguimiento del alumno</p><h2 className="mt-1 text-2xl font-bold">{student.studentName}</h2><p className="mt-1 text-sm text-zinc-400">{student.activeRoutine?.name ?? "Sin rutina activa"}</p></div><button onClick={close} className="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800">Cerrar</button></div>
    <nav className="mt-5 flex gap-2 overflow-x-auto pb-1">{(["resumen", "sesiones", "progreso", "molestias"] as const).map((value) => <button key={value} onClick={() => setTab(value)} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-bold capitalize ${tab === value ? "bg-yellow-400 text-zinc-950" : "bg-zinc-800 text-zinc-300"}`}>{value}</button>)}</nav>
    {tab === "resumen" && <div className="mt-5"><div className="grid grid-cols-2 gap-3 sm:grid-cols-5"><Value label="Sesiones" value={student.sessionCount ? String(student.sessionCount) : "Sin registros"} /><Value label="Última sesión" value={student.latestSession ? showDate(student.latestSession.date) : "Sin registros"} /><Value label="Promedio" value={student.averageDuration ? `${student.averageDuration} min` : "Sin registros"} /><Value label="Ejercicios" value={student.exerciseCount ? String(student.exerciseCount) : "Sin registros"} /><Value label="Series" value={student.completedSets ? String(student.completedSets) : "Sin registros"} /></div>{student.activeRoutine && <div className="mt-4 rounded-xl bg-zinc-950 p-4"><p className="font-bold">{student.activeRoutine.name}</p><p className="mt-1 text-sm text-zinc-400">Estado: <span className="capitalize">{student.activeRoutine.status}</span>{student.activeRoutine.startDate ? ` · Inicio ${showDate(student.activeRoutine.startDate)}` : ""}</p></div>}</div>}
    {tab === "sesiones" && <div className="mt-5 space-y-3">{sessions.length ? sessions.map((session) => <button key={session.id} onClick={() => openSession(session)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-left"><div className="min-w-0"><p className="truncate font-semibold">{session.routine} · Día {session.dayNumber}</p><p className="mt-1 text-xs text-zinc-500">{showDate(session.date)} · {session.durationMinutes ? `${session.durationMinutes} min` : "Sin duración"} · {session.exerciseCount} ejercicios</p></div><span className="shrink-0 text-sm font-bold text-yellow-400">Ver detalle</span></button>) : <Empty text="No hay sesiones registradas." />}</div>}
    {tab === "progreso" && <div className="mt-5 rounded-xl bg-zinc-950 p-4"><p className="font-bold text-yellow-300">Progreso reciente</p><p className="mt-2 text-sm text-zinc-300">{student.recentProgress || (student.recentSessionCount ? `${student.recentSessionCount} sesiones completadas en las últimas 4 semanas.` : "Todavía no hay suficiente historial para comparar.")}</p></div>}
    {tab === "molestias" && <div className="mt-5 space-y-3">{painSessions.length ? painSessions.map((session) => <button key={session.id} onClick={() => openSession(session)} className="w-full rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-left"><p className="text-xs font-bold text-red-200">{showDate(session.date)} · {session.routine}</p><p className="mt-2 text-sm text-red-100">{session.painDetails || "Sin detalle informado."}</p></button>) : <Empty text="No hay molestias registradas." />}</div>}
  </section></div>;
}

function Empty({ text }: { text: string }) { return <p className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-500">{text}</p>; }

function SessionDetail({ session, close, reply, setReply, privateNote, setPrivateNote, reviewed, setReviewed, saving, deleting, submit, deleteSession, deleteAll }: { session: AdminWorkoutSession; close: () => void; reply: string; setReply: (value: string) => void; privateNote: string; setPrivateNote: (value: string) => void; reviewed: boolean; setReviewed: (value: boolean) => void; saving: boolean; deleting: boolean; submit: (event: FormEvent) => void; deleteSession: () => void; deleteAll: () => void }) {
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 p-3 sm:p-5"><section className="mx-auto my-3 max-w-5xl rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:my-8 sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-wider text-yellow-400">Detalle del entrenamiento</p><h2 className="mt-1 text-2xl font-bold">{session.studentName}</h2><p className="mt-1 text-zinc-400">{session.routine} · Día {session.dayNumber}</p></div><button onClick={close} className="text-zinc-400">Cerrar</button></div>
    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><Value label="Fecha" value={showDate(session.date)} /><Value label="Inicio" value={session.startTime} /><Value label="Duración" value={session.durationMinutes ? `${session.durationMinutes} min` : "—"} /><Value label="Estado" value={statusLabel[session.status]} /><Value label="Energía antes" value={moneyNumber(session.energyBefore, "/5")} /><Value label="Dificultad" value={moneyNumber(session.difficulty, "/5")} /><Value label="Energía después" value={moneyNumber(session.energyAfter, "/5")} /><Value label="Última actualización" value={new Date(session.updatedAt).toLocaleString("es-AR")} /></div>
    {(session.finalComment || session.hasPain) && <div className="mt-5 grid gap-3 sm:grid-cols-2">{session.finalComment && <Alert title="Comentario general" text={session.finalComment} />}{session.hasPain && <Alert title="Dolor o molestia informado" text={session.painDetails || "Sin detalle de zona."} danger />}</div>}
    <div className="mt-6 space-y-4">{session.exercises.map((exercise) => <ExerciseDetail key={exercise.id} exercise={exercise} />)}</div>
    <form onSubmit={submit} className="mt-6 rounded-2xl border border-yellow-400/20 bg-zinc-950 p-4"><h3 className="font-bold text-yellow-300">Devolución del entrenador</h3><textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={3} placeholder="Respuesta visible para el alumno" className={`${inputClass} mt-3`} /><textarea value={privateNote} onChange={(event) => setPrivateNote(event.target.value)} rows={2} placeholder="Nota privada (no visible para el alumno)" className={`${inputClass} mt-3 border-purple-400/30`} /><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} className="accent-yellow-400" /> Marcar comentarios de la sesión como revisados</label><button disabled={saving || (!reply.trim() && !privateNote.trim() && !reviewed)} className="mt-4 w-full rounded-xl bg-yellow-400 p-3 font-bold text-zinc-950 disabled:opacity-50">Enviar devolución</button></form>
    <div className="mt-5 flex flex-col gap-2 rounded-2xl border border-red-400/20 bg-red-400/5 p-4 sm:flex-row"><button disabled={deleting} onClick={deleteSession} className="rounded-xl border border-red-400/40 px-4 py-3 text-sm font-bold text-red-300 disabled:opacity-50">{deleting ? "Eliminando…" : "Eliminar registro"}</button>{session.routineId && <button disabled={deleting} onClick={deleteAll} className="rounded-xl bg-red-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Eliminarlos todos</button>}</div>
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
