"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DashboardData } from "@/types/dashboard";
import type { PaymentAccountStatus } from "@/types/gestion";

const quickActions = [
  { label: "Nuevo alumno", href: "/alumnos?accion=nuevo", symbol: "+" },
  { label: "Registrar pago", href: "/pagos", symbol: "$" },
  { label: "Tomar asistencia", href: "/asistencias", symbol: "✓" },
  { label: "Crear clase", href: "/clases", symbol: "▦" },
  { label: "Nueva evaluación", href: "/evaluaciones", symbol: "↗" },
  { label: "Agregar evento", href: "/eventos", symbol: "●" },
];
const accountStyle: Record<PaymentAccountStatus, { label: string; className: string }> = {
  VENCIDA: { label: "Vencida", className: "bg-red-400/15 text-red-300" },
  VENCE_PRONTO: { label: "Vence pronto", className: "bg-orange-400/15 text-orange-300" },
  AL_DIA: { label: "Al día", className: "bg-emerald-400/15 text-emerald-300" },
  SIN_CONFIGURAR: { label: "Sin configurar", className: "bg-zinc-700 text-zinc-300" },
};

function money(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}
function showDate(value: string, long = false) {
  if (!value) return "Sin definir";
  return new Date(`${value}T12:00:00`).toLocaleDateString("es-AR", long
    ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
    : { day: "2-digit", month: "short" });
}
async function responseError(response: Response) {
  try { return ((await response.json()) as { error?: string }).error ?? "No se pudo cargar el Dashboard."; }
  catch { return "No se pudo cargar el Dashboard."; }
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [quickOpen, setQuickOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/dashboard", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response));
        return response.json() as Promise<DashboardData>;
      })
      .then(setData)
      .catch((loadError: unknown) => {
        if (loadError instanceof Error && loadError.name !== "AbortError") setError(loadError.message);
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(250,204,21,0.07),_transparent_28%),#09090b] p-4 text-white sm:p-6 xl:p-8">
    <div className="mx-auto max-w-[1600px]">
      <header className="relative mb-7 flex flex-col gap-5 border-b border-zinc-800/80 pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.25em] text-yellow-400">Panel general</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">¡Bienvenido, Brian!</h1>
          <p className="mt-1 text-sm text-zinc-400">{data ? `${data.metrics.activeStudents} alumnos activos · Todo listo para organizar tu día` : "Preparando el resumen de tu actividad"}</p>
        </div>
        <div className="flex items-center justify-between gap-3 md:justify-end">
          <div className="text-left md:text-right"><p className="text-xs uppercase tracking-wider text-zinc-500">Hoy</p><p className="mt-1 text-sm font-semibold capitalize text-zinc-200">{data ? showDate(data.today, true) : "—"}</p></div>
          <button onClick={() => setQuickOpen((value) => !value)} aria-expanded={quickOpen} className="rounded-xl bg-yellow-400 px-4 py-3 text-sm font-bold text-zinc-950 shadow-lg shadow-yellow-400/10">＋ Agregar rápido</button>
        </div>
        {quickOpen && <div className="absolute right-0 top-full z-20 mt-2 grid w-full gap-2 rounded-2xl border border-yellow-400/20 bg-zinc-900 p-3 shadow-2xl sm:w-80 sm:grid-cols-2">{quickActions.map((action) => <Link key={action.label} href={action.href} onClick={() => setQuickOpen(false)} className="rounded-xl bg-zinc-950 p-3 text-sm font-semibold transition hover:bg-yellow-400 hover:text-zinc-950"><span className="mr-2 text-yellow-400">{action.symbol}</span>{action.label}</Link>)}</div>}
      </header>

      {error && <section role="alert" className="mb-6 flex flex-col gap-3 rounded-2xl border border-red-400/30 bg-red-400/10 p-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-red-200">{error}</p><button onClick={() => { setLoading(true); setError(""); setReload((value) => value + 1); }} className="rounded-lg bg-red-300 px-3 py-2 text-sm font-bold text-zinc-950">Reintentar</button></section>}
      {loading && !data ? <DashboardSkeleton /> : data && <DashboardContent data={data} />}
    </div>
  </main>;
}

function DashboardContent({ data }: { data: DashboardData }) {
  const metrics = data.metrics;
  return <>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <MetricCard eyebrow="Alumnos activos" value={String(metrics.activeStudents)} detail={`${metrics.activeStudentsMonthChange >= 0 ? "+" : ""}${metrics.activeStudentsMonthChange} vs. altas del mes anterior`} href="/alumnos?estado=activo" symbol="◎" />
      <MetricCard eyebrow="Ingresos del mes" value={money(metrics.monthIncome)} detail={metrics.incomeChangePercent === null ? "Sin comparación anterior" : `${metrics.incomeChangePercent >= 0 ? "+" : ""}${metrics.incomeChangePercent}% vs. mes anterior`} href="/pagos" symbol="$" tone="green" />
      <MetricCard eyebrow="Cuotas por cobrar" value={String(metrics.pendingCount)} detail={`${money(metrics.pendingAmount)} · ${metrics.overdueCount} vencidas`} href="/pagos?estado=VENCIDA" symbol="!" tone={metrics.overdueCount ? "red" : "yellow"} />
      <MetricCard eyebrow="Clases hoy" value={String(metrics.classesToday)} detail={`${metrics.attendanceToday} asistencias registradas`} href="/clases" symbol="▦" />
      <MetricCard eyebrow="Nuevos alumnos" value={String(metrics.newStudents)} detail="Este mes" href="/alumnos?orden=recientes" symbol="+" />
    </section>

    <section className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_1fr_1fr]">
      <IncomeChart data={data.income} total={metrics.monthIncome} />
      <TodayClasses items={data.todayClasses} />
      <UpcomingPayments items={data.upcomingPayments} today={data.today} />
    </section>

    <section className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
      <RecentStudents items={data.recentStudents} />
      <AttendancePanel data={data.weeklyAttendance} summary={data.attendanceSummary} />
    </section>

    <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.4fr]">
      <EventsPanel events={data.upcomingEvents} />
      <QuickAccess />
    </section>
  </>;
}

function MetricCard({ eyebrow, value, detail, href, symbol, tone = "yellow" }: { eyebrow: string; value: string; detail: string; href: string; symbol: string; tone?: "yellow" | "green" | "red" }) {
  const colors = { yellow: "text-yellow-300 bg-yellow-400/10", green: "text-emerald-300 bg-emerald-400/10", red: "text-red-300 bg-red-400/10" }[tone];
  return <Link href={href} className="group rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4 shadow-xl shadow-black/10 transition hover:-translate-y-0.5 hover:border-yellow-400/40">
    <div className="flex items-start justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{eyebrow}</p><span className={`grid h-8 w-8 place-items-center rounded-lg text-sm font-black ${colors}`}>{symbol}</span></div>
    <p className="mt-3 text-2xl font-bold tracking-tight text-white">{value}</p><p className="mt-2 text-xs text-zinc-500">{detail}</p>
  </Link>;
}

function Panel({ title, subtitle, action, children, className = "" }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <article className={`rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-xl shadow-black/10 ${className}`}><div className="flex items-start justify-between gap-4"><div><h2 className="font-bold">{title}</h2>{subtitle && <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>}</div>{action}</div>{children}</article>;
}

function IncomeChart({ data, total }: { data: DashboardData["income"]; total: number }) {
  const max = Math.max(...data.map((item) => item.amount), 1);
  const shownLabels = data.length > 16 ? 5 : 3;
  return <Panel title="Ingresos" subtitle="Evolución diaria del mes actual" action={<span className="text-lg font-bold text-yellow-300">{money(total)}</span>}>
    <div className="mt-6 flex h-48 items-end gap-1" aria-label="Gráfico de ingresos diarios">{data.map((item, index) => <div key={item.date} className="group relative flex h-full min-w-0 flex-1 items-end">
      <div className="w-full rounded-t-sm bg-gradient-to-t from-yellow-500/40 to-yellow-300 transition group-hover:from-yellow-400 group-hover:to-yellow-200" style={{ height: `${item.amount ? Math.max(7, (item.amount / max) * 100) : 2}%` }} />
      {item.amount > 0 && <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-black px-2 py-1 text-[10px] text-yellow-200 group-hover:block">{money(item.amount)}</span>}
      {(index === 0 || index === data.length - 1 || index % shownLabels === 0) && <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-zinc-600">{item.label}</span>}
    </div>)}</div><p className="mt-7 text-center text-[10px] uppercase tracking-widest text-zinc-600">Día del mes</p>
  </Panel>;
}

function TodayClasses({ items }: { items: DashboardData["todayClasses"] }) {
  return <Panel title="Clases de hoy" subtitle={`${items.length} clases programadas`} action={<Link href="/clases" className="text-xs font-semibold text-yellow-400">Ver agenda →</Link>}>
    <div className="mt-4 space-y-3">{items.length ? items.map((item) => <Link href="/clases" key={item.id} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/80 p-3 transition hover:border-yellow-400/30">
      <div className="w-14 shrink-0 rounded-lg bg-yellow-400/10 py-2 text-center"><p className="text-sm font-bold text-yellow-300">{item.startTime}</p><p className="text-[9px] text-zinc-500">{item.endTime}</p></div>
      <div className="min-w-0"><p className="truncate text-sm font-semibold">{item.name}</p><p className="mt-1 text-xs text-zinc-500">{item.enrolled} anotados · {item.attendance} presentes</p></div>
    </Link>) : <EmptyState text="No hay clases programadas para hoy." href="/clases" action="Crear clase" />}</div>
  </Panel>;
}

function UpcomingPayments({ items, today }: { items: DashboardData["upcomingPayments"]; today: string }) {
  function detail(dueDate: string) {
    const days = Math.round((new Date(`${dueDate}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86_400_000);
    if (days < 0) return `Vencida hace ${Math.abs(days)} ${Math.abs(days) === 1 ? "día" : "días"}`;
    if (days === 0) return "Vence hoy";
    if (days === 1) return "Vence mañana";
    return `Vence en ${days} días`;
  }
  return <Panel title="Próximos vencimientos" subtitle="Prioridad de cobro" action={<Link href="/pagos" className="text-xs font-semibold text-yellow-400">Ver todos →</Link>}>
    <div className="mt-4 space-y-3">{items.length ? items.map((item) => <Link href={`/pagos?estado=${item.status}`} key={item.studentId} className="block rounded-xl border border-zinc-800 bg-zinc-950/80 p-3 transition hover:border-yellow-400/30">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.studentName}</p><p className="mt-1 truncate text-xs text-zinc-500">{item.plan}</p></div><span className="font-bold text-yellow-300">{money(item.amount)}</span></div>
      <div className="mt-3 flex items-center justify-between"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${accountStyle[item.status].className}`}>{detail(item.dueDate)}</span><span className="text-[10px] text-zinc-600">{showDate(item.dueDate)}</span></div>
    </Link>) : <EmptyState text="No hay vencimientos próximos." href="/pagos" action="Ver pagos" />}</div>
  </Panel>;
}

function RecentStudents({ items }: { items: DashboardData["recentStudents"] }) {
  return <Panel title="Alumnos recientes" subtitle="Últimas altas activas" action={<div className="flex gap-3"><Link href="/alumnos" className="text-xs font-semibold text-zinc-400">Ver todos</Link><Link href="/alumnos?accion=nuevo" className="text-xs font-bold text-yellow-400">＋ Agregar alumno</Link></div>}>
    <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800">
      <div className="hidden grid-cols-[1.4fr_1fr_.45fr_.8fr_.7fr] gap-3 bg-zinc-950 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-600 md:grid"><span>Alumno</span><span>Plan</span><span>Días</span><span>Próximo pago</span><span>Estado</span></div>
      {items.length ? items.map((item) => <Link href="/alumnos" key={item.id} className="grid gap-3 border-t border-zinc-800 p-4 text-sm first:border-t-0 md:grid-cols-[1.4fr_1fr_.45fr_.8fr_.7fr] md:items-center">
        <span className="font-semibold">{item.studentName}</span><span className="truncate text-zinc-400">{item.plan}</span><span className="text-zinc-400"><span className="md:hidden">Días: </span>{item.days ?? "—"}</span><span className="text-zinc-400">{showDate(item.dueDate)}</span><span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${accountStyle[item.status].className}`}>{accountStyle[item.status].label}</span></span>
      </Link>) : <p className="p-8 text-center text-sm text-zinc-500">Todavía no hay alumnos activos.</p>}
    </div>
  </Panel>;
}

function AttendancePanel({ data, summary }: { data: DashboardData["weeklyAttendance"]; summary: DashboardData["attendanceSummary"] }) {
  const max = Math.max(...data.map((item) => item.present), 1);
  return <Panel title="Asistencia semanal" subtitle="Presentes de lunes a domingo" action={<Link href="/asistencias" className="text-xs font-semibold text-yellow-400">Ver detalle →</Link>}>
    <div className="mt-6 flex h-40 items-end gap-2">{data.map((day) => <div key={day.date} className="flex h-full flex-1 flex-col items-center justify-end"><span className="mb-2 text-xs font-bold text-zinc-300">{day.present}</span><div className="w-full max-w-8 rounded-t-md bg-gradient-to-t from-yellow-500/40 to-yellow-300" style={{ height: `${day.present ? Math.max(8, (day.present / max) * 100) : 2}%` }} /><span className="mt-2 text-[10px] text-zinc-500">{day.label}</span></div>)}</div>
    <div className="mt-5 grid grid-cols-3 gap-2"><MiniMetric label="Promedio" value={`${summary.weeklyAverage}%`} /><MiniMetric label="Mejor día" value={summary.bestDay} /><MiniMetric label="Asistencias" value={String(summary.totalAttendance)} /></div>
  </Panel>;
}

function EventsPanel({ events }: { events: DashboardData["upcomingEvents"] }) {
  return <Panel title="Próximos eventos" subtitle="Agenda pendiente" action={<Link href="/eventos" className="text-xs font-semibold text-yellow-400">Ver agenda →</Link>}>
    <div className="mt-4 space-y-3">{events.length ? events.map((event) => <Link key={event.id} href="/eventos" className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/80 p-3">
      <span className="h-10 w-1 shrink-0 rounded-full" style={{ backgroundColor: event.color }} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{event.title}</p><p className="mt-1 text-xs capitalize text-zinc-500">{showDate(event.date)} · {event.time} · {event.type}</p></div><span className="rounded-full bg-yellow-400/10 px-2 py-1 text-[10px] font-bold capitalize text-yellow-300">{event.status}</span>
    </Link>) : <EmptyState text="No hay eventos programados." href="/eventos" action="Agregar evento" />}</div>
  </Panel>;
}

function QuickAccess() {
  return <Panel title="Accesos rápidos" subtitle="Las acciones que más usás, siempre a mano"><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{quickActions.map((action) => <Link key={action.label} href={action.href} className="group rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 transition hover:border-yellow-400/40 hover:bg-yellow-400/5"><span className="grid h-9 w-9 place-items-center rounded-lg bg-yellow-400/10 font-black text-yellow-300 group-hover:bg-yellow-400 group-hover:text-zinc-950">{action.symbol}</span><p className="mt-3 text-sm font-semibold">{action.label}</p></Link>)}</div></Panel>;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-zinc-950 p-3 text-center"><p className="text-[9px] uppercase tracking-wider text-zinc-600">{label}</p><p className="mt-1 text-sm font-bold text-yellow-300">{value}</p></div>;
}
function EmptyState({ text, href, action }: { text: string; href: string; action: string }) {
  return <div className="rounded-xl border border-dashed border-zinc-700 p-5 text-center"><p className="text-sm text-zinc-500">{text}</p><Link href={href} className="mt-3 inline-block text-xs font-bold text-yellow-400">{action} →</Link></div>;
}
function DashboardSkeleton() {
  return <div className="animate-pulse space-y-5"><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-32 rounded-2xl bg-zinc-900" />)}</section><section className="grid gap-5 xl:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-72 rounded-2xl bg-zinc-900" />)}</section><section className="grid gap-5 xl:grid-cols-2">{Array.from({ length: 2 }, (_, index) => <div key={index} className="h-80 rounded-2xl bg-zinc-900" />)}</section></div>;
}
