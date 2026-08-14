"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ModuleShell, inputClass } from "@/componentes/module-shell";
import { WeeklyAttendanceHistory } from "@/componentes/weekly-attendance-history";
import { toggledAttendanceStatus } from "@/lib/attendance-state";
import { nextRosterIndex, rosterStatusForKey } from "@/lib/trainer-keyboard-interactions";
import type { AttendanceGeneralSummary, AttendanceRoster, AttendanceRosterStudent, AttendanceStatus, Student, WeeklyClassDay, WeeklyClassSchedule } from "@/types/gestion";

const DAY_FROM_JS: Partial<Record<number, WeeklyClassDay>> = { 1: "MONDAY", 2: "TUESDAY", 3: "WEDNESDAY", 4: "THURSDAY", 5: "FRIDAY" };
const DAY_LABEL: Record<WeeklyClassDay, string> = { MONDAY: "Lunes", TUESDAY: "Martes", WEDNESDAY: "Miércoles", THURSDAY: "Jueves", FRIDAY: "Viernes" };
const STATUS_LABEL: Record<AttendanceStatus, string> = { presente: "Presente", ausente: "Ausente", justificado: "Justificado" };
const STATUS_OPTIONS: AttendanceStatus[] = ["presente", "ausente", "justificado"];
const CONFIRMATION_LABEL = {
  GOING: "Confirmó",
  NOT_GOING: "No asistirá",
  NONE: "Sin respuesta",
} as const;

function todayKey() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date()); }
function dateDay(value: string) { return DAY_FROM_JS[new Date(`${value}T12:00:00Z`).getUTCDay()] ?? null; }
function scheduleLabel(schedule: WeeklyClassSchedule) { return `${DAY_LABEL[schedule.dayOfWeek]} ${schedule.startTime}–${schedule.endTime} · ${schedule.classType}${schedule.active ? "" : " (inactivo)"}`; }
async function responseError(response: Response, fallback: string) { try { return ((await response.json()) as { error?: string }).error ?? fallback; } catch { return fallback; } }

export default function AsistenciasPage() {
  return <Suspense fallback={<p className="p-10 text-center text-zinc-500">Cargando asistencias…</p>}><AttendancePageContent /></Suspense>;
}

function AttendancePageContent() {
  const searchParams = useSearchParams();
  const entryScheduleId = searchParams.get("scheduleId") ?? "";
  const targetStudentId = searchParams.get("studentId") ?? "";
  const calendarMode = Boolean(entryScheduleId);
  const historyMode = searchParams.get("view") === "history";
  const weeklyHistoryMode = historyMode && searchParams.get("mode") !== "day";
  const [date, setDate] = useState(searchParams.get("date") || todayKey());
  const [schedules, setSchedules] = useState<WeeklyClassSchedule[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [scheduleId, setScheduleId] = useState(entryScheduleId);
  const [roster, setRoster] = useState<AttendanceRosterStudent[]>([]);
  const [summary, setSummary] = useState<AttendanceGeneralSummary | null>(null);
  const [studentQuery, setStudentQuery] = useState("");
  const [addingStudent, setAddingStudent] = useState(false);
  const [addStudentQuery, setAddStudentQuery] = useState("");
  const [ready, setReady] = useState(false);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const savingLock = useRef(false);
  const rosterRefs = useRef(new Map<string, HTMLElement>());
  const [activeRosterIndex, setActiveRosterIndex] = useState(-1);

  useEffect(() => {
    if (historyMode) return;
    const controller = new AbortController();
    Promise.all([
      fetch("/api/clases", { cache: "no-store", signal: controller.signal }).then(async (response) => { if (!response.ok) throw new Error(await responseError(response, "No se pudieron cargar los horarios.")); return response.json() as Promise<WeeklyClassSchedule[]>; }),
      fetch("/api/alumnos", { cache: "no-store", signal: controller.signal }).then(async (response) => { if (!response.ok) throw new Error(await responseError(response, "No se pudieron cargar los alumnos.")); return response.json() as Promise<Student[]>; }),
    ]).then(([weeklySchedules, realStudents]) => { setSchedules(weeklySchedules); setStudents(realStudents); }).catch((loadError: unknown) => { if (loadError instanceof Error && loadError.name !== "AbortError") setError(loadError.message); }).finally(() => setReady(true));
    return () => controller.abort();
  }, [historyMode]);

  const dateSchedules = useMemo(() => {
    const day = dateDay(date);
    return schedules.filter((schedule) => schedule.dayOfWeek === day).sort((left, right) => left.startTime.localeCompare(right.startTime));
  }, [date, schedules]);
  const effectiveScheduleId = calendarMode ? entryScheduleId : dateSchedules.some((schedule) => schedule.id === scheduleId) ? scheduleId : dateSchedules.find((schedule) => schedule.active)?.id ?? dateSchedules[0]?.id ?? "";
  const selectedSchedule = schedules.find((schedule) => schedule.id === effectiveScheduleId) ?? null;

  useEffect(() => {
    if (weeklyHistoryMode) return;
    const controller = new AbortController();
    fetch(`/api/asistencias/resumen?date=${date}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(await responseError(response, "No se pudo cargar el resumen.")); return response.json() as Promise<AttendanceGeneralSummary>; })
      .then(setSummary).catch((summaryError: unknown) => { if (summaryError instanceof Error && summaryError.name !== "AbortError") setError(summaryError.message); });
    return () => controller.abort();
  }, [date, weeklyHistoryMode]);

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
    if (historyMode) return;
    const controller = loadRoster(effectiveScheduleId || "", date);
    return () => controller.abort();
  }, [date, effectiveScheduleId, historyMode, loadRoster]);

  const rosterStudents = useMemo(() => {
    const normalized = studentQuery.trim().toLocaleLowerCase("es");
    const available = targetStudentId
      ? [...roster].sort(
          (left, right) =>
            Number(right.id === targetStudentId) -
            Number(left.id === targetStudentId),
        )
      : roster;
    if (!normalized) return available;
    return available.filter((student) => student.name.toLocaleLowerCase("es").includes(normalized));
  }, [roster, studentQuery, targetStudentId]);

  const addableStudents = useMemo(() => {
    const existing = new Set(roster.map((student) => student.id));
    const normalized = addStudentQuery.trim().toLocaleLowerCase("es");
    if (!normalized) return [];
    return students.filter((student) => student.status === "activo" && !existing.has(student.id) && `${student.firstName} ${student.lastName} ${student.phone}`.toLocaleLowerCase("es").includes(normalized)).slice(0, 10);
  }, [addStudentQuery, roster, students]);

  async function persist(records: Array<{ studentId: string; status: AttendanceStatus | null }>, previousRoster: AttendanceRosterStudent[]) {
    if (!records.length || savingLock.current) return;
    savingLock.current = true;
    setSaving(true); setError(""); setSaved(false);
    try {
      const response = await fetch("/api/asistencias", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, scheduleId: effectiveScheduleId, records }) });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo guardar la asistencia."));
      const updatedSummary = await fetch(`/api/asistencias/resumen?date=${date}`, { cache: "no-store" }).then((response) => response.json() as Promise<AttendanceGeneralSummary>);
      setSummary(updatedSummary); setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la asistencia.");
      setRoster(previousRoster);
    }
    finally {
      savingLock.current = false;
      setSaving(false);
    }
  }
  function setStatus(studentId: string, status: AttendanceStatus) {
    if (savingLock.current) return;
    const previousRoster = roster;
    const currentStatus = roster.find((student) => student.id === studentId)?.status ?? null;
    const nextStatus = toggledAttendanceStatus(currentStatus, status);
    setRoster((current) => current.map((student) => student.id === studentId ? { ...student, status: nextStatus } : student));
    void persist([{ studentId, status: nextStatus }], previousRoster);
  }
  function markAllPresent() {
    if (savingLock.current) return;
    const previousRoster = roster;
    const assignedStudents = roster.filter((student) => student.assigned);
    setRoster((current) =>
      current.map((student) =>
        student.assigned ? { ...student, status: "presente" } : student,
      ),
    );
    void persist(
      assignedStudents.map((student) => ({
        studentId: student.id,
        status: "presente" as const,
      })), previousRoster,
    );
  }
  function addExceptional(student: Student) {
    setRoster((current) =>
      [
        ...current,
        {
          id: student.id,
          name: `${student.firstName} ${student.lastName}`.trim(),
          phone: student.phone,
          assigned: false,
          confirmation: null,
          status: null,
          attendanceId: null,
        },
      ].sort((left, right) => left.name.localeCompare(right.name, "es")),
    );
    setAddStudentQuery("");
    setAddingStudent(false);
    setSaved(false);
  }
  function changeDate(value: string) { setDate(value); setError(""); setSaved(false); setLoadingRoster(true); }
  function changeSchedule(value: string) { setScheduleId(value); setError(""); setSaved(false); setLoadingRoster(true); }
  function handleRosterKey(index: number, event: ReactKeyboardEvent<HTMLElement>) {
    if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || savingLock.current) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const nextIndex = nextRosterIndex(index, event.key, rosterStudents.length);
      setActiveRosterIndex(nextIndex);
      rosterRefs.current.get(rosterStudents[nextIndex]?.id ?? "")?.focus();
      return;
    }
    const status = rosterStatusForKey(event.key);
    if (!status) return;
    event.preventDefault();
    setStatus(rosterStudents[index].id, status);
  }

  return (
    <ModuleShell title="" subtitle="" hideHeader flushTop>
      {error && <p role="alert" className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}
      {saved && <p className="mb-4 text-sm font-medium text-emerald-300">✓ Asistencia actualizada</p>}
      {selectedSchedule && <section className="mb-3 rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 py-3"><p className="text-[11px] font-bold uppercase tracking-wider text-yellow-400">{DAY_LABEL[selectedSchedule.dayOfWeek]} · {selectedSchedule.startTime}–{selectedSchedule.endTime}</p><div className="mt-1 flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-lg font-bold">{selectedSchedule.classType}</h2><p className="text-xs text-zinc-500">{selectedSchedule.students.length} alumnos asignados</p></div></section>}
      <section className={`${historyMode ? "hidden " : ""}overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80`}>
        <div className="grid gap-3 border-b border-zinc-800 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"><label className="text-xs text-zinc-400">Fecha<input type="date" value={date} onChange={(event) => changeDate(event.target.value)} className={`${inputClass} mt-1`} /></label><button disabled={saving || !roster.some((student) => student.assigned)} onClick={markAllPresent} className="min-h-11 rounded-xl border border-emerald-400/40 px-4 text-sm font-bold text-emerald-300 disabled:opacity-50">Marcar todos presentes</button></div>
        <div className="border-b border-zinc-800 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="min-w-0 flex-1 text-sm">Buscar alumno<input value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="Nombre o apellido" className={`${inputClass} mt-1`} /></label><button type="button" onClick={() => setAddingStudent((value) => !value)} className="min-h-11 shrink-0 rounded-xl border border-zinc-700 px-4 text-sm font-bold text-yellow-300">+ Agregar alumno</button></div>{addingStudent && <div className="mt-3 rounded-xl border border-zinc-700 bg-zinc-950 p-3"><label className="text-xs text-zinc-400">Buscar alumno activo<input autoFocus value={addStudentQuery} onChange={(event) => setAddStudentQuery(event.target.value)} placeholder="Nombre, apellido o teléfono" className={`${inputClass} mt-1`} /></label>{addStudentQuery.trim() && <div className="mt-2 overflow-hidden rounded-lg border border-zinc-800">{!ready ? <p className="p-3 text-sm text-zinc-500">Buscando alumnos…</p> : addableStudents.length ? addableStudents.map((student) => <button key={student.id} type="button" onClick={() => addExceptional(student)} className="flex w-full items-center justify-between gap-3 border-b border-zinc-800 px-3 py-2.5 text-left text-sm last:border-0 hover:bg-zinc-900"><span>{student.firstName} {student.lastName}</span><span className="text-xs text-zinc-500">{student.phone}</span></button>) : <p className="p-3 text-sm text-zinc-500">No se encontraron alumnos activos.</p>}</div>}</div>}</div>
        {!calendarMode && <div className="border-b border-zinc-800 p-4"><label className="text-sm">Horario o grupo (opcional)<select value={effectiveScheduleId} onChange={(event) => changeSchedule(event.target.value)} className={`${inputClass} mt-1`}><option value="">Sin horario fijo</option>{dateSchedules.map((schedule) => <option key={schedule.id} value={schedule.id}>{scheduleLabel(schedule)}</option>)}</select><span className="mt-1 block text-xs text-zinc-500">Podés usar el registro sin horario y corregirlo después.</span></label></div>}
        {!ready ? <p className="p-12 text-center text-zinc-500">Cargando alumnos…</p> : loadingRoster ? <p className="p-12 text-center text-zinc-500">Cargando alumnos…</p> : rosterStudents.length === 0 ? <p className="p-12 text-center text-zinc-500">No hay alumnos para esta fecha. Podés agregarlos con “+ Agregar alumno”.</p> : <div className="grid gap-2 p-3" aria-label="Lista de asistencia">{rosterStudents.map((student, index) => <AttendanceStudentCard key={student.id} student={student} highlighted={student.id === targetStudentId} keyboardActive={index === activeRosterIndex} saving={saving} setRef={(node) => { if (node) rosterRefs.current.set(student.id, node); else rosterRefs.current.delete(student.id); }} onFocus={() => setActiveRosterIndex(index)} onKeyDown={(event) => handleRosterKey(index, event)} setStatus={(status) => setStatus(student.id, status)} />)}</div>}
      </section>
      <div className={historyMode ? "" : "hidden"}>
        <div className="mb-5 flex w-fit rounded-xl border border-zinc-800 bg-zinc-900 p-1" role="tablist" aria-label="Período del historial">
          <Link href="/asistencias?view=history&mode=day" role="tab" aria-selected={!weeklyHistoryMode} className={`rounded-lg px-4 py-2 text-sm font-bold ${!weeklyHistoryMode ? "bg-yellow-400 text-zinc-950" : "text-zinc-400"}`}>Día</Link>
          <Link href="/asistencias?view=history&mode=week" role="tab" aria-selected={weeklyHistoryMode} className={`rounded-lg px-4 py-2 text-sm font-bold ${weeklyHistoryMode ? "bg-yellow-400 text-zinc-950" : "text-zinc-400"}`}>Semana</Link>
        </div>
        {weeklyHistoryMode ? <WeeklyAttendanceHistory /> : <AttendanceHistory summary={summary} />}
      </div>
    </ModuleShell>
  );
}

function SummaryCard({ label, value, tone = "yellow" }: { label: string; value: string | number; tone?: "yellow" | "red" }) { return <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3"><p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p><p className={`mt-1 text-lg font-bold ${tone === "red" ? "text-red-300" : "text-yellow-400"}`}>{value}</p></div>; }

function AttendanceHistory({ summary }: { summary: AttendanceGeneralSummary | null }) {
  return <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><SummaryCard label="Presentes hoy" value={`${summary?.today.present ?? 0}/${summary?.today.total ?? 0}`} /><SummaryCard label="Ausentes hoy" value={summary?.today.absent ?? 0} tone="red" /><SummaryCard label="Justificados hoy" value={summary?.today.justified ?? 0} /><SummaryCard label="Asistencia mensual" value={`${summary?.monthlyPercentage ?? 0}%`} /></div><div className="mt-5 border-t border-zinc-800 pt-5"><h2 className="font-semibold">Alumnos con ausencias recientes</h2><p className="mt-1 text-xs text-zinc-500">Dos o más ausencias durante los últimos 30 días.</p>{summary?.recentAbsences.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{summary.recentAbsences.map((student) => <div key={student.studentId} className="flex items-center justify-between rounded-xl bg-zinc-950 px-4 py-3 text-sm"><span>{student.studentName}</span><span className="font-bold text-red-300">{student.count} ausencias</span></div>)}</div> : <p className="mt-4 text-sm text-zinc-500">No hay alertas recientes.</p>}</div></section>;
}

function AttendanceStudentCard({
  student,
  highlighted,
  keyboardActive,
  saving,
  setRef,
  onFocus,
  onKeyDown,
  setStatus,
}: {
  student: AttendanceRosterStudent;
  highlighted: boolean;
  keyboardActive: boolean;
  saving: boolean;
  setRef: (node: HTMLElement | null) => void;
  onFocus: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
  setStatus: (status: AttendanceStatus) => void;
}) {
  const confirmation = student.confirmation
    ? CONFIRMATION_LABEL[student.confirmation]
    : CONFIRMATION_LABEL.NONE;
  const confirmationTone =
    student.confirmation === "GOING"
      ? "text-emerald-300"
      : student.confirmation === "NOT_GOING"
        ? "text-red-300"
        : "text-zinc-500";

  return (
    <article
      ref={setRef}
      tabIndex={0}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      aria-label={`${student.name}. ${student.status ? STATUS_LABEL[student.status] : "Sin registrar"}`}
      className={`scroll-mt-24 rounded-xl border px-3 py-2.5 outline-none transition focus-visible:ring-2 focus-visible:ring-yellow-400/70 ${
        highlighted || keyboardActive
          ? "border-yellow-300 bg-yellow-400/10 shadow-[0_0_24px_rgba(250,204,21,.08)]"
          : student.assigned
            ? "border-zinc-800 bg-zinc-950"
            : "border-yellow-400/30 bg-yellow-400/5"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">
            {student.name}
            {highlighted ? (
              <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-yellow-300">
                Destacado
              </span>
            ) : null}
          </h3>
          <p className={`mt-1 text-xs ${confirmationTone}`}>{confirmation}</p>
        </div>
        {student.status ? (
          <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-1 text-[10px] text-zinc-300">
            {STATUS_LABEL[student.status]}
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-zinc-700 px-2 py-1 text-[10px] text-zinc-500">
            Sin registrar
          </span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {STATUS_OPTIONS.map((status) => (
          <button
            key={status}
            type="button"
            disabled={saving}
            onClick={() => setStatus(status)}
            className={`min-h-11 rounded-lg border px-1.5 py-2 text-[11px] font-semibold transition disabled:cursor-wait disabled:opacity-60 sm:px-2 sm:text-xs ${
              student.status === status
                ? status === "presente"
                  ? "border-emerald-400 bg-emerald-400/15 text-emerald-300"
                  : status === "ausente"
                    ? "border-red-400 bg-red-400/15 text-red-300"
                    : "border-yellow-400 bg-yellow-400/15 text-yellow-300"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
            }`}
          >
            {STATUS_LABEL[status]}
          </button>
        ))}
      </div>
    </article>
  );
}
