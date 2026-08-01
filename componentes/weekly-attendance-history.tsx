"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { inputClass } from "@/componentes/module-shell";
import {
  addDateDays,
  argentinaDateKey,
  filterWeeklyStudents,
  isWeeklyAttendanceDisplayDate,
  mondayForArgentinaDate,
  weeklyAttendanceDisplayDays,
  weeklyAttendanceCsv,
  type WeeklyAttendanceEntry,
  type WeeklyAttendanceFilters,
  type WeeklyAttendanceResponse,
  type WeeklyAttendanceState,
  type WeeklyAttendanceStudent,
} from "@/lib/weekly-attendance";

const STATUS_LABEL: Record<WeeklyAttendanceState, string> = {
  PRESENT: "Presente",
  ABSENT: "Ausente",
  JUSTIFIED: "Justificada",
  CANCELLED: "Sin clase",
  NO_RECORD: "Sin registro",
};

const STATUS_STYLE: Record<WeeklyAttendanceState, string> = {
  PRESENT: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  ABSENT: "border-red-400/30 bg-red-400/10 text-red-300",
  JUSTIFIED: "border-yellow-400/30 bg-yellow-400/10 text-yellow-300",
  CANCELLED: "border-zinc-600 bg-zinc-800/70 text-zinc-300",
  NO_RECORD: "border-orange-400/25 bg-orange-400/5 text-orange-200",
};

async function responseError(response: Response) {
  try { return ((await response.json()) as { error?: string }).error ?? "No se pudo cargar el historial semanal."; }
  catch { return "No se pudo cargar el historial semanal."; }
}

function showPercentage(value: number | null) {
  return value === null ? "No disponible" : `${value.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
}

function showGeneratedAt(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function isoWeekValue(monday: string) {
  const date = new Date(`${monday}T12:00:00.000Z`);
  const thursday = new Date(date);
  thursday.setUTCDate(date.getUTCDate() + 3);
  const year = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4, 12));
  const firstMonday = new Date(firstThursday);
  firstMonday.setUTCDate(firstThursday.getUTCDate() - ((firstThursday.getUTCDay() + 6) % 7));
  const weekNumber = Math.floor((date.getTime() - firstMonday.getTime()) / 604_800_000) + 1;
  return `${year}-W${String(weekNumber).padStart(2, "0")}`;
}

function mondayFromIsoWeek(value: string) {
  const match = /^(\d{4})-W(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const weekNumber = Number(match[2]);
  const januaryFourth = new Date(Date.UTC(year, 0, 4, 12));
  const firstMonday = new Date(januaryFourth);
  firstMonday.setUTCDate(januaryFourth.getUTCDate() - ((januaryFourth.getUTCDay() + 6) % 7));
  firstMonday.setUTCDate(firstMonday.getUTCDate() + (weekNumber - 1) * 7);
  return firstMonday.toISOString().slice(0, 10);
}

export function WeeklyAttendanceHistory() {
  const [week, setWeek] = useState(() => mondayForArgentinaDate(argentinaDateKey()) ?? argentinaDateKey());
  const [data, setData] = useState<WeeklyAttendanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<WeeklyAttendanceFilters>({});
  const [selected, setSelected] = useState<{ student: WeeklyAttendanceStudent; date?: string } | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/asistencias/semana?week=${encodeURIComponent(week)}`, { cache: "no-store", signal });
      if (!response.ok) throw new Error(await responseError(response));
      setData(await response.json() as WeeklyAttendanceResponse);
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name !== "AbortError") setError(loadError.message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [week]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load]);

  useEffect(() => {
    const reload = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", reload);
    return () => { window.removeEventListener("focus", reload); document.removeEventListener("visibilitychange", reload); };
  }, [load]);

  const visibleStudents = useMemo(() => data ? filterWeeklyStudents(data.students, filters) : [], [data, filters]);

  function moveWeek(days: number) {
    setWeek((current) => addDateDays(current, days));
    setSelected(null);
  }

  function chooseWeek(value: string) {
    const monday = mondayFromIsoWeek(value);
    if (monday) setWeek(monday);
  }

  function downloadCsv() {
    if (!data) return;
    const blob = new Blob([weeklyAttendanceCsv(data, visibleStudents)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `asistencias-${data.metadata.start}-${data.metadata.end}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-5">
      <div className="sticky top-[calc(env(safe-area-inset-top)+8.4rem)] z-20 rounded-2xl border border-yellow-400/20 bg-zinc-950/95 p-4 shadow-xl shadow-black/30 backdrop-blur-xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-yellow-400">Vista semanal</h2>
            <p className="mt-1 text-sm text-zinc-300">{data?.metadata.label ?? "Historial semanal"}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
            <button type="button" onClick={() => moveWeek(-7)} className="min-h-11 whitespace-nowrap rounded-xl border border-zinc-700 px-3 text-sm font-semibold">Anterior</button>
            <button type="button" onClick={() => moveWeek(7)} className="min-h-11 whitespace-nowrap rounded-xl border border-zinc-700 px-3 text-sm font-semibold">Siguiente</button>
            <button type="button" onClick={() => setWeek(mondayForArgentinaDate(argentinaDateKey()) ?? argentinaDateKey())} className="min-h-11 whitespace-nowrap rounded-xl border border-yellow-400/40 px-3 text-sm font-bold text-yellow-300">Esta semana</button>
            <label htmlFor="weekly-attendance-week" className="text-xs text-zinc-400">Semana<input id="weekly-attendance-week" type="week" value={isoWeekValue(week)} onChange={(event) => chooseWeek(event.target.value)} className={`${inputClass} mt-1 sm:w-auto`} /></label>
          </div>
        </div>
      </div>

      {error && <div role="alert" className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200"><p>{error}</p><button type="button" onClick={() => void load()} className="mt-3 rounded-lg border border-red-300/40 px-3 py-2 font-bold">Reintentar</button></div>}
      {loading && !data ? <WeeklySkeleton /> : data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="Alumnos con asistencia" value={data.summary.studentsWithAttendance} />
            <Metric label="Asistencias" value={data.summary.present} />
            <Metric label="Faltas" value={data.summary.absent} danger />
            <Metric label="Porcentaje general" value={showPercentage(data.summary.attendancePercentage)} />
          </div>

          <Filters filters={filters} setFilters={setFilters} downloadCsv={downloadCsv} disabled={visibleStudents.length === 0} />

          {data.students.length === 0 ? <Empty /> : visibleStudents.length === 0 ? <p className="rounded-2xl border border-dashed border-zinc-700 p-10 text-center text-sm text-zinc-500">No hay alumnos que coincidan con los filtros.</p> : (
            <>
              <DesktopTable data={data} students={visibleStudents} select={setSelected} />
              <MobileCards data={data} students={visibleStudents} select={setSelected} />
            </>
          )}
        </>
      )}
      {selected && <AttendanceDetail student={selected.student} date={selected.date} close={() => setSelected(null)} />}
    </section>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: string | number; danger?: boolean }) {
  return <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3"><p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p><p className={`mt-1 text-lg font-bold ${danger ? "text-red-300" : "text-yellow-400"}`}>{value}</p></article>;
}

function Filters({ filters, setFilters, downloadCsv, disabled }: { filters: WeeklyAttendanceFilters; setFilters: (filters: WeeklyAttendanceFilters) => void; downloadCsv: () => void; disabled: boolean }) {
  const set = <K extends keyof WeeklyAttendanceFilters>(key: K, value: WeeklyAttendanceFilters[K]) => setFilters({ ...filters, [key]: value });
  return <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><div className="flex items-end gap-2"><label className="min-w-0 flex-1 text-xs text-zinc-400">Buscar alumno<input value={filters.query ?? ""} onChange={(event) => set("query", event.target.value)} placeholder="Nombre o apellido" className={`${inputClass} mt-1`} /></label><button type="button" disabled={disabled} onClick={downloadCsv} title="Exportar resultados visibles en CSV" className="min-h-11 shrink-0 rounded-xl border border-zinc-700 px-3 text-xs font-semibold text-zinc-400 transition hover:border-yellow-400/40 hover:text-yellow-300 disabled:opacity-40">CSV</button></div></section>;
}

function DesktopTable({ data, students, select }: { data: WeeklyAttendanceResponse; students: WeeklyAttendanceStudent[]; select: (value: { student: WeeklyAttendanceStudent; date?: string }) => void }) {
  const visibleDays = weeklyAttendanceDisplayDays(data.days);
  return <div className="hidden max-w-full overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900 lg:block"><table className="w-full min-w-[860px] table-fixed text-left text-xs"><thead className="sticky top-0 z-10 bg-zinc-950 text-zinc-400"><tr><th className="sticky left-0 z-20 w-40 whitespace-nowrap bg-zinc-950 px-2.5 py-2.5">Alumno</th><th className="w-28 whitespace-nowrap px-2 py-2.5">Frecuencia / plan</th>{visibleDays.map((day) => <th key={day.date} className="w-[5.5rem] whitespace-nowrap px-1.5 py-2.5 text-center">{day.shortLabel}</th>)}<th className="w-36 whitespace-nowrap px-2 py-2.5">Totales</th></tr></thead><tbody>{students.map((student) => <tr key={student.id} className="border-t border-zinc-800 align-top"><td className="sticky left-0 z-[1] bg-zinc-900 px-2.5 py-2"><p className="truncate font-bold text-white" title={student.name}>{student.name}</p><p className="mt-0.5 truncate text-[10px] text-zinc-500">{student.studentType}</p></td><td className="px-2 py-2"><p className="line-clamp-2 break-words leading-snug text-zinc-300">{student.plan ?? "No disponible"}</p></td>{visibleDays.map((day) => <td key={day.date} className="px-1 py-2"><DayCell entries={student.entries.filter((entry) => entry.date === day.date)} onClick={() => select({ student, date: day.date })} /></td>)}<td className="whitespace-nowrap px-2 py-2"><div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px]"><span className="text-emerald-300">{student.present} presentes</span><span className="text-red-300">{student.absent} faltas</span><span className="text-yellow-300">{student.justified} justificadas</span></div><p className="mt-1 text-xs font-bold">{showPercentage(student.percentage)}</p><button type="button" onClick={() => select({ student })} className="mt-1.5 rounded-lg border border-yellow-400/30 px-2 py-1 text-[11px] font-bold text-yellow-300">Ver detalle</button></td></tr>)}</tbody></table></div>;
}

function DayCell({ entries, onClick }: { entries: WeeklyAttendanceEntry[]; onClick: () => void }) {
  if (!entries.length) return <span className="block whitespace-nowrap py-1.5 text-center text-[10px] text-zinc-600">Sin clase</span>;
  return <button type="button" onClick={onClick} className="w-full space-y-1 text-left">{entries.map((entry) => <span key={entry.id} className="block"><span className={`block whitespace-nowrap rounded-md border px-1.5 py-1 text-center text-[11px] font-semibold ${STATUS_STYLE[entry.status]}`}>{STATUS_LABEL[entry.status]}</span>{entry.startTime && <span className="mt-0.5 block whitespace-nowrap text-center text-[10px] text-zinc-500">{entry.startTime}</span>}</span>)}</button>;
}

function MobileCards({ data, students, select }: { data: WeeklyAttendanceResponse; students: WeeklyAttendanceStudent[]; select: (value: { student: WeeklyAttendanceStudent; date?: string }) => void }) {
  const visibleDays = weeklyAttendanceDisplayDays(data.days);
  return <div className="space-y-3 lg:hidden">{students.map((student) => { const relevantDays = visibleDays.map((day) => ({ ...day, entries: student.entries.filter((entry) => entry.date === day.date) })).filter((day) => day.entries.length > 0); return <article key={student.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-bold">{student.name}</h3><p className="mt-1 text-xs text-zinc-500">{student.plan ?? "Frecuencia no disponible"}</p></div><span className="shrink-0 text-sm font-bold text-yellow-300">{showPercentage(student.percentage)}</span></div>{relevantDays.length > 0 && <div className="mt-3 grid gap-2">{relevantDays.map((day) => <div key={day.date} className="grid grid-cols-[4.5rem_1fr] items-center gap-2"><span className="text-xs text-zinc-500">{day.shortLabel}</span><DayCell entries={day.entries} onClick={() => select({ student, date: day.date })} /></div>)}</div>}<div className="mt-3 border-t border-zinc-800 pt-3"><p className="text-xs text-zinc-400">{student.present} presentes · {student.absent} {student.absent === 1 ? "falta" : "faltas"} · {student.justified} justificadas</p><button type="button" onClick={() => select({ student })} className="mt-2 w-full rounded-lg border border-yellow-400/30 px-3 py-2 text-xs font-bold text-yellow-300">Ver detalle</button></div></article>; })}</div>;
}

function AttendanceDetail({ student, date, close }: { student: WeeklyAttendanceStudent; date?: string; close: () => void }) {
  const entries = date ? student.entries.filter((entry) => entry.date === date) : student.entries.filter((entry) => isWeeklyAttendanceDisplayDate(entry.date));
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-black/85 p-3" role="dialog" aria-modal="true" aria-label={`Detalle semanal de ${student.name}`}><section className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-2xl"><div className="flex shrink-0 items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-yellow-400">{date ? "Detalle del día" : "Detalle semanal"}</p><h2 className="mt-0.5 text-lg font-bold">{student.name}</h2><p className="mt-0.5 text-xs text-zinc-500">{student.present} presentes · {student.absent} faltas · {student.justified} justificadas · {showPercentage(student.percentage)}</p></div><button type="button" onClick={close} aria-label="Cerrar detalle semanal" className="rounded-lg border border-zinc-700 px-3 py-2 text-sm">Cerrar</button></div><div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">{entries.length ? entries.map((entry) => <AttendanceDetailEntry key={entry.id} entry={entry}/>) : <p className="rounded-xl border border-dashed border-zinc-700 p-5 text-center text-sm text-zinc-500">Sin clase asignada.</p>}</div><div className="mt-3 flex shrink-0 justify-end border-t border-zinc-800 pt-3"><Link href={`/alumnos?studentId=${encodeURIComponent(student.id)}`} className="rounded-xl bg-yellow-400 px-4 py-2.5 text-sm font-bold text-zinc-950">Ir a la ficha general</Link></div></section></div>;
}

function AttendanceDetailEntry({ entry }: { entry: WeeklyAttendanceEntry }) {
  const hasDetails = Boolean(entry.observation || entry.recordedBy || entry.method || entry.recordedAt);
  return <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{entry.discipline}</p><p className="mt-0.5 text-xs text-zinc-400">{entry.date} · {entry.startTime}{entry.endTime ? `–${entry.endTime}` : ""}</p></div><span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-bold ${STATUS_STYLE[entry.status]}`}>{STATUS_LABEL[entry.status]}</span></div>{hasDetails && <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-zinc-800 pt-2 text-xs">{entry.observation && <Detail label="Observación" value={entry.observation}/>} {entry.recordedBy && <Detail label="Registrado por" value={entry.recordedBy}/>} {entry.method && <Detail label="Método" value={entry.method}/>} {entry.recordedAt && <Detail label="Registro" value={showGeneratedAt(entry.recordedAt)}/>}</dl>}</article>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div className="flex gap-1"><dt className="text-zinc-600">{label}:</dt><dd className="text-zinc-300">{value}</dd></div>; }
function Empty() { return <p className="rounded-2xl border border-dashed border-zinc-700 p-12 text-center text-sm text-zinc-500">No hay registros de asistencia para esta semana.</p>; }
function WeeklySkeleton() { return <div className="space-y-4 animate-pulse"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-20 rounded-2xl bg-zinc-800/70" />)}</div><div className="h-80 rounded-2xl bg-zinc-800/50" /></div>; }
