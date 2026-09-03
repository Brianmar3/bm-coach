"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { DashboardFloatingActions } from "@/componentes/dashboard-floating-actions";
import { useBrowserStore } from "@/lib/browser-store";
import { RANKING_PAGE_HREF } from "@/lib/ranking-navigation";
import type { DashboardData } from "@/types/dashboard";
import type { CoachSettings, PaymentAccountStatus } from "@/types/gestion";
import { BmCheckIcon, BmChevronRightIcon, BmPaymentIcon, BmProgressIcon, BmRoutineIcon } from "@/componentes/icons";

const accountStyle: Record<PaymentAccountStatus, { label: string; className: string }> = {
  VENCIDA: { label: "Vencida", className: "bg-red-400/15 text-red-300" },
  VENCE_PRONTO: { label: "Vence pronto", className: "bg-orange-400/15 text-orange-300" },
  AL_DIA: { label: "Al día", className: "bg-emerald-400/15 text-emerald-300" },
  SIN_PAGOS: { label: "Sin pagos", className: "bg-yellow-400/10 text-yellow-200" },
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
  const { items: settings } = useBrowserStore<CoachSettings>("bm-coach-settings", []);
  const coachName = settings[0]?.coachName?.trim() || "Profe";

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/dashboard", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response));
        return response.json() as Promise<DashboardData>;
      })
      .then((result) => { setData(result); setError(""); })
      .catch((loadError: unknown) => {
        if (loadError instanceof Error && loadError.name !== "AbortError") setError(loadError.message);
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);

  return <main className="admin-page min-h-screen overflow-x-clip px-3 pb-24 pt-3 text-white sm:px-5 sm:pt-5 md:pb-10 xl:px-6">
    <div className="mx-auto min-w-0 max-w-[1440px]">
      <Hero data={data} coachName={coachName} />
      {error && <section role="alert" className="mb-4 flex flex-col gap-3 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-red-200">{error}</p><button onClick={() => { setLoading(true); setError(""); setReload((value) => value + 1); }} className="rounded-lg bg-red-300 px-3 py-2 text-sm font-bold text-zinc-950">Reintentar</button></section>}
      {loading && !data ? <DashboardSkeleton /> : data && <DashboardContent data={data} />}
    </div>
    <DashboardFloatingActions />
  </main>;
}

function Hero({ data, coachName }: { data: DashboardData | null; coachName: string }) {
  return <header className="admin-welcome mb-3 rounded-2xl px-4 py-4 sm:px-5 sm:py-4">
    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">¡Hola, <span className="text-yellow-300">{coachName}</span>!</h1>
    <p className="mt-2 text-xs text-zinc-400 sm:text-sm">
      <span className="inline-flex items-center gap-1.5 font-medium capitalize text-zinc-300"><DashboardIcon name="calendar" />{data ? showDate(data.today, true) : "—"}</span>
    </p>
  </header>;
}

function DashboardContent({ data }: { data: DashboardData }) {
  const metrics = data.metrics;
  return <div className="space-y-3">
    <section aria-label="Resumen general" className="grid grid-cols-2 gap-2.5">
      <MetricCard label="Alumnos activos" value={String(metrics.activeStudents)} href="/alumnos?estado=activo" icon="students" />
      <MetricCard label="Cuotas pendientes" value={String(metrics.pendingCount)} href="/pagos" icon="warning" tone={metrics.overdueCount ? "red" : "yellow"} />
    </section>

    <AttentionToday data={data.attentionToday} />

    <section className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <TodayClasses items={data.todayClasses} total={metrics.classesToday} />
      <PaymentsPanel data={data.income} metrics={metrics} />
    </section>

    <section className="grid gap-3 lg:grid-cols-2">
      <AttendancePanel data={data.weeklyAttendance} summary={data.attendanceSummary} />
      <RecentStudents items={data.recentStudents} />
    </section>

    <section className="grid gap-3 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <RankingPanel items={data.ranking} />
      <EventsPanel events={data.upcomingEvents} />
    </section>
  </div>;
}

function MetricCard({ label, value, href, icon, tone = "yellow" }: { label: string; value: string; href: string; icon: IconName; tone?: "yellow" | "green" | "red" }) {
  const colors = { yellow: "bg-yellow-400/10 text-yellow-300", green: "bg-emerald-400/10 text-emerald-300", red: "bg-red-400/10 text-red-300" }[tone];
  return <Link href={href} className="group flex min-h-20 items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3.5 shadow-lg shadow-black/10 transition hover:border-yellow-400/35 sm:min-h-20 sm:p-4">
    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${colors}`}><DashboardIcon name={icon} /></span>
    <span className="min-w-0"><span className="block text-[11px] text-zinc-500 sm:text-sm">{label}</span><strong className="mt-1 block truncate text-lg tracking-tight text-white sm:text-2xl">{value}</strong></span>
  </Link>;
}

function Panel({ title, subtitle, action, children, className = "", id }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return <article id={id} className={`min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3.5 shadow-lg shadow-black/10 sm:p-4 ${className}`}>
    <div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-bold sm:text-lg">{title}</h2>{subtitle && <p className="mt-0.5 text-xs text-zinc-500 sm:text-sm">{subtitle}</p>}</div>{action}</div>
    {children}
  </article>;
}

function SectionLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="inline-flex min-h-10 shrink-0 items-center text-xs font-bold text-yellow-300/80 transition hover:text-yellow-300 focus-visible:text-yellow-300">{children} →</Link>;
}

function AttentionToday({ data }: { data: DashboardData["attentionToday"] }) {
  const quotaCount = data.attentionCount;
  const quotaTitle = data.overdueCount && data.dueSoonCount ? `${quotaCount} cuotas requieren atención` : data.overdueCount ? `${data.overdueCount} ${data.overdueCount === 1 ? "cuota vencida" : "cuotas vencidas"}` : `${data.dueSoonCount} ${data.dueSoonCount === 1 ? "cuota por vencer" : "cuotas por vencer"}`;
  const quotaSubtitle = [data.overdueCount ? `${data.overdueCount} vencida${data.overdueCount === 1 ? "" : "s"}` : "", data.dueSoonCount ? `${data.dueSoonCount} por vencer` : ""].filter(Boolean).join(" · ");
  const rows = [
    quotaCount ? { id: "quotas", title: quotaTitle, subtitle: quotaSubtitle, href: "/pagos", tone: "danger", icon: <BmPaymentIcon size={18}/> } : null,
    data.lowActivityStudentCount ? { id: "activity", title: `${data.lowActivityStudentCount} ${data.lowActivityStudentCount === 1 ? "alumno con baja actividad" : "alumnos con baja actividad"}`, subtitle: "Sin asistencias en los últimos 7 días", href: "/asistencias?view=low-activity", tone: "warning", icon: <BmProgressIcon size={18}/> } : null,
    data.completedWorkoutCount ? { id: "workouts", title: `${data.completedWorkoutCount} ${data.completedWorkoutCount === 1 ? "entrenamiento completado" : "entrenamientos completados"}`, subtitle: "Revisar seguimiento", href: "/rutinas?tab=seguimiento", tone: "gold", icon: <BmRoutineIcon size={18}/> } : null,
    data.registeredPaymentCount ? { id: "payments", title: `${money(data.registeredPaymentTotal)} registrados hoy`, subtitle: `${data.registeredPaymentCount} ${data.registeredPaymentCount === 1 ? "pago" : "pagos"}`, href: "/resumen-mensual", tone: "positive", icon: <BmCheckIcon size={18}/> } : null,
  ].filter((row): row is NonNullable<typeof row> => Boolean(row)).slice(0, 4);
  const hasPriority = quotaCount > 0 || data.lowActivityStudentCount > 0 || data.completedWorkoutCount > 0;
  const visibleRows = rows.filter((row) => hasPriority || row.id === "payments");
  const tones: Record<string, string> = { danger: "bg-red-400/10 text-red-300", warning: "bg-orange-400/10 text-orange-300", gold: "bg-yellow-400/10 text-yellow-300", positive: "bg-emerald-400/10 text-emerald-300" };
  return <Panel title="ATENCIÓN HOY" subtitle="Prioridades de gestión">
    {!hasPriority && <div className="mt-2.5 flex min-h-12 items-center gap-3 rounded-xl border border-emerald-400/15 bg-emerald-400/[.04] px-3 py-2"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-400/10 text-emerald-300"><BmCheckIcon size={18}/></span><span><strong className="block text-sm text-emerald-200">Todo al día por hoy</strong><small className="text-xs text-zinc-500">No hay prioridades pendientes.</small></span></div>}
    {visibleRows.length > 0 && <div className={`${hasPriority ? "mt-2.5" : "mt-2"} divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800 bg-black/20`}>{visibleRows.map((row) => <Link key={row.id} href={row.href} className="flex min-h-14 items-center gap-3 px-3 py-2 transition hover:bg-yellow-400/[.03]"><span className={`grid size-8 shrink-0 place-items-center rounded-full ${tones[row.tone]}`}>{row.icon}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm font-semibold">{row.title}</strong><small className="mt-0.5 block truncate text-xs text-zinc-500">{row.subtitle}</small></span><BmChevronRightIcon size={17} className="shrink-0 text-zinc-600"/></Link>)}</div>}
  </Panel>;
}

function TodayClasses({ items, total }: { items: DashboardData["todayClasses"]; total: number }) {
  return <Panel title="Agenda de hoy" subtitle={total ? `${total} ${total === 1 ? "clase programada" : "clases programadas"}` : "Tu jornada de clases"} action={<SectionLink href="/clases">Ver agenda</SectionLink>}>
    <div className="mt-2.5 divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800 bg-black/20">{items.length ? items.map((item) => <Link href="/clases" key={item.id} className="flex min-h-14 items-center gap-3 px-3 py-2 transition hover:bg-yellow-400/[.03]">
      <div className="w-[4.5rem] shrink-0 border-r border-zinc-800 pr-3"><p className="text-sm font-bold text-yellow-300">{item.startTime}</p><p className="text-[10px] text-zinc-600">{item.endTime}</p></div>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.name}</p><p className="mt-0.5 text-xs text-zinc-500">{item.confirmed} confirmados · {item.attendance} presentes</p></div><span className="text-zinc-600">›</span>
    </Link>) : <EmptyState text="No hay clases programadas para hoy." href="/clases" action="Crear clase" />}</div>
    {total > items.length && <p className="mt-2 text-right text-[11px] text-zinc-500">+{total - items.length} más en la agenda</p>}
  </Panel>;
}

function PaymentsPanel({ data, metrics }: { data: DashboardData["income"]; metrics: DashboardData["metrics"] }) {
  const max = Math.max(...data.map((item) => item.amount), 1);
  return <Panel title="Cobros" subtitle="Resumen del mes actual" action={<SectionLink href="/pagos">Ver pagos</SectionLink>}>
    <div className="mt-3 grid grid-cols-3 gap-2">
      <CompactMetric label="Cobrado" value={money(metrics.monthIncome)} tone="text-emerald-300" />
      <CompactMetric label="Pendiente" value={money(metrics.pendingAmount)} tone="text-yellow-300" />
      <CompactMetric label="Vencidas" value={String(metrics.overdueCount)} tone="text-red-300" />
    </div>
    <div className="mt-3 flex h-16 items-end gap-1" role="img" aria-label="Cobros diarios del mes">{data.map((item) => <div key={item.date} className="flex h-full min-w-0 flex-1 items-end"><span className="block w-full rounded-t-sm bg-gradient-to-t from-yellow-600/30 to-yellow-300" style={{ height: `${item.amount ? Math.max(8, (item.amount / max) * 100) : 2}%` }} title={`${item.label}: ${money(item.amount)}`} /></div>)}</div>
  </Panel>;
}

function RankingPanel({ items }: { items: DashboardData["ranking"] }) {
  return <Panel id="ranking" title="Ranking mensual" subtitle="Top 3 del mes" action={<SectionLink href={RANKING_PAGE_HREF}>Ver ranking</SectionLink>}>
    <div className="mt-2.5 grid grid-cols-3 gap-2">{items.length ? items.map((item, index) => <div key={item.studentId} className="min-w-0 rounded-xl border border-zinc-800 bg-black/20 px-2 py-2 text-center">
      <div className="mx-auto flex items-center justify-center gap-1.5"><span className="text-xs font-bold text-yellow-300">{index + 1}</span><span className="grid h-7 w-7 place-items-center rounded-full bg-yellow-400/10 text-[10px] font-bold text-yellow-200">{initials(item.studentName)}</span></div><span className="mt-1 block truncate text-[11px] text-zinc-300">{item.studentName}</span><strong className="mt-0.5 block text-xs text-yellow-300">{item.points.toLocaleString("es-AR")} pts</strong>
    </div>) : <p className="col-span-3 py-3 text-sm text-zinc-500">Todavía no hay puntos registrados este mes.</p>}</div>
  </Panel>;
}

function RecentStudents({ items }: { items: DashboardData["recentStudents"] }) {
  return <Panel title="Alumnos recientes" subtitle="Últimas altas activas" action={<div className="flex items-center gap-2 sm:gap-3"><SectionLink href="/alumnos">Ver todos</SectionLink><Link href="/alumnos?accion=nuevo" aria-label="Agregar alumno" className="inline-flex min-h-10 items-center text-xs font-semibold text-zinc-500 transition hover:text-yellow-300">+ Agregar</Link></div>}>
    <div className="mt-3 divide-y divide-zinc-800">{items.length ? items.map((item) => <Link href="/alumnos" key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-yellow-400/10 text-xs font-bold text-yellow-200">{initials(item.studentName)}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{item.studentName}</strong><span className="block truncate text-xs text-zinc-500">{item.plan || "Plan sin configurar"}</span></span><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${accountStyle[item.status].className}`}>{accountStyle[item.status].label}</span><span className="text-zinc-600">›</span>
    </Link>) : <p className="py-4 text-sm text-zinc-500">Todavía no hay alumnos activos.</p>}</div>
  </Panel>;
}

function AttendancePanel({ data, summary }: { data: DashboardData["weeklyAttendance"]; summary: DashboardData["attendanceSummary"] }) {
  const max = Math.max(...data.map((item) => item.present), 1);
  return <Panel title="Actividad semanal" subtitle="Asistencias de lunes a domingo" action={<SectionLink href="/asistencias">Ver detalle</SectionLink>}>
    <div className="mt-3 grid gap-3">
      <div className="flex h-24 items-end gap-2" role="img" aria-label="Asistencias de la semana">{data.map((day) => <div key={day.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"><span className="mb-1 text-[10px] font-bold text-zinc-300">{day.present}</span><span className="block w-full max-w-10 rounded-t-sm bg-gradient-to-t from-yellow-600/30 to-yellow-300" style={{ height: `${day.present ? Math.max(8, (day.present / max) * 100) : 2}%` }} /><span className="mt-1 text-[10px] text-zinc-500">{day.label}</span></div>)}</div>
      <div className="grid grid-cols-3 gap-2"><CompactMetric label="Promedio" value={`${summary.weeklyAverage}%`} tone="text-emerald-300" /><CompactMetric label="Mejor día" value={summary.bestDay} tone="text-yellow-300" /><CompactMetric label="Asistencias" value={String(summary.totalAttendance)} tone="text-sky-300" /></div>
    </div>
  </Panel>;
}

function EventsPanel({ events }: { events: DashboardData["upcomingEvents"] }) {
  return <Panel title="Próximos eventos" subtitle="Hasta 3 eventos pendientes" action={<SectionLink href="/eventos">Ver agenda</SectionLink>}>
    <div className="mt-2.5 grid gap-2 sm:grid-cols-3">{events.length ? events.map((event) => <Link key={event.id} href="/eventos" className="flex min-h-14 items-center gap-3 rounded-xl border border-zinc-800 bg-black/20 px-3 py-2 transition hover:border-yellow-400/30">
      <span className="h-10 w-1 shrink-0 rounded-full" style={{ backgroundColor: event.color }} /><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{event.title}</strong><span className="mt-0.5 block truncate text-xs capitalize text-zinc-500">{showDate(event.date)} · {event.time}</span></span><span className="text-zinc-600">›</span>
    </Link>) : <div className="sm:col-span-3"><EmptyState text="No hay eventos programados." href="/eventos" action="Agregar evento" /></div>}</div>
  </Panel>;
}

function CompactMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return <div className="min-w-0 rounded-xl border border-zinc-800/80 bg-black/25 p-2.5 text-center"><p className="truncate text-[9px] uppercase tracking-wide text-zinc-600 sm:text-[10px]">{label}</p><p className={`mt-1 truncate text-sm font-bold sm:text-base ${tone}`}>{value}</p></div>;
}

function EmptyState({ text, href, action }: { text: string; href: string; action: string }) {
  return <div className="rounded-xl border border-dashed border-zinc-700 px-4 py-4 text-center"><p className="text-sm text-zinc-500">{text}</p><Link href={href} className="mt-2 inline-block text-xs font-bold text-yellow-400">{action} →</Link></div>;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

type IconName = "students" | "money" | "warning" | "calendar";

function DashboardIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    students: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    money: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 8v8M15 10h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4"/></>,
    warning: <><path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></>,
    calendar: <><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">{paths[name]}</svg>;
}

function DashboardSkeleton() {
  return <div className="animate-pulse space-y-3"><section className="grid grid-cols-2 gap-2.5">{Array.from({ length: 2 }, (_, index) => <div key={index} className="h-20 rounded-2xl bg-zinc-900" />)}</section><div className="h-36 rounded-2xl bg-zinc-900" /><section className="grid gap-3 lg:grid-cols-2">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-56 rounded-2xl bg-zinc-900" />)}</section></div>;
}
