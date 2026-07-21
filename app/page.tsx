"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DashboardData, DashboardPaymentItem } from "@/types/dashboard";

const modules = [
  ["Alumnos", "Gestionar alumnos", "/alumnos"],
  ["Rutinas", "Planes personalizados", "/rutinas"],
  ["Clases", "Organizar horarios", "/clases"],
  ["Pagos", "Cuotas y vencimientos", "/pagos"],
  ["Eventos", "Agenda y recordatorios", "/eventos"],
  ["Evaluaciones", "Seguimiento físico", "/evaluaciones"],
];

const money = (value: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
const number = (value: number | null, suffix = "") => value === null ? "—" : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value)}${suffix}`;
const showDate = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });

async function responseError(response: Response) {
  try { return ((await response.json()) as { error?: string }).error ?? "No se pudo cargar el Dashboard."; } catch { return "No se pudo cargar el Dashboard."; }
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/dashboard", { cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(await responseError(response)); return response.json() as Promise<DashboardData>; })
      .then(setData)
      .catch((loadError: unknown) => { if (loadError instanceof Error && loadError.name !== "AbortError") setError(loadError.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);

  return <main className="min-h-screen bg-zinc-950 p-5 text-white sm:p-6 md:p-10"><div className="mx-auto max-w-7xl">
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-bold uppercase tracking-[.2em] text-yellow-400">BM Coach</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">Dashboard</h1><p className="mt-2 text-zinc-400">Indicadores reales de tu actividad y evolución.</p></div>{data && <p className="text-xs text-zinc-500">Actualizado {new Date(data.generatedAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}</p>}</header>

    {error && <section role="alert" className="mb-6 flex flex-col gap-3 rounded-2xl border border-red-400/30 bg-red-400/10 p-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-red-200">{error}</p><button onClick={() => { setLoading(true); setError(""); setReload((value) => value + 1); }} className="rounded-lg bg-red-300 px-3 py-2 text-sm font-bold text-zinc-950">Reintentar</button></section>}
    {loading && !data ? <DashboardSkeleton /> : data && <DashboardContent data={data} />}
  </div></main>;
}

function DashboardContent({ data }: { data: DashboardData }) {
  return <>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard title="Alumnos activos" value={String(data.metrics.activeStudents)} detail="Con estado activo" href="/alumnos" tone="yellow" />
      <MetricCard title="Ingresos del mes" value={money(data.metrics.monthIncome)} detail="Pagos cobrados este mes" href="/pagos" tone="green" />
      <MetricCard title="Cuotas vencidas" value={String(data.metrics.overdueCount)} detail={`${money(data.metrics.overdueAmount)} pendientes`} href="/pagos" tone="red" />
      <MetricCard title="Vencen en 7 días" value={String(data.metrics.dueSoonCount)} detail={`${money(data.metrics.dueSoonAmount)} por cobrar`} href="/pagos" tone="orange" />
    </section>

    <section className="mt-6 grid gap-4 xl:grid-cols-3">
      <LineChart title="Evolución de peso" subtitle="Promedio mensual de evaluaciones" data={data.evolution} field="averageWeight" unit="kg" color="#facc15" />
      <LineChart title="Evolución de IMC" subtitle="Promedio mensual de evaluaciones" data={data.evolution} field="averageBmi" unit="" color="#38bdf8" />
      <StudentBarChart data={data.evolution} />
    </section>

    <section className="mt-6 grid gap-5 xl:grid-cols-3">
      <PaymentPanel title="Cuotas vencidas" subtitle="Requieren seguimiento" items={data.overduePayments} tone="red" empty="No hay cuotas vencidas." />
      <PaymentPanel title="Próximos vencimientos" subtitle="Dentro de los próximos 7 días" items={data.dueSoonPayments} tone="yellow" empty="No hay cuotas por vencer esta semana." />
      <EventsPanel events={data.upcomingEvents} />
    </section>

    <section className="mt-6 grid gap-5 xl:grid-cols-2">
      <EvaluationsPanel items={data.latestEvaluations} />
      <RoutinesPanel items={data.latestRoutines} />
    </section>

    <section className="mt-8"><h2 className="mb-4 text-lg font-semibold">Accesos rápidos</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{modules.map(([title, description, href]) => <Link key={href} href={href} className="group rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition hover:-translate-y-0.5 hover:border-yellow-400/60"><div className="flex items-center justify-between"><div><h3 className="font-semibold group-hover:text-yellow-400">{title}</h3><p className="mt-1 text-xs text-zinc-500">{description}</p></div><span className="text-yellow-400">→</span></div></Link>)}</div></section>
  </>;
}

function MetricCard({ title, value, detail, href, tone }: { title: string; value: string; detail: string; href: string; tone: "yellow" | "green" | "red" | "orange" }) {
  const colors = { yellow: "text-yellow-400 border-yellow-400/20", green: "text-emerald-300 border-emerald-400/20", red: "text-red-300 border-red-400/20", orange: "text-orange-300 border-orange-400/20" };
  return <Link href={href} className={`rounded-2xl border bg-zinc-900 p-5 transition hover:-translate-y-0.5 ${colors[tone]}`}><p className="text-sm text-zinc-400">{title}</p><p className={`mt-2 text-3xl font-bold ${colors[tone].split(" ")[0]}`}>{value}</p><p className="mt-2 text-xs text-zinc-500">{detail}</p></Link>;
}

function LineChart({ title, subtitle, data, field, unit, color }: { title: string; subtitle: string; data: DashboardData["evolution"]; field: "averageWeight" | "averageBmi"; unit: string; color: string }) {
  const plotted = data.flatMap((item, index) => item[field] === null ? [] : [{ index, value: item[field] as number }]);
  if (plotted.length === 0) return <ChartShell title={title} subtitle={subtitle}><p className="grid h-40 place-items-center text-sm text-zinc-500">Sin evaluaciones suficientes.</p></ChartShell>;
  const values = plotted.map((item) => item.value); const min = Math.min(...values); const max = Math.max(...values); const range = max - min || 1;
  const coordinates = plotted.map((item) => ({ ...item, x: 28 + (item.index * 264) / Math.max(data.length - 1, 1), y: 102 - ((item.value - min) / range) * 70 }));
  const latest = plotted.at(-1)?.value ?? null;
  return <ChartShell title={title} subtitle={subtitle} value={number(latest, unit ? ` ${unit}` : "")} valueColor={color}><svg viewBox="0 0 320 125" role="img" aria-label={title} className="mt-3 h-36 w-full"><line x1="28" y1="102" x2="292" y2="102" stroke="#3f3f46" /><polyline points={coordinates.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{coordinates.map((point) => <circle key={point.index} cx={point.x} cy={point.y} r="4" fill={color} />)}</svg><div className="grid grid-cols-6 text-center text-[10px] text-zinc-500">{data.map((item) => <span key={item.month}>{item.label}</span>)}</div></ChartShell>;
}

function StudentBarChart({ data }: { data: DashboardData["evolution"] }) {
  const max = Math.max(...data.map((item) => item.newStudents), 1);
  return <ChartShell title="Altas de alumnos" subtitle="Cantidad incorporada por mes" value={String(data.at(-1)?.newStudents ?? 0)} valueColor="#34d399"><div className="mt-5 flex h-36 items-end gap-2">{data.map((item) => <div key={item.month} className="flex h-full flex-1 flex-col justify-end"><span className="mb-1 text-center text-xs font-semibold text-emerald-300">{item.newStudents}</span><div className="min-h-1 rounded-t bg-emerald-400/80" style={{ height: `${Math.max(4, (item.newStudents / max) * 100)}%` }} /></div>)}</div><div className="mt-2 grid grid-cols-6 text-center text-[10px] text-zinc-500">{data.map((item) => <span key={item.month}>{item.label}</span>)}</div></ChartShell>;
}

function ChartShell({ title, subtitle, value, valueColor, children }: { title: string; subtitle: string; value?: string; valueColor?: string; children: React.ReactNode }) {
  return <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-xs text-zinc-500">{subtitle}</p></div>{value && <span className="font-bold" style={{ color: valueColor }}>{value}</span>}</div>{children}</article>;
}

function PaymentPanel({ title, subtitle, items, tone, empty }: { title: string; subtitle: string; items: DashboardPaymentItem[]; tone: "red" | "yellow"; empty: string }) {
  const color = tone === "red" ? "text-red-300" : "text-yellow-300";
  return <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><div className="flex items-start justify-between"><div><h2 className={`font-semibold ${color}`}>{title}</h2><p className="mt-1 text-xs text-zinc-500">{subtitle}</p></div><Link href="/pagos" className="text-xs text-yellow-400">Ver pagos →</Link></div><div className="mt-4 space-y-2">{items.length ? items.map((item) => <Link key={item.id} href="/pagos" className="flex items-center justify-between rounded-xl bg-zinc-950 p-3 text-sm"><span><span className="block font-medium">{item.studentName}</span><span className="text-xs text-zinc-500">Vence {showDate(item.dueDate)}</span></span><span className={color}>{money(item.amount)}</span></Link>) : <p className="rounded-xl bg-zinc-950 p-4 text-sm text-emerald-300">{empty}</p>}</div></article>;
}

function EventsPanel({ events }: { events: DashboardData["upcomingEvents"] }) {
  return <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><div className="flex items-start justify-between"><div><h2 className="font-semibold text-yellow-300">Próximos eventos</h2><p className="mt-1 text-xs text-zinc-500">Agenda pendiente</p></div><Link href="/eventos" className="text-xs text-yellow-400">Ver agenda →</Link></div><div className="mt-4 space-y-2">{events.length ? events.map((event) => <Link key={event.id} href="/eventos" className="block rounded-xl border-l-4 bg-zinc-950 p-3" style={{ borderLeftColor: event.color }}><span className="block text-sm font-medium">{event.title}</span><span className="mt-1 block text-xs capitalize text-zinc-500">{showDate(event.date)} · {event.time} · {event.type}</span></Link>) : <p className="rounded-xl bg-zinc-950 p-4 text-sm text-zinc-500">No hay eventos próximos.</p>}</div></article>;
}

function EvaluationsPanel({ items }: { items: DashboardData["latestEvaluations"] }) {
  return <article className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900"><div className="flex items-start justify-between p-5"><div><h2 className="font-semibold">Últimas evaluaciones</h2><p className="mt-1 text-xs text-zinc-500">Mediciones físicas recientes</p></div><Link href="/evaluaciones" className="text-xs text-yellow-400">Ver historial →</Link></div><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="border-t border-zinc-800 text-zinc-500"><tr><th className="p-3 pl-5">Alumno</th><th>Fecha</th><th>Peso</th><th>IMC</th><th>Grasa</th></tr></thead><tbody>{items.length ? items.map((item) => <tr key={item.id} className="border-t border-zinc-800"><td className="p-3 pl-5 font-medium">{item.studentName}</td><td>{showDate(item.date)}</td><td>{number(item.weight, " kg")}</td><td>{number(item.bmi)}</td><td>{number(item.bodyFatPercentage, "%")}</td></tr>) : <tr><td colSpan={5} className="p-8 text-center text-zinc-500">No hay evaluaciones registradas.</td></tr>}</tbody></table></div></article>;
}

function RoutinesPanel({ items }: { items: DashboardData["latestRoutines"] }) {
  return <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><div className="flex items-start justify-between"><div><h2 className="font-semibold">Últimas rutinas</h2><p className="mt-1 text-xs text-zinc-500">Planes creados recientemente</p></div><Link href="/rutinas" className="text-xs text-yellow-400">Ver rutinas →</Link></div><div className="mt-4 space-y-2">{items.length ? items.map((item) => <Link key={item.id} href="/rutinas" className="flex flex-col gap-2 rounded-xl bg-zinc-950 p-3 sm:flex-row sm:items-center sm:justify-between"><span><span className="block text-sm font-medium">{item.name}</span><span className="mt-1 block text-xs capitalize text-zinc-500">{item.objective} · {item.level} · {item.students.join(" · ")}</span></span><span className="whitespace-nowrap text-xs text-yellow-400">{item.daysCount} días · {item.exercisesCount} ejercicios</span></Link>) : <p className="rounded-xl bg-zinc-950 p-4 text-sm text-zinc-500">No hay rutinas creadas.</p>}</div></article>;
}

function DashboardSkeleton() {
  return <div className="animate-pulse space-y-6"><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-32 rounded-2xl bg-zinc-900" />)}</section><section className="grid gap-4 xl:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-64 rounded-2xl bg-zinc-900" />)}</section><section className="grid gap-4 xl:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-72 rounded-2xl bg-zinc-900" />)}</section></div>;
}
