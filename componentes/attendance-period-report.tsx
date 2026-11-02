"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { inputClass } from "@/componentes/module-shell";
import { argentinaDateKey } from "@/lib/payment-dates";
import { studentAttendanceHref } from "@/lib/student-attendance-history";
import type { AttendanceReport } from "@/lib/attendance-report";

const statusLabels = { presente: "Presente", ausente: "Ausente", justificado: "Justificada" };

export function AttendancePeriodReport({ statistics }: { statistics: boolean }) {
  const search = useSearchParams();
  return <PeriodReport key={search.toString()} query={search.toString()} statistics={statistics}/>;
}

function PeriodReport({ query, statistics }: { query: string; statistics: boolean }) {
  const params = new URLSearchParams(query); const router = useRouter();
  const [filter, setFilter] = useState(params.get("filter") ?? (statistics ? "month" : "all"));
  const [month, setMonth] = useState(params.get("month") ?? argentinaDateKey().slice(0, 7));
  const [from, setFrom] = useState(params.get("from") ?? ""); const [to, setTo] = useState(params.get("to") ?? "");
  const [q, setQuery] = useState(params.get("q") ?? ""); const [status, setStatus] = useState(params.get("status") ?? "all");
  const [data, setData] = useState<AttendanceReport | null>(null); const [error, setError] = useState(""); const [retry, setRetry] = useState(0);
  const origin = `/asistencias?${query}`;
  useEffect(() => {
    const controller = new AbortController(); const request = new URLSearchParams(query); request.set("report", statistics ? "stats" : "history");
    void fetch(`/api/asistencias/historial?${request}`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "No se pudo cargar el informe."); return body as AttendanceReport;
    }).then(setData).catch((failure: unknown) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "No se pudo cargar el informe."); });
    return () => controller.abort();
  }, [query, statistics, retry]);
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (filter === "range" && from > to) { setError("La fecha inicial no puede ser posterior a la final."); return; }
    const next = new URLSearchParams({ view: "history", mode: statistics ? "stats" : "records", filter, q });
    if (filter === "month") next.set("month", month);
    if (filter === "range") { next.set("from", from); next.set("to", to); }
    if (!statistics) next.set("status", status);
    router.replace(`/asistencias?${next}`, { scroll: false });
  }
  const pageHref = (page: number, low = false) => { const next = new URLSearchParams(query); next.set(low ? "lowPage" : "page", String(page)); return `/asistencias?${next}`; };
  const pages = (page: number, total: number, low = false) => total > 1 && <nav aria-label={low ? "Páginas de baja frecuencia" : "Páginas del informe"} className="mt-4 flex flex-wrap items-center justify-between gap-3">{page > 1 ? <Link replace href={pageHref(page - 1, low)} className="min-h-11 rounded-xl border border-zinc-700 p-3 text-sm">Anterior</Link> : <span/>}<span className="text-sm text-zinc-400">Página {page} de {total}</span>{page < total ? <Link replace href={pageHref(page + 1, low)} className="min-h-11 rounded-xl border border-zinc-700 p-3 text-sm">Siguiente</Link> : <span/>}</nav>;
  return <div className="space-y-5">
    <form onSubmit={apply} className="bm-surface grid gap-3 rounded-2xl border border-zinc-800 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm">Período<select value={filter} onChange={event => setFilter(event.target.value)} className={`${inputClass} mt-1`}>{!statistics && <option value="all">Todo el historial</option>}<option value="month">Mes</option><option value="range">Rango de fechas</option></select></label>
      {filter === "month" && <label className="text-sm">Mes<input required type="month" value={month} onChange={event => setMonth(event.target.value)} className={`${inputClass} mt-1`}/></label>}
      {filter === "range" && <><label className="text-sm">Desde<input required type="date" value={from} onChange={event => setFrom(event.target.value)} className={`${inputClass} mt-1`}/></label><label className="text-sm">Hasta<input required type="date" value={to} min={from || undefined} onChange={event => setTo(event.target.value)} className={`${inputClass} mt-1`}/></label></>}
      <label className="text-sm">Buscar alumno<input type="search" maxLength={120} placeholder="Nombre o apellido" value={q} onChange={event => setQuery(event.target.value)} className={`${inputClass} mt-1`}/></label>
      {!statistics && <label className="text-sm">Estado<select value={status} onChange={event => setStatus(event.target.value)} className={`${inputClass} mt-1`}><option value="all">Todos los estados</option><option value="PRESENT">Presente</option><option value="ABSENT">Ausente</option><option value="JUSTIFIED">Justificada</option></select></label>}
      <button type="submit" className="bm-button bm-button-primary min-h-11 self-end rounded-xl bg-yellow-400 px-4 py-3 text-sm font-bold text-zinc-950">Aplicar filtros</button>
    </form>
    {error ? <div role="alert" className="rounded-xl border border-red-400/30 p-4 text-red-300"><p>{error}</p><button type="button" className="mt-2 min-h-11 font-bold" onClick={() => { setError(""); setRetry(value => value + 1); }}>Reintentar</button></div> : !data ? <p role="status" className="p-5 text-zinc-400">Cargando informe…</p> : statistics ? <>
      <div className="grid gap-3 sm:grid-cols-3">{[["Presentes registrados", data.summary?.attended ?? 0], ["Alumnos distintos que asistieron", data.summary?.distinctStudents ?? 0], ["Registros totales (todos los estados)", data.summary?.records ?? 0]].map(([label, value]) => <div key={label} className="bm-surface rounded-xl border border-zinc-800 p-4"><p className="text-xs text-zinc-400">{label}</p><p className="mt-2 text-xl font-bold text-yellow-300">{value}</p></div>)}</div>
      <section className="bm-surface rounded-2xl border border-zinc-800 p-4"><h2 className="font-bold text-yellow-300">Asistencias por alumno</h2><div className="mt-3 divide-y divide-zinc-800">{data.students?.length ? data.students.map(student => <div key={student.studentId} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><Link href={studentAttendanceHref(student.studentId, origin)} className="font-semibold text-yellow-300">{student.name} →</Link><span>{student.attended} presentes</span></div>) : <p className="py-4 text-sm text-zinc-400">No hay registros en el período seleccionado.</p>}</div>{pages(data.page, data.pages)}</section>
      <section className="bm-surface rounded-2xl border border-zinc-800 p-4"><h2 className="font-bold text-yellow-300">Baja frecuencia registrada</h2><p className="mt-1 text-xs text-zinc-400">{data.lowTotal ?? 0} alumnos con 0 o 1 presentes entre quienes tienen registros en este período. No implica faltas ni incumplimiento del plan.</p><div className="mt-3 divide-y divide-zinc-800">{data.lowFrequency?.length ? data.lowFrequency.map(student => <div key={student.studentId} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><Link href={studentAttendanceHref(student.studentId, origin)} className="font-semibold text-yellow-300">{student.name} →</Link><span>{student.attended} presentes</span></div>) : <p className="py-4 text-sm text-zinc-400">No hay alumnos con baja frecuencia registrada en este período.</p>}</div>{pages(data.lowPage ?? 1, data.lowPages ?? 1, true)}</section>
      <section className="bm-surface rounded-2xl border border-zinc-800 p-4"><h2 className="font-bold text-yellow-300">Asistencia perfecta</h2><p className="mt-2 text-sm text-zinc-400">{data.perfectAttendance?.reason}</p></section>
    </> : <section aria-label="Historial general" className="space-y-3"><p className="text-sm text-zinc-400">{data.total} registros · Del más reciente al más antiguo</p>{data.history.length ? data.history.map(entry => <article key={entry.id} className="bm-surface flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 p-4"><div className="min-w-0"><Link href={studentAttendanceHref(entry.studentId, origin)} className="font-bold text-yellow-300">{entry.studentName} →</Link><p className="mt-1 text-sm">{new Date(entry.date + "T12:00:00").toLocaleDateString("es-AR")}</p>{(entry.scheduleLabel || entry.scheduleStartTime) && <p className="mt-1 break-words text-sm text-zinc-400">{[entry.scheduleLabel, entry.scheduleStartTime].filter(Boolean).join(" · ")}</p>}</div><span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-bold">{statusLabels[entry.status]}</span></article>) : <p role="status" className="bm-surface rounded-xl p-6 text-center text-zinc-400">No hay registros para los filtros seleccionados.</p>}{pages(data.page, data.pages)}</section>}
  </div>;
}
