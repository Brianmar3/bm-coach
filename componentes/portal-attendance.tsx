"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PortalAttendancePeriod, PortalAttendanceRecord, PortalAttendanceSummary } from "@/lib/portal-attendance";

type AttendanceResponse = PortalAttendanceSummary & {
  period: { key: PortalAttendancePeriod; label: string; start: string; endExclusive: string };
  records: PortalAttendanceRecord[];
};

const periods: Array<{ key: PortalAttendancePeriod; label: string }> = [
  { key: "current-month", label: "Este mes" },
  { key: "previous-month", label: "Mes anterior" },
  { key: "last-30-days", label: "Últimos 30 días" },
];

const statusStyle = {
  PRESENT: { label: "Presente", className: "border-emerald-400/20 bg-emerald-400/[.07] text-emerald-300" },
  ABSENT: { label: "Ausente", className: "border-red-400/20 bg-red-400/[.07] text-red-300" },
  JUSTIFIED: { label: "Justificada", className: "border-amber-300/20 bg-amber-300/[.06] text-amber-200" },
} as const;

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatPercentage(value: number | null) {
  return value === null ? "—" : `${value.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
}

export function PortalAttendanceView() {
  const [period, setPeriod] = useState<PortalAttendancePeriod>("current-month");
  const [data, setData] = useState<AttendanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/portal/asistencias?period=${period}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as AttendanceResponse & { error?: string };
        if (response.status === 401) { window.location.href = "/portal/login"; throw new Error("Sesión vencida."); }
        if (!response.ok) throw new Error(body.error ?? "No se pudieron cargar tus asistencias.");
        return body;
      })
      .then(setData)
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name !== "AbortError") setError(reason.message);
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [period]);

  function choosePeriod(nextPeriod: PortalAttendancePeriod) {
    if (nextPeriod === period) return;
    setLoading(true);
    setError("");
    setData(null);
    setPeriod(nextPeriod);
  }

  return <div className="space-y-5">
    <header className="rounded-3xl border border-yellow-400/15 bg-[radial-gradient(circle_at_90%_0%,rgba(250,204,21,.1),transparent_35%),linear-gradient(145deg,#181818,#090909)] p-4 shadow-[0_18px_45px_rgba(0,0,0,.3)] sm:p-6">
      <Link href="/portal" className="inline-flex min-h-11 items-center gap-2 rounded-xl text-sm font-bold text-zinc-400 transition hover:text-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"><span aria-hidden="true">←</span> Volver al inicio</Link>
      <p className="mt-4 text-[10px] font-bold uppercase tracking-[.2em] text-yellow-400">Tu actividad</p>
      <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Mis asistencias</h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">Consultá la presencia real registrada por tu entrenador.</p>
    </header>

    <div className="grid grid-cols-3 gap-1 rounded-2xl border border-zinc-800 bg-zinc-950 p-1" role="group" aria-label="Período de asistencia">
      {periods.map((option) => <button key={option.key} type="button" onClick={() => choosePeriod(option.key)} aria-pressed={period === option.key} className={`min-h-11 rounded-xl px-2 py-2 text-xs font-bold transition sm:text-sm ${period === option.key ? "bg-yellow-400 text-zinc-950 shadow-sm" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"}`}>{option.label}</button>)}
    </div>

    {error && <p role="alert" className="rounded-2xl border border-red-400/20 bg-red-400/[.07] p-4 text-sm text-red-200">{error}</p>}
    {loading && <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center text-sm text-zinc-500">Cargando asistencias…</div>}
    {!loading && data && <>
      <section className="grid gap-4 rounded-3xl border border-yellow-400/15 bg-gradient-to-br from-zinc-900 to-[#0a0a0a] p-4 shadow-[0_14px_35px_rgba(0,0,0,.24)] sm:grid-cols-[auto_1fr] sm:items-center sm:p-6">
        <div className="grid h-28 w-28 place-items-center rounded-full border border-yellow-400/20 bg-[radial-gradient(circle,rgba(250,204,21,.1),transparent_65%)] shadow-[inset_0_0_0_7px_rgba(250,204,21,.04)]"><div className="text-center"><strong className="block text-3xl font-black text-yellow-300">{formatPercentage(data.percentage)}</strong><span className="text-[9px] font-bold uppercase tracking-[.12em] text-zinc-500">Asistencia</span></div></div>
        <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-yellow-400">Asistencia del período</p><h2 className="mt-1 text-xl font-black text-white">{data.period.label}</h2>{data.total > 0 ? <p className="mt-2 text-sm text-zinc-400">{data.present} {data.present === 1 ? "asistencia" : "asistencias"} · {data.absent} {data.absent === 1 ? "falta" : "faltas"} · {data.justified} {data.justified === 1 ? "justificada" : "justificadas"}</p> : <p className="mt-2 text-sm text-zinc-400">Aún no hay asistencias registradas {period === "current-month" ? "este mes" : "en este período"}.</p>}</div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Resumen de asistencias">
        <SummaryCard label="Presentes" value={data.present} tone="text-emerald-300" />
        <SummaryCard label="Ausentes" value={data.absent} tone="text-red-300" />
        <SummaryCard label="Justificadas" value={data.justified} tone="text-amber-200" />
        <SummaryCard label="Total de clases" value={data.total} tone="text-yellow-300" />
      </section>

      <section>
        <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-yellow-400">Detalle</p><h2 className="mt-1 text-lg font-black">Historial de asistencias</h2></div><span className="text-xs text-zinc-500">{data.total} registros</span></div>
        {data.records.length > 0 ? <div className="mt-3 space-y-2">{data.records.map((record) => {
          const state = statusStyle[record.status];
          const schedule = record.startTime ? `${record.startTime}${record.endTime ? `–${record.endTime}` : ""}` : "Horario no registrado";
          return <article key={`${record.source}:${record.id}`} className="grid min-w-0 grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/80 p-4 transition hover:border-zinc-700 sm:grid-cols-[140px_1fr_150px_auto]">
            <time dateTime={record.date} className="text-sm font-bold text-zinc-200">{formatDate(record.date)}</time>
            <div className="min-w-0 sm:col-start-2"><p className="truncate text-sm font-semibold text-white">{record.className || "Clase"}</p><p className="mt-1 text-xs text-zinc-500 sm:hidden">{schedule}</p></div>
            <p className="hidden text-sm text-zinc-400 sm:block">{schedule}</p>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${state.className}`}>{state.label}</span>
          </article>;
        })}</div> : <div className="mt-3 rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">Aún no hay asistencias registradas {period === "current-month" ? "este mes" : "en este período"}.</div>}
      </section>
    </>}
  </div>;
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <article className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-[#0b0b0b] p-4"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-zinc-500">{label}</p><p className={`mt-2 text-2xl font-black ${tone}`}>{value}</p></article>;
}
