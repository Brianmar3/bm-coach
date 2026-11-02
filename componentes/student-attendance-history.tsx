"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ModuleShell, inputClass } from "@/componentes/module-shell";
import { argentinaDateKey } from "@/lib/payment-dates";
import { attendanceReturnHref, type StudentAttendanceHistory } from "@/lib/student-attendance-history";

const statuses = {
  presente: { label: "Presente", style: "bg-emerald-400/15 text-emerald-300" },
  ausente: { label: "Ausente", style: "bg-red-400/15 text-red-300" },
  justificado: { label: "Justificada", style: "bg-yellow-400/15 text-yellow-300" },
};
const showDate = (value: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("es-AR") : "Sin registrar";

export function StudentAttendanceHistoryView({ studentId, returnTo, initialQuery }: { studentId: string; returnTo?: string; initialQuery: string }) {
  const search = useSearchParams();
  const query = search?.toString() ?? initialQuery;
  return <HistoryContent key={studentId + query} studentId={studentId} returnTo={returnTo} query={query}/>;
}

function HistoryContent({ studentId, returnTo, query }: { studentId: string; returnTo?: string; query: string }) {
  const router = useRouter();
  const params = new URLSearchParams(query);
  const [filter, setFilter] = useState(params.get("filter") ?? "all");
  const [month, setMonth] = useState(params.get("month") ?? argentinaDateKey().slice(0, 7));
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");
  const [data, setData] = useState<StudentAttendanceHistory | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const back = attendanceReturnHref(studentId, params.get("returnTo") ?? returnTo);

  useEffect(() => {
    const current = new URLSearchParams(query);
    const controller = new AbortController();
    void fetch(`/api/admin/alumnos/${encodeURIComponent(studentId)}/attendance-history?${current}`, { cache: "no-store", signal: controller.signal })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "No se pudo cargar el historial."); return body as StudentAttendanceHistory; })
      .then(setData).catch((failure: unknown) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "No se pudo cargar el historial."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [studentId, query, retry]);

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (filter === "range" && from > to) { setError("La fecha inicial no puede ser posterior a la final."); return; }
    const next = new URLSearchParams({ returnTo: back, filter });
    if (filter === "month") next.set("month", month);
    if (filter === "range") { next.set("from", from); next.set("to", to); }
    router.replace(`?${next}`, { scroll: false });
  }
  function pageHref(page: number) { const next = new URLSearchParams(query); next.set("page", String(page)); return `?${next}`; }

  return <ModuleShell title={data?.student.name ?? "Historial de asistencias"} subtitle="Historial individual de asistencias" action={<Link href={back} scroll={false} className="bm-button bm-button-secondary min-h-11 rounded-xl border border-zinc-700 px-4 py-3 text-sm font-bold text-yellow-300">← Volver a la ficha</Link>}>
    {data && <section aria-label="Resumen histórico" className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{[
      ["Total histórico de presentes", data.summary.attended], ["Primera asistencia", showDate(data.summary.firstAttendance)],
      ["Última asistencia", showDate(data.summary.lastAttendance)], ["Presentes del mes actual", data.summary.currentMonth],
    ].map(([label, value]) => <div key={label} className="bm-surface rounded-2xl border border-zinc-800 p-4"><p className="text-xs text-zinc-400">{label}</p><p className="mt-2 text-lg font-bold text-yellow-300">{value}</p></div>)}</section>}
    <form onSubmit={apply} className="bm-surface mb-5 grid gap-3 rounded-2xl border border-zinc-800 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm">Período<select className={`${inputClass} mt-1`} value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Todo el historial</option><option value="month">Mes</option><option value="range">Rango de fechas</option></select></label>
      {filter === "month" && <label className="text-sm">Mes<input required type="month" value={month} onChange={event => setMonth(event.target.value)} className={`${inputClass} mt-1`}/></label>}
      {filter === "range" && <><label className="text-sm">Desde<input required type="date" value={from} onChange={event => setFrom(event.target.value)} className={`${inputClass} mt-1`}/></label><label className="text-sm">Hasta<input required type="date" min={from || undefined} value={to} onChange={event => setTo(event.target.value)} className={`${inputClass} mt-1`}/></label></>}
      <button type="submit" className="bm-button bm-button-primary min-h-11 self-end rounded-xl bg-yellow-400 px-4 py-3 text-sm font-bold text-zinc-950">Aplicar filtros</button>
    </form>
    {error && <div role="alert" className="rounded-xl border border-red-400/30 p-4 text-red-300"><p>{error}</p><button type="button" onClick={() => { setLoading(true); setError(""); setRetry(value => value + 1); }} className="mt-2 min-h-11 font-bold">Reintentar</button></div>}
    <section aria-label="Registros de asistencias" aria-busy={loading}>
      {loading ? <p role="status" className="bm-surface rounded-xl p-5 text-zinc-400">Cargando historial…</p> : !error && data && <>
        <p className="mb-3 text-sm text-zinc-400">{data.totalRecords} registros · Del más antiguo al más reciente. Los totales cuentan únicamente presentes.</p>
        {data.history.length ? <ol className="space-y-3">{data.history.map(entry => <li key={entry.id} className="bm-surface flex items-center justify-between gap-3 rounded-xl border border-zinc-800 p-4"><div className="min-w-0"><p className="font-semibold">{showDate(entry.date)}</p>{(entry.scheduleLabel || entry.scheduleStartTime) && <p className="mt-1 break-words text-sm text-zinc-400">{[entry.scheduleLabel, entry.scheduleStartTime].filter(Boolean).join(" · ")}</p>}</div><span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${statuses[entry.status].style}`}>{statuses[entry.status].label}</span></li>)}</ol> : <p role="status" className="bm-surface rounded-xl p-6 text-center text-zinc-400">{params.get("filter") && params.get("filter") !== "all" ? "No hay registros en el período seleccionado." : "Todavía no hay asistencias registradas para este alumno."}</p>}
        {data.pages > 1 && <nav aria-label="Páginas del historial" className="mt-5 flex flex-wrap items-center justify-between gap-3">{data.page > 1 ? <Link href={pageHref(data.page - 1)} replace className="bm-button bm-button-secondary min-h-11 rounded-xl border border-zinc-700 p-3">Anterior</Link> : <span/>}<p className="text-sm text-zinc-400">Página {data.page} de {data.pages}</p>{data.page < data.pages ? <Link href={pageHref(data.page + 1)} replace className="bm-button bm-button-secondary min-h-11 rounded-xl border border-zinc-700 p-3">Siguiente</Link> : <span/>}</nav>}
      </>}
    </section>
  </ModuleShell>;
}
