"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { argentinaDateKey } from "@/lib/payment-dates";
import type { PortalProgressData, PortalProgressMetric } from "@/types/portal-progress";

const formatNumber = (value: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value);
const formatDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "short" });

function formatDuration(minutes: number | null) {
  if (minutes === null) return "Sin datos";
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (!hours) return `${remaining} min`;
  return remaining ? `${hours} h ${remaining} min` : `${hours} h`;
}

function relativeDate(value: string | null) {
  if (!value) return "Sin datos";
  const today = new Date(`${argentinaDateKey()}T12:00:00`);
  const date = new Date(`${value}T12:00:00`);
  const days = Math.round((today.getTime() - date.getTime()) / 86_400_000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  return days > 1 ? `Hace ${days} días` : formatDate(value);
}

function ProgressIcon({ kind = "chart" }: { kind?: "chart" | "calendar" | "sets" | "exercise" | "evaluation" | "time" }) {
  const paths = {
    chart: <><path d="M4 19V9m5 10V5m5 14v-7m5 7V3" /><path d="m3 15 5-4 5 2 7-7" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18" /></>,
    sets: <><path d="M5 6h14M5 12h14M5 18h14" /><path d="m2 6 1 1 2-2m-3 7 1 1 2-2m-3 7 1 1 2-2" /></>,
    exercise: <><path d="M5 12h14M7 8v8m10-8v8M3 10v4m18-4v4" /></>,
    evaluation: <><path d="M7 3h10v3H7z" /><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 11h8m-8 4h5" /></>,
    time: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-none stroke-current" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{paths[kind]}</svg>;
}

export function PortalProgressView() {
  const [data, setData] = useState<PortalProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/portal/progreso", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as PortalProgressData & { error?: string };
        if (response.status === 401) {
          window.location.assign("/portal/login");
          throw new Error("Sesión vencida.");
        }
        if (!response.ok) throw new Error(body.error ?? "No pudimos cargar tu progreso.");
        return body;
      })
      .then(setData)
      .catch((value: unknown) => { if (!(value instanceof DOMException && value.name === "AbortError")) setError(value instanceof Error ? value.message : "No pudimos cargar tu progreso."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);

  if (loading) return <ProgressSkeleton />;
  if (error || !data) return <section className="mx-auto max-w-5xl rounded-3xl border border-red-400/25 bg-red-400/[.06] p-6 text-center"><h1 className="text-xl font-bold">No pudimos cargar tu progreso.</h1><p className="mt-2 text-sm text-zinc-400">{error}</p><button type="button" onClick={() => { setError(""); setLoading(true); setAttempt((value) => value + 1); }} className="mt-5 min-h-11 rounded-xl bg-yellow-400 px-5 font-bold text-zinc-950">Reintentar</button></section>;

  return <ProgressContent data={data} />;
}

function ProgressContent({ data }: { data: PortalProgressData }) {
  const summary = data.summary;
  const adherence = summary.adherencePercentage;
  return <div className="mx-auto max-w-5xl space-y-5 overflow-x-clip pb-2">
    <header className="flex min-w-0 items-center gap-3 px-1">
      <Link href="/portal/rutina" aria-label="Volver a la rutina" className="grid size-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-zinc-900 text-xl text-zinc-200 outline-none transition hover:border-yellow-400/30 hover:text-yellow-300 focus-visible:ring-2 focus-visible:ring-yellow-300">←</Link>
      <div className="min-w-0"><h1 className="text-2xl font-black tracking-tight text-white">Mi progreso</h1><p className="truncate text-sm text-zinc-500">Tu historial, evolución y avances</p></div>
    </header>

    <section className="overflow-hidden rounded-[26px] border border-white/[.08] bg-[radial-gradient(circle_at_8%_8%,rgba(250,204,21,.08),transparent_32%),linear-gradient(145deg,#181818,#090909)] p-4 shadow-[0_18px_42px_rgba(0,0,0,.32)] sm:p-6">
      <p className="mb-4 text-[10px] font-black uppercase tracking-[.2em] text-yellow-400">Plan actual · {data.plan.name}</p>
      <div className="grid items-center gap-5 min-[560px]:grid-cols-[13rem_minmax(0,1fr)]">
        <div className="mx-auto grid size-44 place-items-center rounded-full p-[10px]" style={{ background: adherence === null ? "#27272a" : `conic-gradient(#facc15 ${adherence * 3.6}deg,#27272a 0deg)` }}>
          <div className="grid size-full place-items-center rounded-full border border-white/[.04] bg-[#0b0b0b] text-center"><div><strong className="block text-4xl font-black text-white">{adherence === null ? "—" : `${adherence}%`}</strong><span className="mt-1 block text-[10px] font-bold uppercase tracking-[.15em] text-zinc-500">Adherencia</span></div></div>
        </div>
        <dl className="divide-y divide-zinc-800/80">
          <SummaryRow icon="sets" label="Sesiones completadas" value={String(summary.completedSessions)} />
          <SummaryRow icon="chart" label="Adherencia" value={adherence === null ? "Sin datos" : `${adherence}%`} />
          <SummaryRow icon="time" label="Tiempo entrenado" value={formatDuration(summary.totalDurationMinutes)} />
          <SummaryRow icon="calendar" label="Última sesión" value={relativeDate(summary.lastSessionDate)} />
        </dl>
      </div>
      {adherence === null && <p className="mt-4 rounded-xl bg-white/[.025] px-3 py-2 text-xs leading-relaxed text-zinc-500">La adherencia se mostrará cuando el plan tenga al menos una semana completa esperada.</p>}
    </section>

    <section>
      <SectionTitle>Resumen general</SectionTitle>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <MetricCard icon="sets" value={summary.completedSessions} label="Sesiones" />
        <MetricCard icon="chart" value={summary.completedBlocks} label="Bloques completados" />
        <MetricCard icon="exercise" value={summary.registeredExercises} label="Ejercicios realizados" />
        <MetricCard icon="sets" value={summary.completedSets} label="Series completadas" />
      </div>
    </section>

    <EvolutionSection metrics={data.bodyProgress} evaluationCount={summary.evaluationCount} />

    <section>
      <SectionTitle>Tus marcas</SectionTitle>
      {data.exerciseProgress.length ? <div className="grid gap-2.5 md:grid-cols-3">{data.exerciseProgress.map((record) => <article key={record.exerciseId} className="min-w-0 rounded-2xl border border-white/[.08] bg-[linear-gradient(145deg,#171717,#0c0c0c)] p-4"><div className="flex items-center gap-2 text-yellow-300"><ProgressIcon kind="exercise" /><span className="text-[10px] font-black uppercase tracking-wider">Marca registrada</span></div><h3 className="mt-3 truncate font-bold text-zinc-100">{record.exerciseName}</h3><div className="mt-3 space-y-1.5 text-sm">{record.maximumWeight !== null && <p><strong className="text-xl text-white">{formatNumber(record.maximumWeight)} kg</strong><span className="ml-2 text-xs text-zinc-500">mayor carga</span></p>}{record.maximumRepetitions !== null && <p><strong className="text-xl text-white">{record.maximumRepetitions}</strong><span className="ml-2 text-xs text-zinc-500">máximo de reps</span></p>}</div></article>)}</div> : <EmptyState text="Completá series con carga o repeticiones para empezar a ver tus marcas." />}
    </section>

    <section>
      <div className="mb-2.5 flex items-center justify-between gap-3"><SectionTitle compact>Historial reciente</SectionTitle><Link href="/portal/historial" className="min-h-11 shrink-0 px-2 py-3 text-xs font-bold text-yellow-300">Ver todo ›</Link></div>
      {data.recentSessions.length ? <div className="overflow-hidden rounded-2xl border border-white/[.08] bg-zinc-900/75">{data.recentSessions.map((session) => <Link key={session.id} href={`/portal/historial#historial-${session.id}`} className="grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-zinc-800 px-3.5 py-3 outline-none last:border-0 hover:bg-white/[.025] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-yellow-300"><span className="grid size-9 place-items-center rounded-xl bg-yellow-400/[.07] text-yellow-300"><ProgressIcon kind="calendar" /></span><span className="min-w-0"><strong className="block truncate text-sm text-zinc-100">{session.dayName || `Día ${session.dayNumber}`}</strong><small className="mt-0.5 block truncate text-zinc-500">{formatDate(session.date)} · {session.durationMinutes ? `${session.durationMinutes} min` : "duración sin registrar"}</small></span><span className="text-xl text-zinc-600">›</span></Link>)}</div> : <EmptyState text="No tenés sesiones completadas todavía." />}
    </section>

    <Link href="/portal/evaluaciones" className="grid min-h-20 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-white/[.08] bg-[linear-gradient(145deg,#171717,#0b0b0b)] p-3.5 outline-none transition hover:border-yellow-400/25 focus-visible:ring-2 focus-visible:ring-yellow-300"><span className="grid size-12 place-items-center rounded-2xl border border-yellow-400/20 bg-yellow-400/[.05] text-yellow-300"><ProgressIcon kind="evaluation" /></span><span className="min-w-0"><strong className="block text-base text-zinc-100">Ver evaluaciones</strong><small className="mt-1 block truncate text-zinc-500">Revisá tus evaluaciones y comparativas</small></span><span className="text-2xl text-zinc-600">›</span></Link>
  </div>;
}

function SummaryRow({ icon, label, value }: { icon: "chart" | "calendar" | "sets" | "time"; label: string; value: string }) {
  return <div className="flex min-h-12 items-center gap-3 py-2.5"><span className="text-yellow-300"><ProgressIcon kind={icon} /></span><dt className="min-w-0 flex-1 text-sm text-zinc-400">{label}</dt><dd className="shrink-0 text-sm font-bold text-zinc-100">{value}</dd></div>;
}

function MetricCard({ icon, value, label }: { icon: "chart" | "exercise" | "sets"; value: number; label: string }) {
  return <article className="min-w-0 rounded-2xl border border-white/[.08] bg-zinc-900/75 p-3.5 text-center"><span className="mx-auto grid size-9 place-items-center text-yellow-300"><ProgressIcon kind={icon} /></span><strong className="mt-1 block text-2xl font-black text-white">{value}</strong><span className="mt-1 block text-[11px] leading-tight text-zinc-500">{label}</span></article>;
}

function EvolutionSection({ metrics, evaluationCount }: { metrics: PortalProgressMetric[]; evaluationCount: number }) {
  const [selectedKey, setSelectedKey] = useState<string>(metrics[0]?.key ?? "");
  const selected = metrics.find((metric) => metric.key === selectedKey) ?? metrics[0];
  return <section><SectionTitle>Evolución</SectionTitle><div className="rounded-[22px] border border-white/[.08] bg-[linear-gradient(145deg,#171717,#090909)] p-4 sm:p-5">
    {selected ? <><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-zinc-500">Evolución corporal</p><h3 className="mt-1 font-bold text-zinc-100">{selected.label}</h3></div>{metrics.length > 1 && <select aria-label="Métrica de evolución" value={selected.key} onChange={(event) => setSelectedKey(event.target.value)} className="min-h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-yellow-400">{metrics.map((metric) => <option key={metric.key} value={metric.key}>{metric.label}</option>)}</select>}</div>{selected.points.length > 1 ? <ProgressChart metric={selected} /> : <div className="mt-5 rounded-xl border border-dashed border-zinc-700 p-6 text-center text-sm text-zinc-500">Necesitás al menos dos evaluaciones con {selected.label.toLocaleLowerCase("es")} para ver tu evolución.</div>}</> : <EmptyState text={evaluationCount ? "Tus evaluaciones todavía no tienen métricas corporales comparables." : "Todavía no tenés evaluaciones registradas."} />}
  </div></section>;
}

function ProgressChart({ metric }: { metric: PortalProgressMetric }) {
  const chart = useMemo(() => {
    const values = metric.points.map((point) => point.value);
    const min = Math.min(...values); const max = Math.max(...values); const span = max - min || 1; const padding = span * 0.15;
    const low = min - padding; const high = max + padding;
    const points = metric.points.map((point, index) => ({ ...point, x: 24 + index * (592 / Math.max(1, metric.points.length - 1)), y: 204 - ((point.value - low) / (high - low)) * 164 }));
    return { points, path: points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" "), low, high };
  }, [metric]);
  const change = metric.change;
  return <div className="mt-4"><div className="w-full overflow-hidden"><svg viewBox="0 0 640 230" role="img" aria-label={`Evolución de ${metric.label}`} className="h-auto w-full min-w-0"><defs><linearGradient id={`progress-${metric.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#facc15" stopOpacity=".22" /><stop offset="1" stopColor="#facc15" stopOpacity="0" /></linearGradient></defs>{[40,95,150,204].map((y) => <line key={y} x1="24" x2="616" y1={y} y2={y} stroke="#3f3f46" strokeOpacity=".45" />)}<path d={`${chart.path} L616,214 L24,214 Z`} fill={`url(#progress-${metric.key})`} /><path d={chart.path} fill="none" stroke="#facc15" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />{chart.points.map((point) => <circle key={`${point.date}-${point.value}`} cx={point.x} cy={point.y} r="5" fill="#090909" stroke="#facc15" strokeWidth="3" />)}</svg></div><div className="flex justify-between text-[10px] text-zinc-600"><span>{formatDate(metric.points[0].date)}</span><span>{formatDate(metric.points.at(-1)!.date)}</span></div><p className="mt-3 text-center text-xs text-zinc-500">Cambio total: <strong className="text-yellow-300">{change !== null && change > 0 ? "+" : ""}{change === null ? "Sin datos" : `${formatNumber(change)} ${metric.unit}`}</strong></p></div>;
}

function SectionTitle({ children, compact = false }: { children: string; compact?: boolean }) { return <h2 className={`${compact ? "mb-0" : "mb-2.5"} text-lg font-black text-yellow-300`}>{children}</h2>; }
function EmptyState({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-zinc-700 bg-black/20 p-5 text-center text-sm leading-relaxed text-zinc-500">{text}</div>; }
function ProgressSkeleton() { return <div aria-label="Cargando progreso" aria-busy="true" className="mx-auto max-w-5xl animate-pulse space-y-5"><div className="h-12 w-64 max-w-full rounded-2xl bg-zinc-900" /><div className="h-64 rounded-[26px] bg-zinc-900" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-28 rounded-2xl bg-zinc-900" />)}</div><div className="h-72 rounded-[22px] bg-zinc-900" /></div>; }
