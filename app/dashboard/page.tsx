"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { DashboardActivity, DashboardData } from "@/types/dashboard";

const quickActions = [
  { label: "Nuevo alumno", href: "/alumnos?accion=nuevo" },
  { label: "Registrar pago", href: "/pagos?accion=registrar" },
  { label: "Tomar asistencia", href: "/asistencias" },
  { label: "Nueva evaluación", href: "/evaluaciones?accion=nueva" },
  { label: "Crear rutina", href: "/rutinas?accion=nueva" },
];

const statusStyle = {
  programada: "bg-sky-400/10 text-sky-300",
  en_curso: "bg-emerald-400/10 text-emerald-300",
  finalizada: "bg-zinc-700 text-zinc-300",
  cancelada: "bg-red-400/10 text-red-300",
};

const statusLabel = {
  programada: "Programada",
  en_curso: "En curso",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
};

function money(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

function showDate(value: string, includeTime = false) {
  const date = value.includes("T") ? new Date(value) : new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("es-AR", includeTime
    ? { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" }
    : { day: "2-digit", month: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(date);
}

async function responseError(response: Response) {
  try {
    return ((await response.json()) as { error?: string }).error ?? "No se pudo cargar el Dashboard.";
  } catch {
    return "No se pudo cargar el Dashboard.";
  }
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/dashboard", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response));
        return response.json() as Promise<DashboardData>;
      })
      .then(setData)
      .catch((value: unknown) => {
        if (value instanceof Error && value.name !== "AbortError") setError(value.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reload]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(250,204,21,0.07),_transparent_28%),#09090b] px-4 pb-28 pt-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 border-b border-zinc-800 pb-5">
          <p className="text-xs font-bold uppercase tracking-[.25em] text-yellow-400">Centro operativo</p>
          <h1 className="mt-2 text-3xl font-black">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {data ? `${data.metrics.activeStudents} alumnos activos · ${showDate(data.today)}` : "Resumen diario de BM Coach"}
          </p>
        </header>

        {error && (
          <div role="alert" className="mb-5 flex flex-col gap-3 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-red-200">{error}</p>
            <button onClick={() => { setError(""); setLoading(true); setReload((value) => value + 1); }} className="rounded-lg bg-red-300 px-3 py-2 text-sm font-bold text-zinc-950">Reintentar</button>
          </div>
        )}

        {loading && !data ? <DashboardSkeleton /> : data && <DashboardContent data={data} />}
      </div>
      <FloatingActions />
    </main>
  );
}

function DashboardContent({ data }: { data: DashboardData }) {
  const metrics = data.metrics;
  return (
    <>
      <section aria-label="Resumen diario" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Alumnos activos" value={String(metrics.activeStudents)} href="/alumnos?estado=activo" />
        <Metric label="Clases de hoy" value={String(metrics.classesToday)} href="/clases" />
        <Metric label="Presentes hoy" value={String(metrics.attendanceToday)} href="/asistencias" tone="green" />
        <Metric label="Cobrado este mes" value={money(metrics.monthIncome)} href="/pagos" tone="green" />
        <Metric label="Cuotas vencidas" value={String(metrics.overdueCount)} href="/pagos?estado=VENCIDA" tone={metrics.overdueCount ? "red" : "yellow"} />
        <Metric label="Vencen en 3 días" value={String(metrics.dueSoonCount)} href="/pagos?estado=VENCE_PRONTO" tone="orange" />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_.9fr]">
        <TodayClasses items={data.todayClasses} date={data.today} />
        <QuickActions />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-3">
        <PaymentAlerts items={data.paymentAlerts} />
        <AbsenceAlerts items={data.absenceAlerts} />
        <EvaluationAlerts items={data.evaluationAlerts} />
      </section>

      <section className="mt-5">
        <RecentActivity items={data.recentActivity} />
      </section>
    </>
  );
}

function Metric({ label, value, href, tone = "yellow" }: { label: string; value: string; href: string; tone?: "yellow" | "green" | "red" | "orange" }) {
  const color = { yellow: "text-yellow-300", green: "text-emerald-300", red: "text-red-300", orange: "text-orange-300" }[tone];
  return (
    <Link href={href} className="min-h-28 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4 transition hover:border-yellow-400/40">
      <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-4 text-2xl font-black tracking-tight ${color}`}>{value}</p>
    </Link>
  );
}

function Panel({ title, subtitle, children, action }: { title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4 shadow-xl shadow-black/10 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="font-bold">{title}</h2>{subtitle && <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>}</div>
        {action}
      </div>
      {children}
    </article>
  );
}

function TodayClasses({ items, date }: { items: DashboardData["todayClasses"]; date: string }) {
  return (
    <Panel title="Próximas clases de hoy" subtitle={`${items.length} clases programadas`} action={<Link href="/clases" className="text-xs font-bold text-yellow-400">Ver calendario</Link>}>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.length ? items.map((item) => (
          <div key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="font-bold">{item.name}</h3><p className="mt-1 text-sm text-zinc-400">{item.startTime}–{item.endTime}</p></div>
              <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusStyle[item.status]}`}>{statusLabel[item.status]}</span>
            </div>
            <p className="mt-3 text-xs text-zinc-500">{item.enrolled} alumnos asignados</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {item.scheduleId
                ? <Link href={`/asistencias?scheduleId=${encodeURIComponent(item.scheduleId)}&date=${date}`} className="rounded-lg bg-yellow-400 px-3 py-2.5 text-center text-xs font-bold text-zinc-950">Tomar asistencia</Link>
                : <span className="rounded-lg border border-zinc-800 px-3 py-2.5 text-center text-xs text-zinc-600">Sin horario</span>}
              <Link href={`/clases?occurrenceId=${encodeURIComponent(item.id)}`} className="rounded-lg border border-zinc-700 px-3 py-2.5 text-center text-xs font-bold text-zinc-200">Ver clase</Link>
            </div>
          </div>
        )) : <Empty text="No hay clases programadas para hoy." />}
      </div>
    </Panel>
  );
}

function QuickActions() {
  return (
    <Panel title="Acciones rápidas" subtitle="Atajos para el trabajo diario">
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {quickActions.map((action) => <Link key={action.href} href={action.href} className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm font-semibold transition hover:border-yellow-400/40 hover:text-yellow-300">{action.label}</Link>)}
      </div>
    </Panel>
  );
}

function PaymentAlerts({ items }: { items: DashboardData["paymentAlerts"] }) {
  return (
    <Panel title="Cuotas prioritarias" subtitle="Vencidas y próximas a vencer">
      <div className="mt-4 space-y-2">
        {items.length ? items.map((item) => <Link key={item.studentId} href={`/pagos?estado=${item.status}`} className="flex items-center justify-between gap-3 rounded-xl bg-zinc-950 p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.studentName}</p><p className="mt-1 text-xs text-zinc-500">{showDate(item.dueDate)}</p></div><span className={item.status === "VENCIDA" ? "text-sm font-bold text-red-300" : "text-sm font-bold text-orange-300"}>{money(item.amount)}</span></Link>) : <Empty text="No hay cuotas prioritarias." />}
      </div>
    </Panel>
  );
}

function AbsenceAlerts({ items }: { items: DashboardData["absenceAlerts"] }) {
  return (
    <Panel title="Ausencias frecuentes" subtitle="Dos o más en los últimos 30 días">
      <div className="mt-4 space-y-2">
        {items.length ? items.map((item) => <Link key={item.studentId} href={`/asistencias?studentId=${encodeURIComponent(item.studentId)}`} className="flex items-center justify-between rounded-xl bg-zinc-950 p-3 text-sm"><span className="truncate font-semibold">{item.studentName}</span><span className="font-bold text-red-300">{item.count}</span></Link>) : <Empty text="No hay alertas de ausencias." />}
      </div>
    </Panel>
  );
}

function EvaluationAlerts({ items }: { items: DashboardData["evaluationAlerts"] }) {
  return (
    <Panel title="Evaluaciones próximas" subtitle="Agenda configurada">
      <div className="mt-4 space-y-2">
        {items.length ? items.map((item) => <Link key={item.id} href="/evaluaciones" className="block rounded-xl bg-zinc-950 p-3"><p className="truncate text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-zinc-500">{showDate(item.date)} · {item.time}</p></Link>) : <Empty text="No hay evaluaciones próximas configuradas." />}
      </div>
    </Panel>
  );
}

function RecentActivity({ items }: { items: DashboardActivity[] }) {
  const labels = { payment: "Pago", evaluation: "Evaluación", routine: "Rutina", attendance: "Asistencia" };
  return (
    <Panel title="Actividad reciente" subtitle="Pagos, evaluaciones, rutinas y asistencias">
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {items.length ? items.map((item) => <Link key={item.id} href={item.href} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3"><span className="w-20 shrink-0 rounded-lg bg-yellow-400/10 px-2 py-1 text-center text-[10px] font-bold text-yellow-300">{labels[item.type]}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.title}</p><p className="truncate text-xs text-zinc-500">{item.detail}</p></div><time className="shrink-0 text-[10px] text-zinc-600">{showDate(item.date, true)}</time></Link>) : <Empty text="Todavía no hay actividad registrada." />}
      </div>
    </Panel>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-zinc-700 p-5 text-center text-sm text-zinc-500">{text}</p>;
}

function FloatingActions() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    function closeEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, []);

  return (
    <div ref={containerRef} className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3 sm:bottom-7 sm:right-7">
      <div className={`grid origin-bottom-right gap-2 transition duration-200 ${open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`} aria-hidden={!open}>
        {quickActions.map((action) => <Link key={action.href} href={action.href} onClick={() => setOpen(false)} tabIndex={open ? 0 : -1} className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-right text-sm font-bold text-white shadow-xl transition hover:border-yellow-400 hover:text-yellow-300">{action.label}</Link>)}
      </div>
      <button type="button" aria-label={open ? "Cerrar acciones rápidas" : "Abrir acciones rápidas"} aria-expanded={open} onClick={() => setOpen((value) => !value)} className="grid h-14 w-14 place-items-center rounded-full bg-yellow-400 text-3xl font-light text-zinc-950 shadow-2xl shadow-black transition hover:bg-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-200 focus:ring-offset-2 focus:ring-offset-zinc-950">
        <span className={`transition-transform duration-200 ${open ? "rotate-45" : ""}`} aria-hidden="true">+</span>
      </button>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-5" aria-label="Cargando dashboard">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-28 rounded-2xl bg-zinc-900" />)}</div>
      <div className="grid gap-5 xl:grid-cols-[1.25fr_.9fr]"><div className="h-80 rounded-2xl bg-zinc-900" /><div className="h-80 rounded-2xl bg-zinc-900" /></div>
      <div className="grid gap-5 xl:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-72 rounded-2xl bg-zinc-900" />)}</div>
    </div>
  );
}
