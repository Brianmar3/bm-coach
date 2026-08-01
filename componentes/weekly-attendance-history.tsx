"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { inputClass } from "@/componentes/module-shell";
import {
  addDateDays,
  argentinaDateKey,
  filterWeeklyStudents,
  mondayForArgentinaDate,
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
  CANCELLED: "Cancelada",
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
  const services = useMemo(() => data ? [...new Set(data.students.map((student) => student.service).filter((value): value is string => Boolean(value)))].sort() : [], [data]);

  function moveWeek(days: number) {
    setWeek((current) => addDateDays(current, days));
    setSelected(null);
  }

  function chooseDate(value: string) {
    const monday = mondayForArgentinaDate(value);
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
            <p className="text-xs font-bold uppercase tracking-[.18em] text-yellow-400">Vista semanal</p>
            <h2 className="mt-1 text-lg font-bold">{data?.metadata.label ?? "Historial semanal"}</h2>
            {data && <p className="mt-1 text-xs text-zinc-500">Actualizado {showGeneratedAt(data.metadata.generatedAt)}</p>}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button type="button" onClick={() => moveWeek(-7)} className="min-h-11 rounded-xl border border-zinc-700 px-3 text-sm font-semibold">← Anterior</button>
            <button type="button" onClick={() => moveWeek(7)} className="min-h-11 rounded-xl border border-zinc-700 px-3 text-sm font-semibold">Siguiente →</button>
            <button type="button" onClick={() => setWeek(mondayForArgentinaDate(argentinaDateKey()) ?? argentinaDateKey())} className="min-h-11 rounded-xl border border-yellow-400/40 px-3 text-sm font-bold text-yellow-300">Esta semana</button>
            <label className="sr-only" htmlFor="weekly-attendance-date">Elegir una fecha</label>
            <input id="weekly-attendance-date" type="date" value={week} onChange={(event) => chooseDate(event.target.value)} className={`${inputClass} sm:w-auto`} />
          </div>
        </div>
      </div>

      {error && <div role="alert" className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200"><p>{error}</p><button type="button" onClick={() => void load()} className="mt-3 rounded-lg border border-red-300/40 px-3 py-2 font-bold">Reintentar</button></div>}
      {loading && !data ? <WeeklySkeleton /> : data && (
        <>
          {data.warnings.length > 0 && <div className="rounded-2xl border border-yellow-400/25 bg-yellow-400/5 p-4"><h3 className="text-sm font-bold text-yellow-300">Datos históricos y limitaciones</h3><ul className="mt-2 space-y-1 text-xs leading-relaxed text-zinc-400">{data.warnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul></div>}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
            <Metric label="Alumnos con asistencia" value={data.summary.studentsWithAttendance} />
            <Metric label="Asistencias" value={data.summary.present} />
            <Metric label="Faltas" value={data.summary.absent} danger />
            <Metric label="Justificadas" value={data.summary.justified} />
            <Metric label="Porcentaje general" value={showPercentage(data.summary.attendancePercentage)} />
            <Metric label="Clases realizadas" value={data.summary.completedClasses ?? "No disponible"} />
            <Metric label="Clases canceladas" value={data.summary.cancelledClasses} />
            <Metric label="Promedio por alumno" value={data.summary.averagePerStudent ?? "No disponible"} />
          </div>
          <p className="text-xs text-zinc-500">Porcentaje = presentes ÷ (presentes + ausentes). Las justificadas, canceladas y clases sin registro no integran el denominador.</p>

          <Filters data={data} services={services} filters={filters} setFilters={setFilters} downloadCsv={downloadCsv} disabled={visibleStudents.length === 0} />

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

function Filters({ data, services, filters, setFilters, downloadCsv, disabled }: { data: WeeklyAttendanceResponse; services: string[]; filters: WeeklyAttendanceFilters; setFilters: (filters: WeeklyAttendanceFilters) => void; downloadCsv: () => void; disabled: boolean }) {
  const set = <K extends keyof WeeklyAttendanceFilters>(key: K, value: WeeklyAttendanceFilters[K]) => setFilters({ ...filters, [key]: value });
  return <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><label className="text-xs text-zinc-400">Buscar alumno<input value={filters.query ?? ""} onChange={(event) => set("query", event.target.value)} placeholder="Nombre o apellido" className={`${inputClass} mt-1`} /></label><label className="text-xs text-zinc-400">Disciplina<select value={filters.discipline ?? ""} onChange={(event) => set("discipline", event.target.value)} className={`${inputClass} mt-1`}><option value="">Todas</option>{data.disciplines.map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-xs text-zinc-400">Horario<select value={filters.scheduleId ?? ""} onChange={(event) => set("scheduleId", event.target.value)} className={`${inputClass} mt-1`}><option value="">Todos</option>{data.schedules.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="text-xs text-zinc-400">Estado<select value={filters.status ?? ""} onChange={(event) => set("status", event.target.value as WeeklyAttendanceState | "")} className={`${inputClass} mt-1`}><option value="">Todos</option>{Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-xs text-zinc-400">Servicio<select value={filters.service ?? ""} onChange={(event) => set("service", event.target.value)} className={`${inputClass} mt-1`}><option value="">Todos</option>{services.map((item) => <option key={item}>{item}</option>)}</select></label></div><div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(filters.onlyAbsent)} onChange={(event) => set("onlyAbsent", event.target.checked)} /> Solo con faltas</label><label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(filters.onlyLowAttendance)} onChange={(event) => set("onlyLowAttendance", event.target.checked)} /> Asistencia menor al 70%</label></div><button type="button" disabled={disabled} onClick={downloadCsv} className="min-h-11 rounded-xl bg-yellow-400 px-4 text-sm font-bold text-zinc-950 disabled:opacity-50">Exportar CSV filtrado</button></div></section>;
}

function DesktopTable({ data, students, select }: { data: WeeklyAttendanceResponse; students: WeeklyAttendanceStudent[]; select: (value: { student: WeeklyAttendanceStudent; date?: string }) => void }) {
  return <div className="hidden overflow-auto rounded-2xl border border-zinc-800 bg-zinc-900 lg:block"><table className="min-w-[1280px] w-full text-left text-xs"><thead className="sticky top-0 z-10 bg-zinc-950 text-zinc-400"><tr><th className="sticky left-0 z-20 min-w-48 bg-zinc-950 p-3">Alumno</th><th className="p-3">Servicio / plan</th>{data.days.map((day) => <th key={day.date} className="min-w-32 p-3">{day.shortLabel}</th>)}<th className="p-3">Totales</th><th className="p-3">Acción</th></tr></thead><tbody>{students.map((student) => <tr key={student.id} className="border-t border-zinc-800 align-top"><td className="sticky left-0 bg-zinc-900 p-3"><p className="font-bold text-white">{student.name}</p><p className="mt-1 text-zinc-500">{student.studentType}</p></td><td className="p-3"><p>{student.service ?? "No disponible"}</p><p className="mt-1 text-zinc-500">{student.plan ?? "Plan no disponible"}</p></td>{data.days.map((day) => <td key={day.date} className="p-2"><DayCell entries={student.entries.filter((entry) => entry.date === day.date)} onClick={() => select({ student, date: day.date })} /></td>)}<td className="p-3 whitespace-nowrap"><p className="text-emerald-300">{student.present} presentes</p><p className="text-red-300">{student.absent} faltas</p><p className="text-yellow-300">{student.justified} justificadas</p><p className="mt-1 font-bold">{showPercentage(student.percentage)}</p></td><td className="p-3"><button type="button" onClick={() => select({ student })} className="rounded-lg border border-yellow-400/30 px-3 py-2 font-bold text-yellow-300">Ver detalle</button></td></tr>)}</tbody></table></div>;
}

function DayCell({ entries, onClick }: { entries: WeeklyAttendanceEntry[]; onClick: () => void }) {
  if (!entries.length) return <span className="text-zinc-600">Sin clase asignada</span>;
  const first = entries[0];
  return <button type="button" onClick={onClick} className="w-full text-left"><span className={`block rounded-lg border px-2 py-2 font-semibold ${STATUS_STYLE[first.status]}`}>{entries.length > 1 ? `${entries.length} registros` : STATUS_LABEL[first.status]}</span><span className="mt-1 block text-[10px] text-zinc-500">{entries.map((entry) => entry.startTime).filter(Boolean).join(" · ")}</span></button>;
}

function MobileCards({ data, students, select }: { data: WeeklyAttendanceResponse; students: WeeklyAttendanceStudent[]; select: (value: { student: WeeklyAttendanceStudent; date?: string }) => void }) {
  return <div className="space-y-3 lg:hidden">{students.map((student) => <article key={student.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{student.name}</h3><p className="mt-1 text-xs text-zinc-500">{student.service ?? "Servicio no disponible"} · {student.plan ?? "Plan no disponible"}</p></div><span className="text-sm font-bold text-yellow-300">{showPercentage(student.percentage)}</span></div><div className="mt-4 grid gap-2">{data.days.map((day) => { const entries = student.entries.filter((entry) => entry.date === day.date); return <div key={day.date} className="grid grid-cols-[5.5rem_1fr] items-center gap-2"><span className="text-xs text-zinc-500">{day.shortLabel}</span><DayCell entries={entries} onClick={() => select({ student, date: day.date })} /></div>; })}</div><div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-3 text-xs"><span>{student.present} presentes · {student.absent} faltas · {student.justified} justificadas</span><button type="button" onClick={() => select({ student })} className="rounded-lg border border-yellow-400/30 px-3 py-2 font-bold text-yellow-300">Ver detalle</button></div></article>)}</div>;
}

function AttendanceDetail({ student, date, close }: { student: WeeklyAttendanceStudent; date?: string; close: () => void }) {
  const entries = date ? student.entries.filter((entry) => entry.date === date) : student.entries;
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 p-3" role="dialog" aria-modal="true" aria-label={`Detalle semanal de ${student.name}`}><section className="mx-auto my-5 max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-yellow-400">{date ? "Detalle del día" : "Detalle semanal"}</p><h2 className="mt-1 text-xl font-bold">{student.name}</h2><p className="mt-1 text-sm text-zinc-500">{student.present} presentes · {student.absent} faltas · {student.justified} justificadas · {showPercentage(student.percentage)}</p></div><button type="button" onClick={close} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm">Cerrar</button></div><div className="mt-5 space-y-3">{entries.length ? entries.map((entry) => <article key={entry.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{entry.discipline}</p><p className="mt-1 text-sm text-zinc-400">{entry.date} · {entry.startTime}{entry.endTime ? `–${entry.endTime}` : ""}</p></div><span className={`rounded-full border px-2 py-1 text-xs font-bold ${STATUS_STYLE[entry.status]}`}>{STATUS_LABEL[entry.status]}</span></div><dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2"><Detail label="Hora del registro" value={entry.recordedAt ? showGeneratedAt(entry.recordedAt) : "No disponible"} /><Detail label="Observación" value={entry.observation ?? "No disponible"} /><Detail label="Registrado por" value={entry.recordedBy ?? "No disponible"} /><Detail label="Método" value={entry.method ?? "No disponible"} /></dl></article>) : <p className="rounded-xl border border-dashed border-zinc-700 p-6 text-center text-sm text-zinc-500">Sin clase asignada.</p>}</div><div className="mt-5 flex justify-end"><Link href={`/alumnos?studentId=${encodeURIComponent(student.id)}`} className="rounded-xl bg-yellow-400 px-4 py-3 text-sm font-bold text-zinc-950">Ir a la ficha general</Link></div></section></div>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-zinc-600">{label}</dt><dd className="mt-1 text-zinc-300">{value}</dd></div>; }
function Empty() { return <p className="rounded-2xl border border-dashed border-zinc-700 p-12 text-center text-sm text-zinc-500">No hay registros de asistencia para esta semana.</p>; }
function WeeklySkeleton() { return <div className="space-y-4 animate-pulse"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-20 rounded-2xl bg-zinc-800/70" />)}</div><div className="h-80 rounded-2xl bg-zinc-800/50" /></div>; }
