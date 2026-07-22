"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ModuleShell, inputClass } from "@/componentes/module-shell";
import type { AttendanceGeneralSummary, AttendanceRoster, AttendanceRosterStudent, AttendanceStatus, Student, WeeklyClassDay, WeeklyClassSchedule } from "@/types/gestion";

const DAY_FROM_JS: Partial<Record<number, WeeklyClassDay>> = { 1: "MONDAY", 2: "TUESDAY", 3: "WEDNESDAY", 4: "THURSDAY", 5: "FRIDAY" };
const DAY_LABEL: Record<WeeklyClassDay, string> = { MONDAY: "Lunes", TUESDAY: "Martes", WEDNESDAY: "Miércoles", THURSDAY: "Jueves", FRIDAY: "Viernes" };
const STATUS_LABEL: Record<AttendanceStatus, string> = { presente: "Presente", ausente: "Ausente", justificado: "Justificado" };
const STATUS_OPTIONS: AttendanceStatus[] = ["presente", "ausente", "justificado"];

function todayKey() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date()); }
function dateDay(value: string) { return DAY_FROM_JS[new Date(`${value}T12:00:00`).getDay()] ?? null; }
function scheduleLabel(schedule: WeeklyClassSchedule) { return `${DAY_LABEL[schedule.dayOfWeek]} ${schedule.startTime}–${schedule.endTime} · ${schedule.classType}${schedule.active ? "" : " (inactivo)"}`; }
async function responseError(response: Response, fallback: string) { try { return ((await response.json()) as { error?: string }).error ?? fallback; } catch { return fallback; } }

export default function AsistenciasPage() {
  const [date, setDate] = useState(todayKey());
  const [schedules, setSchedules] = useState<WeeklyClassSchedule[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [scheduleId, setScheduleId] = useState("");
  const [roster, setRoster] = useState<AttendanceRosterStudent[]>([]);
  const [summary, setSummary] = useState<AttendanceGeneralSummary | null>(null);
  const [studentQuery, setStudentQuery] = useState("");
  const [ready, setReady] = useState(false);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/clases", { cache: "no-store", signal: controller.signal }).then(async (response) => { if (!response.ok) throw new Error(await responseError(response, "No se pudieron cargar los horarios.")); return response.json() as Promise<WeeklyClassSchedule[]>; }),
      fetch("/api/alumnos", { cache: "no-store", signal: controller.signal }).then(async (response) => { if (!response.ok) throw new Error(await responseError(response, "No se pudieron cargar los alumnos.")); return response.json() as Promise<Student[]>; }),
    ]).then(([weeklySchedules, realStudents]) => { setSchedules(weeklySchedules); setStudents(realStudents); }).catch((loadError: unknown) => { if (loadError instanceof Error && loadError.name !== "AbortError") setError(loadError.message); }).finally(() => setReady(true));
    return () => controller.abort();
  }, []);

  const dateSchedules = useMemo(() => {
    const day = dateDay(date);
    return schedules.filter((schedule) => schedule.dayOfWeek === day).sort((left, right) => left.startTime.localeCompare(right.startTime));
  }, [date, schedules]);
  const effectiveScheduleId = dateSchedules.some((schedule) => schedule.id === scheduleId) ? scheduleId : dateSchedules.find((schedule) => schedule.active)?.id ?? dateSchedules[0]?.id ?? "";

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/asistencias/resumen?date=${date}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(await responseError(response, "No se pudo cargar el resumen.")); return response.json() as Promise<AttendanceGeneralSummary>; })
      .then(setSummary).catch((summaryError: unknown) => { if (summaryError instanceof Error && summaryError.name !== "AbortError") setError(summaryError.message); });
    return () => controller.abort();
  }, [date]);

  const loadRoster = useCallback((targetScheduleId: string, targetDate = date) => {
    const controller = new AbortController();
    if (!targetScheduleId) {
      fetch(`/api/asistencias?date=${targetDate}&scheduleId=`, { cache: "no-store", signal: controller.signal })
        .then(async (response) => { if (!response.ok) throw new Error(await responseError(response, "No se pudo cargar la asistencia.")); return response.json() as Promise<AttendanceRoster>; })
        .then((result) => { setRoster(result.students); })
        .catch((rosterError: unknown) => { if (rosterError instanceof Error && rosterError.name !== "AbortError") { setRoster([]); setError(rosterError.message); } })
        .finally(() => setLoadingRoster(false));
      return controller;
    }
    fetch(`/api/asistencias?date=${targetDate}&scheduleId=${encodeURIComponent(targetScheduleId)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(await responseError(response, "No se pudo cargar la asistencia.")); return response.json() as Promise<AttendanceRoster>; })
      .then((result) => { setRoster(result.students); })
      .catch((rosterError: unknown) => { if (rosterError instanceof Error && rosterError.name !== "AbortError") { setRoster([]); setError(rosterError.message); } })
      .finally(() => setLoadingRoster(false));
    return controller;
  }, [date]);

  useEffect(() => {
    const controller = loadRoster(effectiveScheduleId || "", date);
    return () => controller.abort();
  }, [date, effectiveScheduleId, loadRoster]);

  const rosterStudents = useMemo(() => {
    const normalized = studentQuery.trim().toLocaleLowerCase("es");
    if (!normalized) return roster;
    return roster.filter((student) => `${student.name} ${student.phone}`.toLocaleLowerCase("es").includes(normalized));
  }, [roster, studentQuery]);

  const addableStudents = useMemo(() => {
    const existing = new Set(roster.map((student) => student.id));
    const normalized = studentQuery.trim().toLocaleLowerCase("es");
    if (!normalized) return [];
    return students.filter((student) => student.status === "activo" && !existing.has(student.id) && `${student.firstName} ${student.lastName} ${student.phone}`.toLocaleLowerCase("es").includes(normalized)).slice(0, 10);
  }, [roster, studentQuery, students]);

  function setStatus(studentId: string, status: AttendanceStatus) { setRoster((current) => current.map((student) => student.id === studentId ? { ...student, status } : student)); setSaved(false); }
  function markAllPresent() { setRoster((current) => current.map((student) => ({ ...student, status: "presente" }))); setSaved(false); }
  function addExceptional(student: Student) { setRoster((current) => [...current, { id: student.id, name: `${student.firstName} ${student.lastName}`.trim(), phone: student.phone, assigned: false, status: null, attendanceId: null }].sort((left, right) => left.name.localeCompare(right.name, "es"))); setStudentQuery(""); setSaved(false); }
  function changeDate(value: string) { setDate(value); setError(""); setSaved(false); setLoadingRoster(true); loadRoster(effectiveScheduleId || "", value); }
  function changeSchedule(value: string) { setScheduleId(value); setError(""); setSaved(false); setLoadingRoster(true); loadRoster(value, date); }

  async function save() {
    const records = roster.filter((student) => student.status).map((student) => ({ studentId: student.id, status: student.status }));
    if (!date) { setError("Seleccioná una fecha válida."); return; }
    if (!records.length) { setError("Marcá al menos un alumno con un estado."); return; }
    setSaving(true); setError(""); setSaved(false);
    try {
      const response = await fetch("/api/asistencias", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, scheduleId: effectiveScheduleId || null, records }) });
      if (!response.ok) throw new Error(await responseError(response, "No se pudieron guardar las asistencias."));
      const [updatedRoster, updatedSummary] = await Promise.all([
        fetch(`/api/asistencias?date=${date}&scheduleId=${encodeURIComponent(effectiveScheduleId || "")}`, { cache: "no-store" }).then((response) => response.json() as Promise<AttendanceRoster>),
        fetch(`/api/asistencias/resumen?date=${date}`, { cache: "no-store" }).then((response) => response.json() as Promise<AttendanceGeneralSummary>),
      ]);
      setRoster(updatedRoster.students); setSummary(updatedSummary); setSaved(true);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "No se pudieron guardar las asistencias."); }
    finally { setSaving(false); }
  }

  return (
    <ModuleShell title="Asistencias" subtitle="Registro rápido para celular: fecha, búsqueda y estados con un toque." action={<button onClick={save} disabled={saving || !date} className="rounded-xl bg-yellow-400 px-4 py-3 font-bold text-zinc-950 disabled:opacity-50">{saving ? "Guardando…" : "Guardar"}</button>}>
      {error && <p role="alert" className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}
      {saved && <p className="mb-5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">Asistencias guardadas correctamente.</p>}
      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><SummaryCard label="Presentes hoy" value={`${summary?.today.present ?? 0}/${summary?.today.total ?? 0}`} /><SummaryCard label="Ausentes hoy" value={summary?.today.absent ?? 0} tone="red" /><SummaryCard label="Justificados hoy" value={summary?.today.justified ?? 0} /><SummaryCard label="Asistencia mensual" value={`${summary?.monthlyPercentage ?? 0}%`} /></section>
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="grid gap-3 border-b border-zinc-800 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"><label className="text-sm">Fecha<input type="date" value={date} onChange={(event) => changeDate(event.target.value)} className={`${inputClass} mt-1`} /></label><button onClick={markAllPresent} className="rounded-xl border border-emerald-400/40 px-4 py-2.5 text-sm font-bold text-emerald-300">Marcar todos presentes</button></div>
        <div className="border-b border-zinc-800 p-4"><label className="text-sm">Buscar alumno<input value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="Nombre o teléfono" className={`${inputClass} mt-1`} /></label></div>
        <div className="border-b border-zinc-800 p-4"><label className="text-sm">Horario o grupo (opcional)<select value={effectiveScheduleId} onChange={(event) => changeSchedule(event.target.value)} className={`${inputClass} mt-1`}><option value="">Sin horario fijo</option>{dateSchedules.map((schedule) => <option key={schedule.id} value={schedule.id}>{scheduleLabel(schedule)}</option>)}</select><span className="mt-1 block text-xs text-zinc-500">Podés usar el registro sin horario y corregirlo después.</span></label></div>
        {!ready ? <p className="p-12 text-center text-zinc-500">Cargando alumnos…</p> : loadingRoster ? <p className="p-12 text-center text-zinc-500">Cargando alumnos…</p> : rosterStudents.length === 0 ? <p className="p-12 text-center text-zinc-500">No hay alumnos para esta fecha. Podés agregar excepciones con el buscador.</p> : <div className="grid gap-3 p-3 sm:p-4">{rosterStudents.map((student) => <AttendanceStudentCard key={student.id} student={student} setStatus={(status) => setStatus(student.id, status)} />)}</div>}
        <div className="border-t border-zinc-800 p-4"><h3 className="font-semibold">Agregar alumno</h3><p className="mt-1 text-xs text-zinc-500">Buscá un alumno activo para registrarlo en esta fecha.</p><div className="relative mt-3 max-w-xl">{studentQuery ? <div className="overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-xl">{addableStudents.length ? addableStudents.map((student) => <button key={student.id} onClick={() => addExceptional(student)} className="flex w-full items-center justify-between border-b border-zinc-800 px-4 py-3 text-left text-sm last:border-0 hover:bg-zinc-900"><span>{student.firstName} {student.lastName}</span><span className="text-xs text-zinc-500">{student.phone}</span></button>) : <p className="p-4 text-sm text-zinc-500">No se encontraron alumnos activos.</p>}</div> : <p className="rounded-xl border border-dashed border-zinc-700 p-3 text-sm text-zinc-500">Escribí un nombre o teléfono para agregar un alumno.</p>}</div></div>
      </section>
      <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><h2 className="font-semibold">Alumnos con ausencias recientes</h2><p className="mt-1 text-xs text-zinc-500">Dos o más ausencias durante los últimos 30 días.</p>{summary?.recentAbsences.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{summary.recentAbsences.map((student) => <div key={student.studentId} className="flex items-center justify-between rounded-xl bg-zinc-950 px-4 py-3 text-sm"><span>{student.studentName}</span><span className="font-bold text-red-300">{student.count} ausencias</span></div>)}</div> : <p className="mt-4 text-sm text-zinc-500">No hay alertas recientes.</p>}</section>
    </ModuleShell>
  );
}

function SummaryCard({ label, value, tone = "yellow" }: { label: string; value: string | number; tone?: "yellow" | "red" }) { return <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p><p className={`mt-1 text-2xl font-bold ${tone === "red" ? "text-red-300" : "text-yellow-400"}`}>{value}</p></div>; }

function AttendanceStudentCard({ student, setStatus }: { student: AttendanceRosterStudent; setStatus: (status: AttendanceStatus) => void }) { return <article className={`rounded-xl border p-4 ${student.assigned ? "border-zinc-800 bg-zinc-950" : "border-yellow-400/30 bg-yellow-400/5"}`}><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{student.name}</h3><p className="mt-1 text-xs text-zinc-500">{student.phone || "Sin teléfono"}{student.assigned ? "" : " · Excepcional"}</p></div>{student.status ? <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs text-zinc-300">{STATUS_LABEL[student.status]}</span> : <span className="rounded-full border border-zinc-700 px-2 py-1 text-xs text-zinc-500">Sin registrar</span>}</div><div className="mt-4 grid grid-cols-3 gap-2">{STATUS_OPTIONS.map((status) => <button key={status} onClick={() => setStatus(status)} className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${student.status === status ? status === "presente" ? "border-emerald-400 bg-emerald-400/15 text-emerald-300" : status === "ausente" ? "border-red-400 bg-red-400/15 text-red-300" : "border-yellow-400 bg-yellow-400/15 text-yellow-300" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>{STATUS_LABEL[status]}</button>)}</div></article>; }
