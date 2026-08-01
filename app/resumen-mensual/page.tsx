"use client";

import { useEffect, useMemo, useState } from "react";
import { ModuleShell, inputClass } from "@/componentes/module-shell";
import type { MonthlyDetailRow, MonthlySummaryData } from "@/types/monthly-summary";

const money = (value: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
const numberOrUnavailable = (value: number | null, format: (number: number) => string = String) => value === null ? "No disponible" : format(value);
const serviceLabels = { CLASSES: "Clases", PERSONALIZED: "Personalizado", MIXED: "Mixto" } as const;

function argentinaMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit" }).format(new Date()).split("-");
  return { year: Number(parts[0]), month: Number(parts[1]) };
}

function shifted(year: number, month: number, delta: number) {
  const value = new Date(Date.UTC(year, month - 1 + delta, 15));
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1 };
}

function responseError(response: Response, fallback: string) {
  return response.json().then((body: { error?: string }) => body.error || fallback).catch(() => fallback);
}

export default function MonthlySummaryPage() {
  const current = useMemo(() => argentinaMonth(), []);
  const [selection, setSelection] = useState(current);
  const [data, setData] = useState<MonthlySummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [sort, setSort] = useState("nombre");

  async function load(next = selection) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/resumen-mensual?year=${next.year}&month=${next.month}`, { cache: "no-store" });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo cargar el resumen."));
      setData(await response.json() as MonthlySummaryData);
      window.history.replaceState(null, "", `/resumen-mensual?year=${next.year}&month=${next.month}`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el resumen.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetch(`/api/resumen-mensual?year=${current.year}&month=${current.month}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response, "No se pudo cargar el resumen."));
        return response.json() as Promise<MonthlySummaryData>;
      })
      .then((initialData) => { if (active) setData(initialData); })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el resumen."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [current.month, current.year]);

  function select(next: { year: number; month: number }) {
    setSelection(next);
    void load(next);
  }

  async function action(kind: "generate" | "refresh" | "close") {
    if (kind === "close" && !window.confirm("El cierre conservará este resumen y evitará cambios silenciosos. ¿Querés cerrar el mes?")) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/resumen-mensual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...selection, action: kind }),
      });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo actualizar el resumen."));
      setData(await response.json() as MonthlySummaryData);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "No se pudo actualizar el resumen.");
    } finally {
      setSaving(false);
    }
  }

  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    const rows = (data?.detailRows ?? []).filter((row) =>
      (!normalized || row.studentName.toLocaleLowerCase("es").includes(normalized)) &&
      (statusFilter === "todos" || row.paymentStatus === statusFilter),
    );
    return [...rows].sort((left, right) => {
      if (sort === "saldo") return (right.balance ?? -1) - (left.balance ?? -1);
      if (sort === "asistencia") return right.attendancePresent - left.attendancePresent;
      return left.studentName.localeCompare(right.studentName, "es");
    });
  }, [data, query, sort, statusFilter]);

  const years = Array.from({ length: Math.max(1, current.year + 1 - 2020 + 1) }, (_, index) => 2020 + index);
  const previous = shifted(selection.year, selection.month, -1);
  const next = shifted(selection.year, selection.month, 1);
  const exportBase = `/api/resumen-mensual?year=${selection.year}&month=${selection.month}`;

  return <ModuleShell title="Resumen mensual" subtitle="Cobranza, actividad y asistencia respaldadas por registros históricos.">
    <section className="sticky top-[calc(env(safe-area-inset-top)+4.5rem)] z-20 rounded-2xl border border-yellow-400/20 bg-zinc-950/95 p-3 shadow-xl backdrop-blur sm:p-4">
      <div className="grid gap-3 sm:grid-cols-[auto_1fr_1fr_auto]">
        <button onClick={() => select(previous)} className="min-h-11 rounded-xl border border-zinc-700 px-4 text-sm">← Mes anterior</button>
        <select aria-label="Mes" value={selection.month} onChange={(event) => select({ ...selection, month: Number(event.target.value) })} className={inputClass}>
          {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Intl.DateTimeFormat("es-AR", { month: "long" }).format(new Date(2026, index, 1))}</option>)}
        </select>
        <select aria-label="Año" value={selection.year} onChange={(event) => select({ ...selection, year: Number(event.target.value) })} className={inputClass}>
          {years.map((year) => <option key={year}>{year}</option>)}
        </select>
        <button onClick={() => select(next)} className="min-h-11 rounded-xl border border-zinc-700 px-4 text-sm">Mes siguiente →</button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <button onClick={() => select(current)} className="font-semibold text-yellow-300">Volver al mes actual</button>
        {data && <div className="flex flex-wrap items-center gap-2 text-zinc-400"><StatusBadge data={data} /><span>Actualizado: {new Date(data.metadata.generatedAt).toLocaleString("es-AR")}</span></div>}
      </div>
    </section>

    {error && <section role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-200"><span>{error}</span><button onClick={() => void load()} className="rounded-lg border border-red-300/40 px-3 py-2 font-bold">Reintentar</button></section>}
    {loading ? <LoadingState /> : data && <>
      {data.warnings.length > 0 && <section className="mt-5 rounded-2xl border border-amber-400/25 bg-amber-400/[.07] p-4"><p className="font-bold text-amber-200">Datos incompletos</p><ul className="mt-2 space-y-1 text-sm text-amber-100/80">{data.warnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul></section>}

      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Total cobrado" value={money(data.summary.collectedTotal)} detail={`${data.summary.paymentCount} pagos válidos`} />
        <Metric label="Ingreso esperado" value={numberOrUnavailable(data.summary.expectedTotal, money)} />
        <Metric label="Total pendiente" value={numberOrUnavailable(data.summary.pendingTotal, money)} />
        <Metric label="Porcentaje de cobranza" value={numberOrUnavailable(data.summary.collectionPercentage, (value) => `${value}%`)} />
        <Metric label="Alumnos con actividad" value={String(data.summary.studentsWithActivity)} />
        <Metric label="Altas" value={String(data.summary.enrollments)} />
        <Metric label="Bajas" value={numberOrUnavailable(data.summary.deactivations)} />
        <Metric label="Asistencia promedio" value={numberOrUnavailable(data.summary.attendancePercentage, (value) => `${value}%`)} detail={data.attendance.percentageFormula} />
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-3">
        <InfoPanel title="Cobranza"><Info label="Obligaciones pagadas" value={numberOrUnavailable(data.finances.paidObligations)} /><Info label="Parciales" value={numberOrUnavailable(data.finances.partialObligations)} /><Info label="Pendientes o vencidas" value={numberOrUnavailable(data.finances.pendingObligations)} /><Info label="Pagos anulados" value={String(data.finances.voidedPaymentCount)} /></InfoPanel>
        <InfoPanel title="Asistencia registrada"><Info label="Presentes" value={String(data.attendance.present)} /><Info label="Ausentes" value={String(data.attendance.absent)} /><Info label="Justificadas" value={String(data.attendance.justified)} /><Info label="Total de registros" value={String(data.attendance.totalRecords)} /></InfoPanel>
        <InfoPanel title="Actividad real"><Info label="Evaluaciones" value={String(data.activity.evaluations)} /><Info label="Sesiones registradas" value={String(data.activity.registeredWorkoutSessions)} /><Info label="Sesiones completadas" value={String(data.activity.completedWorkoutSessions)} /><p className="mt-3 border-t border-zinc-800 pt-3 text-xs text-zinc-500">{data.expenses.message}</p></InfoPanel>
      </section>

      <section className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-bold">Cierre mensual</h2><p className="mt-1 text-xs text-zinc-500">Un cierre conserva los valores y advertencias visibles en este momento.</p></div>
          <div className="flex flex-wrap gap-2">
            {data.metadata.status === "UNGENERATED" && <button disabled={saving} onClick={() => void action("generate")} className="rounded-xl bg-yellow-400 px-4 py-2.5 text-sm font-bold text-zinc-950 disabled:opacity-50">Generar borrador</button>}
            {data.metadata.status === "DRAFT" && <button disabled={saving} onClick={() => void action("refresh")} className="rounded-xl border border-yellow-400/40 px-4 py-2.5 text-sm font-bold text-yellow-300 disabled:opacity-50">Actualizar borrador</button>}
            {data.metadata.status === "DRAFT" && <button disabled={saving} onClick={() => void action("close")} className="rounded-xl bg-yellow-400 px-4 py-2.5 text-sm font-bold text-zinc-950 disabled:opacity-50">Cerrar mes</button>}
            {data.metadata.status === "CLOSED" && <span className="rounded-xl bg-emerald-400/10 px-4 py-2.5 text-sm font-bold text-emerald-300">Cierre protegido</span>}
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="grid gap-3 border-b border-zinc-800 p-4 md:grid-cols-3">
          <input aria-label="Buscar alumno" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar alumno" className={inputClass} />
          <select aria-label="Filtrar estado" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass}><option value="todos">Todos los estados</option>{["Pagado", "Parcial", "Pendiente", "Vencido", "Sin obligación", "Anulado"].map((status) => <option key={status}>{status}</option>)}</select>
          <select aria-label="Ordenar" value={sort} onChange={(event) => setSort(event.target.value)} className={inputClass}><option value="nombre">Ordenar por alumno</option><option value="saldo">Mayor saldo</option><option value="asistencia">Mayor asistencia</option></select>
        </div>
        <div className="flex flex-wrap gap-2 border-b border-zinc-800 p-4 text-xs"><a href={`${exportBase}&format=detail-csv`} className="rounded-lg border border-yellow-400/40 px-3 py-2 font-bold text-yellow-300">CSV detalle</a><a href={`${exportBase}&format=general-csv`} className="rounded-lg border border-zinc-700 px-3 py-2 font-bold">CSV general</a><button onClick={() => window.print()} className="rounded-lg border border-zinc-700 px-3 py-2 font-bold">Vista imprimible</button></div>
        {visibleRows.length === 0 ? <p className="p-10 text-center text-sm text-zinc-500">No hay alumnos que coincidan con los filtros.</p> : <><div className="hidden overflow-x-auto md:block"><DetailTable rows={visibleRows} /></div><div className="space-y-3 p-3 md:hidden">{visibleRows.map((row) => <DetailCard key={row.studentId} row={row} />)}</div></>}
      </section>
    </>}
  </ModuleShell>;
}

function StatusBadge({ data }: { data: MonthlySummaryData }) {
  const label = data.metadata.status === "CLOSED" ? "Cerrado" : data.metadata.status === "DRAFT" ? "Pendiente de cierre" : "En curso";
  return <span className={`rounded-full px-2.5 py-1 font-bold ${data.metadata.status === "CLOSED" ? "bg-emerald-400/10 text-emerald-300" : "bg-yellow-400/10 text-yellow-300"}`}>{data.metadata.historicalPartial ? `${label} · Histórico parcial` : label}</span>;
}
function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) { return <article className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</p><p className="mt-2 break-words text-xl font-black text-white sm:text-2xl">{value}</p>{detail && <p className="mt-2 text-[10px] text-zinc-600">{detail}</p>}</article>; }
function InfoPanel({ title, children }: { title: string; children: React.ReactNode }) { return <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><h2 className="font-bold text-yellow-300">{title}</h2><dl className="mt-3 space-y-2">{children}</dl></article>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-3 text-sm"><dt className="text-zinc-500">{label}</dt><dd className="font-semibold">{value}</dd></div>; }
function LoadingState() { return <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Cargando resumen">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />)}</div>; }
function RowPlan({ row }: { row: MonthlyDetailRow }) { return <>{row.planName ?? "No disponible"}<span className="block text-[10px] text-zinc-500">{row.serviceType ? serviceLabels[row.serviceType] : "Servicio no disponible"}{row.frequencyDays ? ` · ${row.frequencyDays} días` : ""}</span></>; }
function DetailTable({ rows }: { rows: MonthlyDetailRow[] }) { return <table className="w-full min-w-[1050px] text-left text-sm"><thead className="text-zinc-500"><tr><th className="p-4">Alumno</th><th>Cobrado</th><th>Esperado</th><th>Saldo</th><th>Estado</th><th>Pagos</th><th>Asistencia</th><th>Plan histórico</th></tr></thead><tbody>{rows.map((row) => <tr key={row.studentId} className="border-t border-zinc-800"><td className="p-4 font-semibold">{row.studentName}{row.warnings.length > 0 && <span className="mt-1 block max-w-xs text-[10px] font-normal text-amber-300">{row.warnings.join(" ")}</span>}</td><td>{money(row.collectedAmount)}</td><td>{numberOrUnavailable(row.expectedAmount, money)}</td><td>{numberOrUnavailable(row.balance, money)}</td><td>{row.paymentStatus}</td><td>{row.paymentDates.join(", ") || "Sin pagos"}<span className="block text-[10px] text-zinc-500">{row.paymentMethods.join(", ")}</span></td><td>{row.attendancePresent} presentes<span className="block text-[10px] text-zinc-500">{row.attendanceAbsent} faltas · {row.attendanceJustified} justificadas</span></td><td><RowPlan row={row} /></td></tr>)}</tbody></table>; }
function DetailCard({ row }: { row: MonthlyDetailRow }) { return <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{row.studentName}</h3><p className="mt-1 text-xs text-zinc-500"><RowPlan row={row} /></p></div><span className="rounded-full bg-yellow-400/10 px-2 py-1 text-[10px] font-bold text-yellow-300">{row.paymentStatus}</span></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-zinc-600">Cobrado</dt><dd className="font-bold">{money(row.collectedAmount)}</dd></div><div><dt className="text-xs text-zinc-600">Esperado</dt><dd>{numberOrUnavailable(row.expectedAmount, money)}</dd></div><div><dt className="text-xs text-zinc-600">Saldo</dt><dd>{numberOrUnavailable(row.balance, money)}</dd></div><div><dt className="text-xs text-zinc-600">Asistencia</dt><dd>{row.attendancePresent} / {row.attendancePresent + row.attendanceAbsent + row.attendanceJustified}</dd></div></dl>{row.paymentDates.length > 0 && <p className="mt-3 text-xs text-zinc-500">Pagos: {row.paymentDates.join(", ")} · {row.paymentMethods.join(", ")}</p>}{row.warnings.length > 0 && <p className="mt-3 text-xs text-amber-300">{row.warnings.join(" ")}</p>}</article>; }
