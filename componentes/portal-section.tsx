"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { PaymentAccountStatus, PhysicalEvaluation, TrainingRoutineBlock } from "@/types/gestion";
import type { PortalData, PortalWorkoutBlock, PortalWorkoutSession } from "@/types/portal";
import { PortalClasses } from "@/componentes/portal-classes";
import { dailyFocusForInstant } from "@/lib/daily-focus";
import { BODY_METRICS, BodyEvolutionCard, formatBodyValue } from "@/componentes/body-evolution-card";
import type { PortalAchievement } from "@/lib/portal-achievements";
import { StudentProfileView } from "@/componentes/student-profile-view";
import { PushNotificationsCard } from "@/componentes/push-notifications-card";
import { QuickNoteButton } from "@/componentes/quick-log";
import { hasGroupClasses } from "@/lib/student-service";
import { announceNewAchievements, type CelebrationAchievement } from "@/componentes/achievement-celebration";
import { cleanRoutineDisplayName, completedExerciseCount, getMuscleGroupEmoji, initialOpenExerciseId, usefulDayName } from "@/lib/workout-presentation";
import { separateWorkoutInstructions } from "@/lib/workout-instructions";
import { argentinaDateKey } from "@/lib/payment-dates";
import { createFreshWorkoutSets, findCurrentWeekSession, getLocalWeekEnd, getWeekKey, legacyWorkoutDraftStorageKey, sessionBelongsToWeek, workoutDraftStorageKey } from "@/lib/workout-week";
import { freshWorkoutBlock, hasBlockActivity, TRAINING_BLOCK_LABELS } from "@/lib/training-blocks";
import { isTimedBlockType } from "@/lib/block-timer";
import { WorkoutBlockTimer } from "@/componentes/workout-block-timer";

type Section = "inicio" | "rutina" | "entrenamiento" | "comentarios" | "evaluaciones" | "pagos" | "perfil" | "configuracion";
const money = (value: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
const date = (value: string) => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("es-AR") : "—";
const number = (value: number | null, suffix = "") => value === null ? "—" : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value)}${suffix}`;
const accountStatus: Record<PaymentAccountStatus, { label: string; className: string }> = {
  AL_DIA: { label: "Al día", className: "bg-emerald-400/10 text-emerald-300" },
  VENCE_PRONTO: { label: "Vence pronto", className: "bg-amber-400/10 text-amber-300" },
  VENCIDA: { label: "Vencida", className: "bg-red-400/10 text-red-300" },
  SIN_PAGOS: { label: "Sin pagos", className: "bg-yellow-400/10 text-yellow-200" },
  SIN_CONFIGURAR: { label: "Sin configurar", className: "bg-zinc-800 text-zinc-400" },
};
const billingPeriod = (value: string) => value
  ? new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T12:00:00`))
  : "";

export function PortalSection({ section }: { section: Section }) {
  const [data, setData] = useState<PortalData | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [changeRequired, setChangeRequired] = useState(false); const [reload, setReload] = useState(0);
  useEffect(() => { const controller = new AbortController(); fetch(`/api/portal/data?section=${section}`, { cache: "no-store", signal: controller.signal }).then(async (response) => { const body = await response.json() as PortalData & { error?: string; code?: string }; if (response.status === 401) { window.location.href = "/portal/login"; throw new Error("Sesión vencida."); } if (body.code === "PASSWORD_CHANGE_REQUIRED") { setChangeRequired(true); return null; } if (!response.ok) throw new Error(body.error ?? "No se pudo cargar tu información."); return body; }).then((body) => { if (body) setData(body); }).catch((loadError: unknown) => { if (loadError instanceof Error && loadError.name !== "AbortError") setError(loadError.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort(); }, [reload, section]);
  useEffect(() => {
    const refresh = () => setReload((value) => value + 1);
    window.addEventListener("bm:portal-data-refresh", refresh);
    return () => window.removeEventListener("bm:portal-data-refresh", refresh);
  }, []);
  if (loading) return <PortalLoading />;
  if (changeRequired) return <ChangePasswordCard forced onSuccess={() => { setChangeRequired(false); setLoading(true); setReload((value) => value + 1); }} />;
  if (error) return <Notice tone="error"><p>{error}</p><button onClick={() => { setLoading(true); setError(""); setReload((value) => value + 1); }} className="mt-3 rounded-lg bg-red-300 px-3 py-2 font-bold text-zinc-950">Reintentar</button></Notice>;
  if (!data) return null;
  if (section === "rutina") return <><WorkoutView data={data} /><div id="historial-entrenamientos" className="mt-8 scroll-mt-24 border-t border-zinc-800 pt-8"><WorkoutHistoryView data={data} /></div></>;
  if (section === "entrenamiento") return <WorkoutView data={data} />;
  if (section === "comentarios") return <CommentsView data={data} />;
  if (section === "evaluaciones") return <ComparativeEvaluationsView data={data} />;
  if (section === "pagos") return <PaymentsView data={data} />;
  if (section === "perfil") return <StudentProfileView profile={data.profile} />;
  if (section === "configuracion") return <PageHeader title="Configuración" subtitle="Cuenta, seguridad y notificaciones"><ChangePasswordCard /><PushNotificationsCard /><PortalLogoutCard /></PageHeader>;
  return <PortalOverview data={data} />;
}

function PortalOverview({ data }: { data: PortalData }) {
  const now = new Date();
  const todayLabel = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "long", day: "numeric", month: "long" }).format(now);
  const dailyFocus = dailyFocusForInstant(now);
  const groupClassesEnabled = hasGroupClasses(data.profile.serviceType);
  return <div className="space-y-4">
    <header className="relative overflow-hidden rounded-3xl border border-yellow-400/20 bg-[radial-gradient(circle_at_85%_10%,rgba(250,204,21,.09),transparent_35%),linear-gradient(135deg,#181818,#090909_65%)] p-4 shadow-[0_18px_45px_rgba(0,0,0,.35)] sm:p-5">
      <span aria-hidden="true" className="pointer-events-none absolute -right-10 top-3 h-px w-48 rotate-[-28deg] bg-gradient-to-r from-transparent via-yellow-400/35 to-transparent" /><span aria-hidden="true" className="pointer-events-none absolute -right-5 top-12 h-px w-40 rotate-[-28deg] bg-gradient-to-r from-transparent via-yellow-400/20 to-transparent" />
      <div className={`relative min-h-24 sm:min-h-28 ${groupClassesEnabled ? "pr-20 sm:pr-24" : ""}`}>
        <p className="flex items-center gap-2 text-xs capitalize text-zinc-400"><span aria-hidden="true" className="text-yellow-400">▣</span>{todayLabel}</p>
        <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">¡Hola, <span className="text-yellow-400">{data.profile.firstName}</span>!</h1>
        <p className="mt-1 text-sm text-zinc-400">Vamos por un día más de progreso.</p>
        {groupClassesEnabled && <MonthlyAttendanceIndicator data={data} />}
      </div>
    </header>
    <section className="flex min-w-0 items-center justify-between gap-3 overflow-hidden rounded-2xl border border-yellow-400/15 bg-gradient-to-br from-zinc-900 to-[#0b0b0b] p-3.5 shadow-[0_12px_28px_rgba(0,0,0,.24)] sm:p-4"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-yellow-400">Enfoque de hoy</p><h2 className="mt-1.5 line-clamp-2 break-words text-sm font-black leading-snug text-zinc-100 sm:text-base">{dailyFocus.title}</h2><p className="mt-1 line-clamp-2 break-words text-xs leading-relaxed text-zinc-400 sm:text-sm">{dailyFocus.reflection}</p></div><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-yellow-400/20 bg-yellow-400/[0.07] shadow-[inset_0_0_0_1px_rgba(250,204,21,.04)] sm:h-12 sm:w-12 sm:rounded-2xl"><svg aria-hidden="true" viewBox="0 0 64 64" className="h-7 w-7 text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,.24)]"><defs><linearGradient id="bolt-glow" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#fde68a" /><stop offset="100%" stopColor="#b45309" /></linearGradient></defs><path d="M34 6 18 34h12l-2 24 20-30H34l4-18Z" fill="none" stroke="url(#bolt-glow)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg></div></section>
    {groupClassesEnabled ? <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]"><PortalClasses compact /><QuotaSummaryCard data={data} /></div> : <div className="max-w-md"><QuotaSummaryCard data={data} /></div>}
    <ProgressSummary data={data} />
    <PointsSummary data={data} />
    <span id="logros" className="scroll-mt-24" />
    <AchievementsSpotlight data={data} />
    <AchievementsOverview data={data} />
    <QuickNoteButton />
  </div>;
}

function PointsSummary({ data }: { data: PortalData }) {
  const points = data.home.points;
  const progress =
    points.nextTarget > 0
      ? Math.min(100, (points.total / points.nextTarget) * 100)
      : 0;
  return (
    <section
      id="puntos"
      className="scroll-mt-24 rounded-2xl border border-yellow-400/15 bg-[radial-gradient(circle_at_92%_10%,rgba(250,204,21,.1),transparent_32%),linear-gradient(145deg,#181818,#090909)] p-4 shadow-[0_14px_35px_rgba(0,0,0,.25)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-yellow-400">
            Tus puntos
          </p>
          <p className="mt-2 text-3xl font-black text-white">
            {points.total.toLocaleString("es-AR")}
          </p>
        </div>
        <span
          aria-hidden="true"
          className="grid h-10 w-10 place-items-center rounded-full border border-yellow-400/20 bg-yellow-400/[.07] font-black text-yellow-300"
        >
          +
        </span>
      </div>
      {points.latest ? (
        <p className="mt-3 text-sm text-zinc-300">
          <strong className="text-emerald-300">
            +{points.latest.points}
          </strong>{" "}
          · {points.latest.description}
        </p>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">
          Tus próximos avances aparecerán acá.
        </p>
      )}
      <div className="mt-4 flex justify-between gap-3 text-xs text-zinc-500">
        <span>Próximo objetivo: {points.nextTarget} pts</span>
        <span>{points.pointsToNextTarget} pts restantes</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      {points.recent.length > 1 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-bold text-yellow-300">
            Ver últimos movimientos
          </summary>
          <div className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
            {points.recent.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3 text-xs"
              >
                <span className="text-zinc-400">{item.description}</span>
                <strong className="shrink-0 text-emerald-300">
                  +{item.points}
                </strong>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function MonthlyAttendanceIndicator({ data }: { data: PortalData }) {
  const percentage = data.home.monthlyAttendancePercentage ?? 0;
  const angle = Math.min(100, Math.max(0, percentage)) * 3.6;
  const attended = data.home.classesAttendedThisMonth;
  const detail = attended === 0 ? "Sin clases registradas este mes" : `${attended} ${attended === 1 ? "clase" : "clases"} este mes`;
  return <Link href="/portal/clases" aria-label={`Ver clases. Asistencia mensual ${percentage} por ciento. ${detail}`} className="absolute right-0 top-0 z-10 flex w-16 flex-col items-center gap-1 rounded-full focus:outline-none focus:ring-2 focus:ring-yellow-300" title="Ver asistencia mensual">
    <span className="relative grid h-[60px] w-[60px] place-items-center rounded-full border border-zinc-700/80 shadow-[0_8px_22px_rgba(0,0,0,.28)]" style={{ background: `conic-gradient(#facc15 ${angle}deg,#27272a 0deg)` }}><span className="absolute inset-[4px] rounded-full bg-zinc-950" /><strong className="relative text-sm font-black text-yellow-300">{percentage}%</strong></span>
    <span className="text-[8px] font-bold uppercase tracking-[.08em] text-zinc-500">Asistencia</span>
  </Link>;
}

function ProgressSummary({ data }: { data: PortalData }) {
  const physical = physicalProgressSummary(data.evaluations);
  return <section>
    <div className="flex items-center justify-between gap-3"><h2 className="text-xs font-bold uppercase tracking-[.16em] text-yellow-400">Progreso resumido</h2><Link href="/portal/evaluaciones" className="text-xs font-bold text-zinc-400 transition hover:text-yellow-300">Ver progreso ›</Link></div>
    <div className="mt-3">
      <ProgressCard title="Progreso físico" icon="◇" className="border-yellow-400/15">
        {physical ? <div>
          {physical.featured ? <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-xs text-zinc-500">{physical.featured.label}</p><p className="mt-1 text-3xl font-black tracking-tight text-white">{physical.featured.display}</p></div>
            <p className="max-w-56 rounded-full border border-yellow-400/10 bg-yellow-400/[.06] px-3 py-1.5 text-xs text-zinc-300">{physical.featured.change}</p>
          </div> : <EmptyProgress>La última evaluación no tiene medidas corporales disponibles.</EmptyProgress>}
          {physical.secondary.length > 0 && <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{physical.secondary.map((metric) => <div key={metric.key} className="min-w-0 rounded-xl border border-zinc-800/80 bg-black/35 p-3"><p className="truncate text-[10px] uppercase tracking-wide text-zinc-500">{metric.label}</p><p className="mt-1 text-sm font-bold text-zinc-100">{metric.display}</p>{metric.hasComparison && <p className="mt-1 text-[10px] leading-snug text-zinc-500">{metric.change}</p>}</div>)}</div>}
          <div className="mt-4 border-t border-zinc-800/80 pt-3">
            {physical.summary && <p className="text-xs leading-relaxed text-zinc-300">{physical.summary}</p>}
            <p className={`${physical.summary ? "mt-2" : ""} text-[10px] text-zinc-600`}>Última evaluación: {date(physical.date)}</p>
          </div>
        </div> : <EmptyProgress>Todavía no tenés evaluaciones registradas.</EmptyProgress>}
        <Link href="/portal/evaluaciones" className="mt-3 inline-flex text-xs font-bold text-yellow-300">Ver evaluaciones ›</Link>
      </ProgressCard>
    </div>
  </section>;
}

function ProgressCard({ title, icon, children, className = "" }: { title: string; icon: string; children: ReactNode; className?: string }) {
  return <article className={`min-w-0 rounded-2xl border border-zinc-800/80 bg-gradient-to-br from-zinc-900 to-[#0b0b0b] p-4 shadow-[0_12px_28px_rgba(0,0,0,.2)] ${className}`}><div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-[10px] font-bold uppercase tracking-[.14em] text-zinc-500">{title}</h3><span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-lg bg-yellow-400/10 text-yellow-400">{icon}</span></div>{children}</article>;
}

function EmptyProgress({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed text-zinc-500">{children}</p>;
}

type PhysicalSummaryKey = "weight" | "bodyFatPercentage" | "muscleMass" | "waist" | "hip";

function physicalProgressSummary(evaluations: PhysicalEvaluation[]) {
  const latest = evaluations[0];
  if (!latest) return null;
  const previous = evaluations[1];
  const definitions: Array<{ key: PhysicalSummaryKey; label: string; unit: string }> = [
    { key: "weight", label: "Peso", unit: "kg" },
    { key: "bodyFatPercentage", label: "Grasa corporal", unit: "%" },
    { key: "muscleMass", label: "Masa muscular", unit: "kg" },
    { key: "waist", label: "Cintura", unit: "cm" },
    { key: "hip", label: "Cadera", unit: "cm" },
  ];
  const metrics = definitions.flatMap((definition) => {
    const current = latest[definition.key];
    if (current === null) return [];
    const before = previous?.[definition.key] ?? null;
    const difference = before === null ? null : current - before;
    return [{
      ...definition,
      current,
      display: formatBodyValue(current, definition.unit),
      difference,
      hasComparison: difference !== null,
      change: difference === null
        ? "Sin comparación anterior"
        : difference === 0
          ? "→ Sin cambios"
          : `${difference > 0 ? "↑ Subió" : "↓ Bajó"} ${formatBodyValue(Math.abs(difference), definition.unit)}`,
      relativeChange: difference === null || before === null || before === 0 ? 0 : Math.abs(difference / before),
    }];
  });
  const featured = metrics.find((metric) => metric.key === "weight") ?? metrics[0] ?? null;
  const secondary = metrics.filter((metric) => metric.key !== featured?.key).slice(0, 4);
  const relevant = metrics.filter((metric) => metric.difference !== null && metric.difference !== 0).sort((left, right) => right.relativeChange - left.relativeChange)[0];
  const summary = relevant
    ? `${relevant.label} ${relevant.difference! > 0 ? "subió" : "bajó"} ${formatBodyValue(Math.abs(relevant.difference!), relevant.unit)} respecto a la evaluación anterior.`
    : previous && metrics.some((metric) => metric.hasComparison)
      ? "Las mediciones comparables se mantienen sin cambios."
      : "";
  return { date: latest.date, featured, secondary, summary };
}

function AchievementsSpotlight({ data }: { data: PortalData }) {
  const unlocked = data.home.achievements.filter((achievement) => achievement.unlocked).sort((left, right) => right.unlockedAt.localeCompare(left.unlockedAt));
  const upcoming = data.home.achievements.filter((achievement) => !achievement.unlocked && achievement.progress > 0).sort((left, right) => right.progress / right.target - left.progress / left.target);
  const latest = unlocked[0];
  const next = upcoming[0];
  if (!latest && !next) return null;
  return <section className="relative overflow-hidden rounded-2xl border border-yellow-400/15 bg-[linear-gradient(145deg,#181818,#090909)] p-4 shadow-[0_14px_35px_rgba(0,0,0,.25)]"><span aria-hidden="true" className="absolute -right-5 -top-5 h-24 w-24 rotate-45 border border-yellow-400/10" /><div className="relative flex items-center justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-yellow-400">Tus logros</p><span className="rounded-full border border-yellow-400/15 bg-yellow-400/5 px-2.5 py-1 text-xs font-bold text-yellow-200">{unlocked.length} obtenidos</span></div>{latest && <div className="relative mt-4 flex items-start gap-3"><span aria-hidden="true" className="grid h-11 w-11 shrink-0 rotate-45 place-items-center rounded-lg border border-yellow-400/25 bg-black text-xl text-yellow-400 shadow-[0_0_18px_rgba(250,204,21,.08)]"><span className="-rotate-45">{latest.icon}</span></span><div><p className="text-xs text-zinc-500">Último logro</p><p className="mt-1 font-bold">{latest.name}</p><p className="mt-1 text-xs text-zinc-500">{date(latest.unlockedAt)}{latest.category ? ` · ${latest.category.replaceAll("_", " ")}` : ""}</p></div></div>}{next && <div className="relative mt-4 rounded-xl border border-zinc-800 bg-black/45 p-3"><div className="flex justify-between gap-3 text-xs"><span><span className="block text-zinc-500">Próximo objetivo</span><strong className="mt-1 block text-zinc-200">{next.name}</strong></span><span className="self-end text-zinc-400">{next.progress} de {next.target}</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300" style={{ width: `${Math.min(100, next.progress / next.target * 100)}%` }} /></div></div>}</section>;
}

function AchievementsOverview({ data }: { data: PortalData }) {
  const unlocked = data.home.achievements.filter((achievement) => achievement.unlocked).sort((left, right) => right.unlockedAt.localeCompare(left.unlockedAt));
  const upcoming = data.home.achievements.filter((achievement) => !achievement.unlocked && achievement.progress > 0).sort((left, right) => right.progress / right.target - left.progress / left.target);
  const categories = [...new Set(data.home.achievements.map((achievement) => achievement.category).filter(Boolean))];
  if (!unlocked.length && !upcoming.length) return null;
  return <details className="rounded-xl border border-zinc-800 bg-[#101010] p-3"><summary className="cursor-pointer list-none text-center text-sm font-bold text-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400">Ver todos los logros</summary><div className="mt-4 space-y-5 border-t border-zinc-800 pt-4">{categories.map((category) => <section key={category}><h3 className="text-xs font-bold tracking-wider text-zinc-400">{category?.replaceAll("_", " ")}</h3><div className="mt-2 space-y-2">{unlocked.filter((achievement) => achievement.category === category).map((achievement) => <AchievementCard key={achievement.id} achievement={achievement} compact />)}{upcoming.filter((achievement) => achievement.category === category).map((achievement) => <div key={achievement.id} className="rounded-lg bg-zinc-950 p-3 text-zinc-500"><div className="flex justify-between gap-3 text-xs"><span><strong className="block text-zinc-400">{achievement.name}</strong><span className="mt-1 block">{achievement.description}</span></span><span className="shrink-0">{achievement.progress} de {achievement.target}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-zinc-600" style={{ width: `${Math.min(100, achievement.progress / achievement.target * 100)}%` }} /></div></div>)}</div></section>)}</div></details>;
}

function AchievementCard({ achievement, compact = false }: { achievement: PortalAchievement; compact?: boolean }) {
  return <article className={`flex items-start gap-3 ${compact ? "rounded-lg bg-zinc-950 p-3" : "rounded-xl border border-zinc-800 bg-zinc-900 p-3"}`}><span aria-hidden="true" className="text-lg text-yellow-400">{achievement.icon}</span><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{achievement.name}</p>{achievement.level && <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[9px] font-bold text-zinc-400">{achievement.level}</span>}</div>{achievement.exercise && <p className="mt-1 text-xs font-semibold text-yellow-200">{achievement.exercise} · {achievement.source === "CLASS" ? "Clase presencial" : achievement.source === "QUICK_LOG" ? "Registro personal" : "Rutina personalizada"}</p>}<p className="mt-1 text-xs text-zinc-500">{achievement.description}</p>{achievement.previousValue && achievement.newValue && <p className="mt-1 text-xs text-zinc-400">{achievement.previousValue} → {achievement.newValue}</p>}{achievement.feedback && <p className="mt-2 rounded-lg bg-yellow-400/[.05] p-2 text-xs text-zinc-300">Devolución: {achievement.feedback}</p>}<p className="mt-2 text-[10px] text-zinc-600">{date(achievement.unlockedAt)}</p></div></article>;
}

function ComparativeEvaluationsView({ data }: { data: PortalData }) {
  return <EvaluationsView data={data} />;
}

function QuotaSummaryCard({ data }: { data: PortalData }) {
  const account = data.paymentAccount;
  const status = accountStatus[account.status];
  return <section className="flex h-full min-h-44 flex-col rounded-2xl border border-yellow-400/15 bg-[radial-gradient(circle_at_90%_0%,rgba(250,204,21,.08),transparent_38%),linear-gradient(145deg,#171717,#090909)] p-4 shadow-[0_14px_35px_rgba(0,0,0,.28)]">
    <div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-yellow-400">Tu cuota</p><span aria-hidden="true" className="text-yellow-400">◇</span></div>
    {account.configured ? <><p className="mt-4 text-2xl font-black">{money(account.monthlyFee)}</p><span className={`mt-2 self-start rounded-full px-2.5 py-1 text-xs font-bold ${status.className}`}>{status.label}</span>{account.nextDueDate && <p className="mt-2 text-xs text-zinc-500">{account.status === "VENCIDA" ? "Venció" : "Próximo vencimiento"}: <span className="text-zinc-300">{date(account.nextDueDate)}</span></p>}</> : <div className="my-auto"><p className="text-sm font-semibold text-zinc-300">Cuota sin configurar</p><p className="mt-1 text-xs text-zinc-600">Consultá con tu entrenador.</p></div>}
    <Link href="/portal/pagos" className="mt-auto pt-4 text-xs font-bold text-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400">Ver detalle ›</Link>
  </section>;
}

function evaluationMeasurements(evaluation: PhysicalEvaluation) {
  return [
    { key: "weight", label: "Peso", value: evaluation.weight, unit: "kg" },
    { key: "height", label: "Altura", value: evaluation.height, unit: "m" },
    { key: "bmi", label: "IMC", value: evaluation.bmi, unit: "" },
    { key: "bodyFatPercentage", label: "Grasa corporal", value: evaluation.bodyFatPercentage, unit: "%" },
    { key: "muscleMass", label: "Masa muscular", value: evaluation.muscleMass, unit: "kg" },
    { key: "visceralFat", label: "Grasa visceral", value: evaluation.visceralFat, unit: "" },
    { key: "waist", label: "Cintura", value: evaluation.waist, unit: "cm" },
    { key: "hip", label: "Cadera", value: evaluation.hip, unit: "cm" },
    { key: "chest", label: "Pecho", value: evaluation.chest, unit: "cm" },
    { key: "rightArm", label: "Brazo derecho", value: evaluation.rightArm, unit: "cm" },
    { key: "leftArm", label: "Brazo izquierdo", value: evaluation.leftArm, unit: "cm" },
    { key: "rightThigh", label: "Muslo derecho", value: evaluation.rightThigh, unit: "cm" },
    { key: "leftThigh", label: "Muslo izquierdo", value: evaluation.leftThigh, unit: "cm" },
    { key: "rightCalf", label: "Pantorrilla derecha", value: evaluation.rightCalf, unit: "cm" },
    { key: "leftCalf", label: "Pantorrilla izquierda", value: evaluation.leftCalf, unit: "cm" },
  ].flatMap((item) => item.value === null ? [] : [{
    ...item,
    display: item.key === "height"
      ? `${new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.value)} m`
      : formatBodyValue(item.value, item.unit),
  }]);
}

function EvaluationsView({ data }: { data: PortalData }) {
  const latest = data.evaluations[0];
  const previous = data.evaluations[1];
  const measurements = latest ? evaluationMeasurements(latest) : [];
  if (!latest) return <PageHeader title="Mis evaluaciones" subtitle="Tu evolución física"><Notice>Todavía no hay evaluaciones registradas.</Notice></PageHeader>;
  const summaryKeys = new Set(["weight", "bmi", "bodyFatPercentage", "muscleMass"]);
  const summary = measurements.filter((item) => summaryKeys.has(item.key));
  const bodyMeasures = measurements.filter((item) => !summaryKeys.has(item.key));
  const symmetry = [
    { label: "Brazos", right: latest.rightArm, left: latest.leftArm },
    { label: "Muslos", right: latest.rightThigh, left: latest.leftThigh },
    { label: "Pantorrillas", right: latest.rightCalf, left: latest.leftCalf },
  ].filter((item): item is { label: string; right: number; left: number } => item.right !== null && item.left !== null);
  return <PageHeader title="Mis evaluaciones" subtitle="Consulta tus mediciones; solo tu entrenador puede modificarlas">
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-wider text-yellow-400">Última evaluación</p><p className="mt-1 font-bold">{date(latest.date)}</p></div><span className="text-xs text-zinc-500">{measurements.length} mediciones</span></div>{summary.length > 0 && <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{summary.map((item) => <SmallMetric key={item.key} title={item.label} value={item.display} />)}</div>}{latest.notes && <p className="mt-4 rounded-xl bg-zinc-950 p-3 text-sm text-zinc-400">{latest.notes}</p>}</section>
    <div className="mt-5"><BodyEvolutionCard evaluations={data.evaluations} /></div>
    <section className="mt-5"><h2 className="font-semibold">Comparación anterior</h2>{previous ? <><p className="mt-1 text-xs text-zinc-500">{date(previous.date)} → {date(latest.date)}</p><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{BODY_METRICS.flatMap((metric) => { const current = latest[metric.key]; const before = previous[metric.key]; if (current === null || before === null) return []; const difference = current - before; return [<article key={metric.key} className="rounded-xl bg-zinc-900 p-3"><p className="text-xs text-zinc-500">{metric.label}</p><p className="mt-1 text-sm font-semibold">{formatBodyValue(before, metric.unit)} → {formatBodyValue(current, metric.unit)}</p><p className="mt-1 text-xs text-zinc-300">{difference > 0 ? "↑ +" : difference < 0 ? "↓ " : "→ "}{formatBodyValue(difference, metric.unit)}</p></article>]; })}</div></> : <p className="mt-3 text-sm text-zinc-500">Todavía no hay datos suficientes para comparar.</p>}</section>
    {bodyMeasures.length > 0 && <section className="mt-5"><h2 className="font-semibold">Medidas corporales</h2><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{bodyMeasures.map((item) => <SmallMetric key={item.key} title={item.label} value={item.display} />)}</div></section>}
    {symmetry.length > 0 && <section className="mt-5"><h2 className="font-semibold">Simetría corporal</h2><p className="mt-1 text-xs text-zinc-500">Comparación informativa, sin interpretación médica.</p><div className="mt-3 grid gap-2 sm:grid-cols-3">{symmetry.map((item) => { const difference = Math.abs(item.right - item.left); const greater = item.right === item.left ? "Sin diferencia" : item.right > item.left ? "Mayor medida: derecho" : "Mayor medida: izquierdo"; return <article key={item.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3"><p className="font-semibold">{item.label}</p><p className="mt-2 text-xs text-zinc-400">Derecho {formatBodyValue(item.right, "cm")} · Izquierdo {formatBodyValue(item.left, "cm")}</p><p className="mt-2 text-xs text-zinc-500">Diferencia {formatBodyValue(difference, "cm")} · {greater}</p></article>; })}</div></section>}
    <section className="mt-5"><h2 className="font-semibold">Historial de evaluaciones</h2><div className="mt-3 space-y-2">{data.evaluations.map((item) => <details key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3"><summary className="cursor-pointer list-none"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold">{date(item.date)}</p><p className="mt-1 text-xs text-zinc-500">{item.weight === null ? "Evaluación corporal" : formatBodyValue(item.weight, "kg")}{item.bmi === null ? "" : ` · IMC ${number(item.bmi)}`}</p></div><span className="text-sm font-bold text-yellow-400">Ver detalle</span></div></summary><div className="mt-3 grid grid-cols-2 gap-2 border-t border-zinc-800 pt-3 sm:grid-cols-4">{evaluationMeasurements(item).map((measurement) => <SmallMetric key={measurement.key} title={measurement.label} value={measurement.display} />)}</div>{item.notes && <p className="mt-3 rounded-xl bg-zinc-950 p-3 text-sm text-zinc-400">{item.notes}</p>}</details>)}</div></section>
  </PageHeader>;
}

function PaymentsView({ data }: { data: PortalData }) {
  const [visibleCount, setVisibleCount] = useState(8);
  const account = data.paymentAccount;
  const status = accountStatus[account.status];
  return <PageHeader title="Mi cuota" subtitle="Estado e historial personal de pagos">
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-zinc-500">Estado actual</p><span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-sm font-bold ${status.className}`}>{status.label}</span></div>{account.monthlyFee > 0 && <p className="text-2xl font-bold">{money(account.monthlyFee)}<span className="ml-1 text-xs font-normal text-zinc-500">por mes</span></p>}</div>
      {account.configured ? <><dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><SmallMetric title="Próximo vencimiento" value={date(account.nextDueDate)} /><SmallMetric title="Plan" value={account.plan || "Sin detalle"} /><SmallMetric title="Último pago" value={account.lastPaymentDate ? date(account.lastPaymentDate) : "Sin registrar"} /><SmallMetric title="Importe del último pago" value={account.lastPaymentAmount === null ? "Sin pagos" : money(account.lastPaymentAmount)} /></dl>{account.status === "SIN_PAGOS" && <p className="mt-3 rounded-lg bg-yellow-400/5 px-3 py-2 text-sm text-yellow-100">Tu cuota todavía no registra pagos.</p>}</> : <p className="mt-4 text-sm text-zinc-400">Todavía no tenés una cuota configurada.</p>}
    </section>
    <section className="mt-5">
      <h2 className="font-semibold">Historial de pagos</h2>
      {data.payments.length ? <div className="mt-3 space-y-2">{data.payments.slice(0, visibleCount).map((payment) => <article key={payment.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{date(payment.paidDate || payment.createdAt)}</p><p className="mt-1 text-xs capitalize text-zinc-500">{billingPeriod(payment.billingPeriod) || payment.concept}</p></div><div className="text-right"><p className="font-bold">{money(payment.amount)}</p><span className="mt-1 inline-flex rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">Confirmado</span></div></div><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-400"><span>{payment.method || "Medio no informado"}</span>{payment.concept && billingPeriod(payment.billingPeriod) && <span>{payment.concept}</span>}</div>{payment.notes && <p className="mt-2 border-t border-zinc-800 pt-2 text-xs text-zinc-400">{payment.notes}</p>}</article>)}</div> : <Notice>Todavía no hay pagos registrados.</Notice>}
      {visibleCount < data.payments.length && <button type="button" onClick={() => setVisibleCount((count) => count + 10)} className="mt-3 rounded-lg border border-zinc-700 px-3 py-2 text-sm font-bold text-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400">Ver más pagos</button>}
    </section>
    <section className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900 p-4"><h2 className="font-semibold">Medios de pago</h2>{data.paymentMethods.length ? <ul className="mt-3 space-y-2">{data.paymentMethods.map((method) => <li key={method} className="rounded-lg bg-zinc-950 px-3 py-2 text-sm text-zinc-300">{method}</li>)}</ul> : <p className="mt-2 text-sm text-zinc-500">Consultá con tu entrenador para conocer los medios de pago.</p>}<p className="mt-3 text-xs text-zinc-600">Los pagos son confirmados únicamente por el entrenador.</p></section>
  </PageHeader>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PortalSchedules({ data }: { data: PortalData }) {
  const { scheduleLabels, flexibleSchedule } = data.profile;
  if (!scheduleLabels.length && !flexibleSchedule) return null;
  return <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
    <h2 className="font-semibold">Tus horarios</h2>
    {scheduleLabels.length > 0 && <ul className="mt-3 space-y-2">{scheduleLabels.map((label) => <li key={label} className="rounded-lg bg-zinc-950 px-3 py-2 text-sm text-zinc-300">{label}</li>)}</ul>}
    {flexibleSchedule && <p className="mt-3 text-sm text-zinc-400">Horario habitual: <span className="font-semibold text-zinc-200">{flexibleSchedule}</span></p>}
  </section>;
}

function WorkoutView({ data }: { data: PortalData }) {
  const routine = data.routine;
  const weekKey = getWeekKey();
  const trainingDays = useMemo(() => routine?.days.filter((day) => day.blocks.length) ?? [], [routine]);
  const suggestedDayId = useMemo(() => {
    if (!routine || !trainingDays.length) return "";
    const lastCompleted = data.workoutSessions.find((session) => session.routineId === routine.id && session.status === "finalizado" && trainingDays.some((day) => day.id === session.dayId));
    if (!lastCompleted) return trainingDays[0].id;
    const lastIndex = trainingDays.findIndex((day) => day.id === lastCompleted.dayId);
    return trainingDays[(lastIndex + 1) % trainingDays.length]?.id ?? trainingDays[0].id;
  }, [data.workoutSessions, routine, trainingDays]);
  const inProgress = useMemo(() => data.workoutSessions.find((session) => session.status === "en_progreso" && session.routineId === routine?.id && sessionBelongsToWeek(session, weekKey) && trainingDays.some((day) => day.id === session.dayId)) ?? null, [data.workoutSessions, routine?.id, trainingDays, weekKey]);
  const [selectedDayId, setSelectedDayId] = useState(inProgress?.dayId ?? suggestedDayId);
  const [draft, setDraft] = useState<PortalWorkoutSession | null>(inProgress);
  const [saving, setSaving] = useState(false);
  const [savingAction, setSavingAction] = useState<"draft" | "final" | null>(null);
  const [started, setStarted] = useState(Boolean(inProgress));
  const [finalOpen, setFinalOpen] = useState(false);
  const [allowIncomplete, setAllowIncomplete] = useState(false);
  const [sensation, setSensation] = useState("");
  const [painLocation, setPainLocation] = useState("");
  const [painIntensity, setPainIntensity] = useState<number | null>(null);
  const [completionSuccess, setCompletionSuccess] = useState(false);
  const [warmupOpen, setWarmupOpen] = useState(false);
  const [openExerciseId, setOpenExerciseId] = useState<string | null>(() => initialOpenExerciseId(inProgress?.exercises ?? []));
  const [openBlockId, setOpenBlockId] = useState<string | null>(null);
  const autosaveSignature = useRef("");
  const autosaveAbortRef = useRef<AbortController | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const selectedDay = trainingDays.find((day) => day.id === selectedDayId);

  useEffect(() => {
    if (!warmupOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setWarmupOpen(false); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [warmupOpen]);

  useEffect(() => {
    const delay = Math.max(1_000, getLocalWeekEnd().getTime() - Date.now() + 1_001);
    const timer = window.setTimeout(() => window.location.reload(), delay);
    return () => window.clearTimeout(timer);
  }, [weekKey]);

  const storageKey = useCallback((dayId: string) => {
    return routine ? workoutDraftStorageKey(data.profile.id, routine.id, dayId, weekKey) : "";
  }, [data.profile.id, routine, weekKey]);

  function freshDraft(dayId: string): PortalWorkoutSession | null {
    const day = trainingDays.find((item) => item.id === dayId);
    if (!routine || !day) return null;
    const todayKey = argentinaDateKey();
    const databaseSession = findCurrentWeekSession(data.workoutSessions, { routineId: routine.id, dayId, weekKey });
    if (databaseSession) return databaseSession;
    const currentStorageKey = storageKey(dayId);
    const saved = typeof window === "undefined" ? null : window.localStorage.getItem(currentStorageKey);
    if (typeof window !== "undefined") window.localStorage.removeItem(legacyWorkoutDraftStorageKey(data.profile.id, dayId));
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as PortalWorkoutSession;
        if (parsed.routineId === routine.id && parsed.dayId === dayId && parsed.status === "en_progreso" && sessionBelongsToWeek(parsed, weekKey)) return parsed;
        window.localStorage.removeItem(currentStorageKey);
      } catch { window.localStorage.removeItem(currentStorageKey); }
    }
    const now = new Date();
    const dateKey = todayKey;
    const startTime = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
    const strengthExercises = day.blocks.filter((block) => block.type === "STRENGTH").flatMap((block) => block.exercises);
    return { routineId: routine.id, routineName: routine.name, dayId: day.id, dayNumber: day.dayNumber, dayName: day.name, dayEstimatedMinutes: day.estimatedMinutes, date: dateKey, startTime, durationMinutes: null, energyBefore: null, difficulty: null, energyAfter: null, finalComment: "", hasPain: false, painDetails: "", status: "en_progreso" as const, blocks: day.blocks.map(freshWorkoutBlock), exercises: strengthExercises.map((exercise) => {
      const previousLogs = data.workoutSessions.flatMap((session) => session.exercises.filter((item) => item.exerciseId === exercise.id).map((item) => ({ session, item })));
      const previous = previousLogs[0];
      return { exerciseId: exercise.id, exerciseName: exercise.name, observation: "", previous: previous?.item.sets[0] ? { date: previous.session.date, weight: previous.item.sets[0].weight, repetitions: previous.item.sets[0].repetitions, effort: previous.item.sets[0].effort } : null, history: previousLogs.slice(0, 8).flatMap(({ session, item }) => item.sets[0] ? [{ date: session.date, weight: item.sets[0].weight, repetitions: item.sets[0].repetitions, effort: item.sets[0].effort }] : []), sets: createFreshWorkoutSets(exercise.sets, exercise.weight, previous?.item.sets ?? []) };
    }) };
  }

  useEffect(() => {
    if (draft || !selectedDayId) return;
    const timer = window.setTimeout(() => {
      const next = freshDraft(selectedDayId);
      setDraft(next);
      setOpenExerciseId(initialOpenExerciseId(next?.exercises ?? []));
      const saved = window.localStorage.getItem(storageKey(selectedDayId));
      setStarted(next?.status === "en_progreso" && Boolean(next.id || saved));
    }, 0);
    return () => window.clearTimeout(timer);
    // freshDraft reads the current server payload; this initialization only runs while draft is empty.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.profile.id, draft, selectedDayId]);

  function chooseDay(dayId: string) {
    if (started && draft?.status === "en_progreso" && dayId !== draft.dayId && !window.confirm("Hay un entrenamiento en progreso. Se conservará por separado. ¿Querés cambiar de día?")) return;
    const next = freshDraft(dayId);
    setSelectedDayId(dayId);
    setDraft(next);
    setOpenExerciseId(initialOpenExerciseId(next?.exercises ?? []));
    setStarted(next?.status === "en_progreso" && Boolean(next.id || window.localStorage.getItem(storageKey(dayId))));
    setMessage("");
    setError("");
    setFinalOpen(false);
  }

  function beginWith(next: PortalWorkoutSession) {
    if (started) return next;
    const now = new Date();
    const dateValue = argentinaDateKey(now);
    const timeValue = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
    setStarted(true);
    return { ...next, date: dateValue, startTime: timeValue, status: "en_progreso" as const };
  }

  function updateSet(exerciseIndex: number, setIndex: number, changes: Partial<PortalWorkoutSession["exercises"][number]["sets"][number]>) {
    if (!draft) return;
    const exercises = [...draft.exercises];
    const exercise = exercises[exerciseIndex];
    const sets = [...exercise.sets];
    sets[setIndex] = { ...sets[setIndex], ...changes };
    const next = beginWith({ ...draft, exercises: exercises.map((item, index) => index === exerciseIndex ? { ...exercise, sets } : item) });
    setDraft(next);
    window.localStorage.setItem(storageKey(next.dayId), JSON.stringify(next));
  }

  function updateBlockResult(blockId: string, changes: Partial<NonNullable<PortalWorkoutSession["blocks"]>[number]["result"]>) {
    if (!draft) return;
    const next = beginWith({ ...draft, blocks: (draft.blocks ?? []).map((block) => block.blockId === blockId ? { ...block, result: { ...block.result, ...changes } } : block) });
    setDraft(next);
    window.localStorage.setItem(storageKey(next.dayId), JSON.stringify(next));
  }

  async function completeBlockResult(blockId: string, changes: Partial<NonNullable<PortalWorkoutSession["blocks"]>[number]["result"]>) {
    if (!draft) throw new Error("No hay una sesión activa.");
    const next = beginWith({ ...draft, blocks: (draft.blocks ?? []).map((block) => block.blockId === blockId ? { ...block, result: { ...block.result, ...changes } } : block) });
    const signature = JSON.stringify(next);
    autosaveAbortRef.current?.abort();
    autosaveSignature.current = signature;
    setError("");
    try {
      if (process.env.NODE_ENV === "development") console.info("Guardando resultado de bloque", { routineId: next.routineId, dayId: next.dayId, sessionId: next.id ?? null, blockId, payload: next });
      const response = await fetch("/api/portal/entrenamientos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...next, status: "en_progreso" }) });
      const body = await response.json() as { id?: string; error?: string; developmentDetail?: string };
      if (process.env.NODE_ENV === "development") console.info("Respuesta al guardar bloque", { status: response.status, body });
      if (!response.ok) throw new Error(process.env.NODE_ENV === "development" && body.developmentDetail ? `${body.error ?? "No se pudo guardar."} ${body.developmentDetail}` : body.error ?? "No se pudo guardar el entrenamiento.");
      const saved = { ...next, id: body.id ?? next.id };
      autosaveSignature.current = JSON.stringify(saved);
      window.localStorage.setItem(storageKey(saved.dayId), JSON.stringify(saved));
      setDraft((current) => current?.dayId === next.dayId ? saved : current);
    } catch (value) {
      autosaveSignature.current = "";
      const message = value instanceof Error ? value.message : "No se pudo guardar el entrenamiento.";
      console.error("Error al guardar resultado de bloque", value);
      setError(message);
      throw value;
    }
  }

  useEffect(() => {
    if (!started || !draft || draft.status === "finalizado") return;
    window.localStorage.setItem(storageKey(draft.dayId), JSON.stringify(draft));
    const signature = JSON.stringify(draft);
    if (signature === autosaveSignature.current) return;
    const controller = new AbortController();
    autosaveAbortRef.current = controller;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/portal/entrenamientos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, status: "en_progreso" }), signal: controller.signal });
        const body = await response.json() as { id?: string; error?: string };
        if (!response.ok) throw new Error(body.error ?? "No se pudo guardar automáticamente.");
        autosaveSignature.current = signature;
        if (!draft.id && body.id) setDraft((current) => current?.dayId === draft.dayId ? { ...current, id: body.id } : current);
      } catch (value) {
        if (value instanceof DOMException && value.name === "AbortError") return;
        setError(value instanceof Error ? value.message : "No se pudo guardar automáticamente.");
      }
    }, 900);
    return () => { window.clearTimeout(timer); controller.abort(); if (autosaveAbortRef.current === controller) autosaveAbortRef.current = null; };
  }, [data.profile.id, draft, started, storageKey]);
  async function save(finalize = false) {
    if (!draft) return;
    setSaving(true); setSavingAction(finalize ? "final" : "draft"); setError(""); setMessage("");
    try {
      const duration = draft.durationMinutes;
      const finalComment = finalize && sensation ? `Sensación general: ${sensation}${draft.finalComment.trim() ? `\n${draft.finalComment.trim()}` : ""}` : draft.finalComment;
      const painDetails = finalize && draft.hasPain
        ? [`Zona: ${painLocation.trim() || "sin especificar"}`, painIntensity ? `Intensidad: ${painIntensity}/10` : "", draft.painDetails.trim()].filter(Boolean).join(" · ")
        : draft.painDetails;
      const payload = { ...draft, durationMinutes: duration, generalFeeling: finalize ? sensation as PortalWorkoutSession["generalFeeling"] : draft.generalFeeling, finalComment, painDetails, status: finalize ? "finalizado" as const : "en_progreso" as const };
      const response = await fetch("/api/portal/entrenamientos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json() as { id?: string; error?: string; achievements?: PortalAchievement[]; newAchievements?: CelebrationAchievement[] };
      if (!response.ok) throw new Error(body.error ?? "No se pudo guardar.");
      announceNewAchievements(body.newAchievements);
      const updated = { ...payload, id: body.id };
      if (finalize) {
        window.localStorage.removeItem(storageKey(draft.dayId));
        autosaveSignature.current = "";
        setStarted(false);
        setFinalOpen(false);
        setDraft(null);
        setCompletionSuccess(true);
        setMessage("Tu entrenamiento se guardó con éxito.");
        window.setTimeout(() => window.location.assign("/portal/rutina#historial-entrenamientos"), body.newAchievements?.length ? 4200 : 1400);
      } else {
        setDraft(updated);
        setMessage("Progreso guardado.");
      }
    } catch (value) { setError(value instanceof Error ? value.message : "No se pudo guardar."); }
    finally { setSaving(false); setSavingAction(null); }
  }
  function openFinalSummary() {
    if (!draft || !started) return;
    setAllowIncomplete(false);
    setFinalOpen(true);
  }
  if (!routine || !selectedDay) return <PageHeader title="Mi rutina" subtitle="Tu planificación activa"><Notice>Todavía no tenés una rutina activa.</Notice></PageHeader>;
  const totalSets = draft?.exercises.reduce((total, exercise) => total + exercise.sets.length, 0) ?? 0;
  const completedTotal = draft?.exercises.reduce((total, exercise) => total + exercise.sets.filter((set) => set.completed).length, 0) ?? 0;
  const completedExercises = completedExerciseCount(draft?.exercises ?? []);
  const conditioningBlocks = selectedDay.blocks.filter((block) => block.type !== "STRENGTH");
  const completedConditioningBlocks = (draft?.blocks ?? []).filter((block) => block.blockType !== "STRENGTH" && hasBlockActivity(block)).length;
  const totalActivities = selectedDay.blocks.filter((block) => block.type === "STRENGTH").reduce((sum, block) => sum + block.exercises.length, 0) + conditioningBlocks.length;
  const completedActivities = completedExercises + completedConditioningBlocks;
  const routineDisplayName = cleanRoutineDisplayName(routine.name) || routine.name;
  const selectedDayName = usefulDayName(selectedDay.dayNumber, selectedDay.name);
  const dayFocus = selectedDay.objective || selectedDayName || routine.objective || `Día ${selectedDay.dayNumber}`;
  const muscleGroupEmoji = getMuscleGroupEmoji([selectedDay.name, selectedDay.objective, ...selectedDay.exercises.map((exercise) => exercise.muscleGroup)].join(" "));
  const dayProgress = totalActivities ? completedActivities / totalActivities * 100 : 0;
  const dayStateLabel = completedActivities === totalActivities && totalActivities ? "Completado" : started ? "En curso" : "Sin comenzar";
  const incomplete = completedActivities < totalActivities;
  return <>
    <header className="mb-3"><p className="text-sm font-semibold text-zinc-400">{routineDisplayName}</p></header>
    <div aria-label="Días de la rutina" className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">{trainingDays.map((day) => {
      const usefulName = usefulDayName(day.dayNumber, day.name);
      return <button type="button" key={day.id} onClick={() => chooseDay(day.id)} aria-pressed={day.id === selectedDayId} className={`min-h-11 shrink-0 rounded-xl border px-4 py-2 text-left text-sm font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-yellow-300 ${day.id === selectedDayId ? "border-yellow-300 bg-yellow-400 text-zinc-950" : "border-zinc-800 bg-zinc-900 text-zinc-300"}`}>Día {day.dayNumber}{usefulName && <span className="block max-w-32 truncate text-[10px] font-normal opacity-70">{usefulName}</span>}</button>;
    })}</div>
    <section className="relative mb-5 overflow-hidden rounded-3xl border border-yellow-400/20 bg-[radial-gradient(circle_at_10%_10%,rgba(250,204,21,.11),transparent_34%),linear-gradient(145deg,#1b1b1b,#0a0a0a)] p-4 shadow-[0_18px_42px_rgba(0,0,0,.34)]">
      <span className={`absolute right-3 top-3 rounded-full border px-2.5 py-1 text-[10px] font-bold ${dayStateLabel === "Completado" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : dayStateLabel === "En curso" ? "border-yellow-400/25 bg-yellow-400/10 text-yellow-300" : "border-zinc-700 bg-zinc-800/90 text-zinc-400"}`}>{dayStateLabel}</span>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 pt-7">
        <span aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-2xl border border-yellow-400/20 bg-yellow-400/[.07] text-2xl leading-none shadow-[inset_0_0_0_1px_rgba(250,204,21,.03)]">{muscleGroupEmoji}</span>
        <div className="min-w-0"><p className="truncate text-lg font-black text-white">{dayFocus}</p><div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-zinc-400"><span>{selectedDay.blocks.length} bloques · {selectedDay.exercises.length} ejercicios</span>{selectedDay.estimatedMinutes && <span>· {selectedDay.estimatedMinutes} min duración</span>}{selectedDay.id === suggestedDayId && <span className="text-yellow-300">· Día sugerido</span>}</div></div>
        <div aria-label={`${completedActivities} de ${totalActivities} actividades completadas`} className="grid h-16 w-16 shrink-0 place-items-center rounded-full p-[4px]" style={{ background: `conic-gradient(#facc15 ${dayProgress * 3.6}deg,#27272a 0deg)` }}><span className="grid h-full w-full place-items-center rounded-full bg-zinc-950 text-center"><span><strong className="block text-sm font-black text-white">{completedActivities}/{totalActivities}</strong><small className="block text-[7px] uppercase tracking-wide text-zinc-500">completados</small></span></span></div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-[10px] text-zinc-500"><span>Progreso del día</span><span>{Math.round(dayProgress)}%</span></div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-[width]" style={{ width: `${dayProgress}%` }} /></div>
    </section>
    {selectedDay.warmup.trim() && <button type="button" onClick={() => setWarmupOpen(true)} className="mb-4 flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-yellow-400/20 bg-zinc-900 px-3.5 py-2.5 text-left text-sm font-bold text-yellow-200 outline-none transition hover:border-yellow-400/40 focus-visible:ring-2 focus-visible:ring-yellow-300"><span>🔥 Ver entrada en calor</span><span aria-hidden="true" className="text-zinc-500">›</span></button>}
    {completionSuccess && <div role="status" aria-live="polite" className="fixed inset-x-4 top-[calc(env(safe-area-inset-top)+1rem)] z-[100] mx-auto max-w-md rounded-xl border border-emerald-400/40 bg-zinc-950 px-4 py-3 text-center font-semibold text-emerald-200 shadow-2xl">Entrenamiento cargado correctamente</div>}
    {message && <p className="mb-4 rounded-xl bg-emerald-400/10 p-3 text-emerald-200">{message}</p>}{error && <p className="mb-4 rounded-xl bg-red-400/10 p-3 text-red-200">{error}</p>}{!draft && !completionSuccess && <p className="rounded-xl bg-zinc-900 p-4 text-sm text-zinc-500">Preparando ejercicios…</p>}
    {warmupOpen && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setWarmupOpen(false); }} className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-black/80 px-3 pb-[calc(env(safe-area-inset-bottom)+.75rem)] pt-[calc(env(safe-area-inset-top)+.75rem)] backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-labelledby="warmup-title" className="max-h-[82dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-yellow-400/25 bg-zinc-950 p-4 text-white shadow-2xl sm:p-5"><header className="flex items-start justify-between gap-4"><div className="min-w-0"><h2 id="warmup-title" className="text-lg font-black">Entrada en calor</h2><p className="mt-1 text-sm text-yellow-300">Día {selectedDay.dayNumber} · {selectedDay.objective || selectedDay.name}</p></div><button type="button" onClick={() => setWarmupOpen(false)} aria-label="Cerrar entrada en calor" className="grid size-9 shrink-0 place-items-center rounded-lg text-xl text-zinc-400 hover:bg-zinc-800 hover:text-white">×</button></header><p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-200">{selectedDay.warmup}</p><button type="button" onClick={() => setWarmupOpen(false)} className="mt-5 min-h-11 w-full rounded-xl border border-zinc-700 px-4 text-sm font-bold text-zinc-200">Cerrar</button></section></div>}
    {draft && conditioningBlocks.map((programmed) => {
      const block = (draft.blocks ?? []).find((item) => item.blockId === programmed.id);
      return block ? <WorkoutBlockCard key={block.blockId} block={block} programmed={programmed} timerPersistenceKey={`${storageKey(selectedDay.id)}:timer:${block.blockId}`} open={openBlockId === block.blockId} toggle={() => setOpenBlockId(openBlockId === block.blockId ? null : block.blockId)} update={(changes) => updateBlockResult(block.blockId, changes)} complete={(changes) => completeBlockResult(block.blockId, changes)} /> : null;
    })}
    {draft && <>
      <div className="mt-5 space-y-3">{draft.exercises.map((exercise, exerciseIndex) => {
        const programmed = selectedDay.exercises.find((item) => item.id === exercise.exerciseId);
        const instructions = separateWorkoutInstructions(programmed?.observations);
        const completedSets = exercise.sets.filter((set) => set.completed).length;
        const open = openExerciseId === exercise.exerciseId;
        const completed = completedSets === exercise.sets.length && exercise.sets.length > 0;
        return <article key={exercise.exerciseId} className={`overflow-hidden rounded-2xl border bg-zinc-900/90 transition ${open ? "border-yellow-400/25 shadow-[0_12px_28px_rgba(0,0,0,.22)]" : "border-zinc-800"}`}>
          <button type="button" aria-expanded={open} aria-controls={`exercise-${exercise.exerciseId}`} onClick={() => setOpenExerciseId(open ? null : exercise.exerciseId)} className="w-full p-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-yellow-300">
            <span className="flex items-start gap-3"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-black ${completed ? "bg-emerald-400/10 text-emerald-300" : "bg-yellow-400/10 text-yellow-300"}`}>{completed ? "✓" : exerciseIndex + 1}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-zinc-100">{exercise.exerciseName}</span><span className="mt-1 block text-[10px] leading-relaxed text-zinc-500">{programmed ? `${programmed.sets} series · ${programmed.repetitions} reps${programmed.restSeconds !== null ? ` · ${programmed.restSeconds} s` : ""}${programmed.weight !== null ? ` · ${programmed.weight} kg` : ""}` : `${exercise.sets.length} series`}</span></span><span className="shrink-0 text-right"><span className="block text-[10px] font-semibold text-zinc-400">{completedSets}/{exercise.sets.length}</span><span aria-hidden="true" className={`mt-1 block text-sm text-yellow-300 transition-transform ${open ? "rotate-180" : ""}`}>⌄</span></span></span>
            <span className="mt-3 block h-1 overflow-hidden rounded-full bg-zinc-800"><span className="block h-full rounded-full bg-yellow-400 transition-[width]" style={{ width: `${exercise.sets.length ? completedSets / exercise.sets.length * 100 : 0}%` }} /></span>
          </button>
          {instructions.structural.length > 0 && <div data-structural-instructions className="space-y-2 border-t border-yellow-400/10 bg-yellow-400/[.035] px-3 py-3 sm:px-4">{instructions.structural.map((instruction) => <div key={`${instruction.label}-${instruction.text}`} className="flex items-start gap-2.5 rounded-xl border border-yellow-400/20 bg-zinc-950/70 px-3 py-2.5"><span className="mt-0.5 shrink-0 rounded-md bg-yellow-400/10 px-2 py-1 text-[9px] font-black tracking-wide text-yellow-300">{instruction.label}</span><p className="min-w-0 text-xs leading-relaxed text-zinc-200">{instruction.text}</p></div>)}</div>}
          {open && <div id={`exercise-${exercise.exerciseId}`} className="border-t border-zinc-800 px-3 pb-4 pt-3 sm:px-4">
            <div className="mb-3 flex items-center justify-between gap-3 text-[10px] text-zinc-500">{programmed?.muscleGroup ? <span>{programmed.muscleGroup}</span> : <span />}{exercise.previous ? <span>Última: {exercise.previous.weight ?? "—"} kg × {exercise.previous.repetitions ?? "—"} · {date(exercise.previous.date)}</span> : <span>Sin registros anteriores</span>}</div>
            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/80">
              <div aria-hidden="true" className="grid grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_2.5rem] items-center gap-1 border-b border-zinc-800 px-2 py-2 text-center text-[9px] font-bold uppercase tracking-wide text-zinc-500"><span>Serie</span><span>Kg</span><span>Reps</span><span>{programmed?.effortType ?? "RIR"}</span><span>✓</span></div>
              {exercise.sets.map((set, setIndex) => <div key={set.setNumber} className={`grid grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_2.5rem] items-center gap-1 border-b border-zinc-800/70 px-2 py-2 last:border-0 ${set.completed ? "bg-emerald-400/[.06]" : ""}`}><span className="text-center text-xs font-black text-yellow-300">{set.setNumber}</span><label><span className="sr-only">Kilogramos de la serie {set.setNumber}</span><input aria-label={`Kg de la serie ${set.setNumber}`} inputMode="decimal" type="number" min="0" step=".25" value={set.weight ?? ""} onChange={(event) => updateSet(exerciseIndex, setIndex, { weight: event.target.value ? Number(event.target.value) : null })} className="min-h-10 w-full min-w-0 rounded-lg border border-zinc-700 bg-black px-1 text-center text-sm text-white outline-none focus:border-yellow-400" /></label><label><span className="sr-only">Repeticiones de la serie {set.setNumber}</span><input aria-label={`Reps de la serie ${set.setNumber}`} inputMode="numeric" type="number" min="0" value={set.repetitions ?? ""} onChange={(event) => updateSet(exerciseIndex, setIndex, { repetitions: event.target.value ? Number(event.target.value) : null })} className="min-h-10 w-full min-w-0 rounded-lg border border-zinc-700 bg-black px-1 text-center text-sm text-white outline-none focus:border-yellow-400" /></label><label><span className="sr-only">{programmed?.effortType ?? "RIR"} de la serie {set.setNumber}</span><input aria-label={`${programmed?.effortType ?? "RIR"} de la serie ${set.setNumber}`} inputMode="decimal" type="number" min="0" max="10" step=".5" value={set.effort ?? ""} onChange={(event) => updateSet(exerciseIndex, setIndex, { effort: event.target.value ? Number(event.target.value) : null })} className="min-h-10 w-full min-w-0 rounded-lg border border-zinc-700 bg-black px-1 text-center text-sm text-white outline-none focus:border-yellow-400" /></label><label className="grid min-h-10 place-items-center"><span className="sr-only">Serie {set.setNumber} completada</span><input aria-label={`Serie ${set.setNumber} completada`} type="checkbox" checked={set.completed} onChange={(event) => updateSet(exerciseIndex, setIndex, { completed: event.target.checked })} className="h-5 w-5 accent-yellow-400" /></label></div>)}
            </div>
            {(instructions.technicalText || programmed?.videoUrl) && <details className="mt-3 rounded-xl border border-zinc-800 bg-black/30 px-3 py-2 text-sm text-zinc-400"><summary className="cursor-pointer list-none font-semibold text-yellow-300 outline-none focus-visible:ring-2 focus-visible:ring-yellow-300">Ver técnica</summary><div className="mt-3 border-t border-zinc-800 pt-3">{instructions.technicalText && <p className="whitespace-pre-line text-xs leading-relaxed text-zinc-300">{instructions.technicalText}</p>}{programmed?.videoUrl && <a href={programmed.videoUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-yellow-400/30 px-3 text-xs font-bold text-yellow-300">Abrir video técnico</a>}</div></details>}
            {exercise.history.length > 0 && <details className="mt-3"><summary className="cursor-pointer text-xs font-semibold text-zinc-400">Historial anterior ({exercise.history.length})</summary><div className="mt-2 grid gap-2 sm:grid-cols-2">{exercise.history.map((item, index) => <p key={`${item.date}-${index}`} className="rounded-lg bg-zinc-950 p-2 text-xs text-zinc-400">{date(item.date)} · {item.weight ?? "—"} kg · {item.repetitions ?? "—"} reps · esfuerzo {item.effort ?? "—"}</p>)}</div></details>}
          </div>}
        </article>;
      })}</div>
      <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-3 max-[340px]:grid-cols-1 md:ml-auto md:flex md:max-w-xl md:justify-end"><button type="button" disabled={saving || !started} onClick={() => save(false)} className="min-h-11 min-w-0 rounded-xl border border-yellow-400/40 px-3 py-2.5 text-xs font-bold text-yellow-300 outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 disabled:opacity-50 md:text-sm">{savingAction === "draft" ? "Guardando…" : "Guardar progreso"}</button><button type="button" disabled={saving || !started} onClick={openFinalSummary} className="min-h-11 min-w-0 rounded-xl bg-yellow-400 px-3 py-2.5 text-xs font-black text-zinc-950 outline-none focus-visible:ring-2 focus-visible:ring-yellow-100 disabled:opacity-50 md:text-sm">Finalizar entrenamiento</button></div>
      {finalOpen && <div role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget && !saving) setFinalOpen(false); }} className="fixed inset-0 z-[80] flex items-end bg-black/80 sm:items-center sm:justify-center sm:p-4"><section role="dialog" aria-modal="true" aria-labelledby="workout-summary-title" className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-zinc-900 p-5 sm:max-w-xl sm:rounded-2xl"><div className="flex items-start justify-between gap-3"><div><h2 id="workout-summary-title" className="text-xl font-bold">Finalizar entrenamiento</h2><p className="mt-1 text-sm text-zinc-400">{completedTotal} de {totalSets} series{draft.durationMinutes ? ` · ${draft.durationMinutes} min` : " · duración pendiente"}</p></div><button onClick={() => setFinalOpen(false)} className="rounded-lg px-3 py-2 text-sm text-zinc-400">Cerrar</button></div>
        {incomplete && !allowIncomplete ? <div className="mt-5 rounded-xl border border-orange-400/40 bg-orange-400/10 p-4"><p className="font-semibold text-orange-200">Todavía quedan ejercicios o series sin completar.</p><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => setFinalOpen(false)} className="rounded-lg bg-zinc-800 px-3 py-2 text-sm">Continuar entrenando</button><button onClick={() => { save(false); setFinalOpen(false); }} className="rounded-lg border border-yellow-400/40 px-3 py-2 text-sm text-yellow-300">Guardar para continuar después</button><button onClick={() => setAllowIncomplete(true)} className="rounded-lg bg-orange-300 px-3 py-2 text-sm font-bold text-zinc-950">Finalizar igualmente</button></div></div> : <div className="mt-5 space-y-4"><Field label="Sensación general"><select value={sensation} onChange={(event) => setSensation(event.target.value)} className={`${portalInput} mt-1`}><option value="">Seleccionar</option><option>Muy buena</option><option>Buena</option><option>Normal</option><option>Difícil</option><option>Muy difícil</option></select></Field><Field label="Duración calculada (min)"><input inputMode="numeric" type="number" min="1" max="1440" placeholder="Ej: 45" value={draft.durationMinutes ?? ""} onChange={(event) => setDraft({ ...draft, durationMinutes: event.target.value === "" ? null : Number(event.target.value) })} className={`${portalInput} mt-1`} /></Field><label className="flex min-w-0 items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/[.05] p-3.5 text-red-100"><input type="checkbox" checked={draft.hasPain} onChange={(event) => setDraft({ ...draft, hasPain: event.target.checked })} className="mt-0.5 h-5 w-5 shrink-0 accent-red-400" /><span className="min-w-0"><strong className="block text-sm font-semibold">Dolor o molestias</strong><small className="mt-1 block text-xs font-normal leading-relaxed text-zinc-400">Marcá esta opción si sentiste dolor durante la sesión.</small></span></label>{draft.hasPain && <div className="grid gap-3 sm:grid-cols-2"><Field label="Zona"><input value={painLocation} onChange={(event) => setPainLocation(event.target.value)} className={`${portalInput} mt-1`} /></Field><Field label="Intensidad (1 a 10)"><input type="number" min="1" max="10" value={painIntensity ?? ""} onChange={(event) => setPainIntensity(event.target.value ? Number(event.target.value) : null)} className={`${portalInput} mt-1`} /></Field><Field label="Comentario"><textarea value={draft.painDetails} onChange={(event) => setDraft({ ...draft, painDetails: event.target.value })} rows={2} className={`${portalInput} mt-1 sm:col-span-2`} /></Field></div>}<Field label="Comentario final (opcional)"><textarea value={draft.finalComment} onChange={(event) => setDraft({ ...draft, finalComment: event.target.value })} rows={3} className={`${portalInput} mt-1`} /></Field><button disabled={saving || draft.durationMinutes === null || !sensation || (draft.hasPain && (!painLocation.trim() || painIntensity === null))} onClick={() => save(true)} className="w-full rounded-xl bg-yellow-400 px-4 py-3 font-bold text-zinc-950 disabled:opacity-50">{savingAction === "final" ? "Finalizando…" : "Confirmar y finalizar"}</button></div>}
      </section></div>}</>}
  </>;
}

function WorkoutBlockCard({ block, programmed, timerPersistenceKey, open, toggle, update, complete }: { block: PortalWorkoutBlock; programmed: TrainingRoutineBlock; timerPersistenceKey: string; open: boolean; toggle: () => void; update: (changes: Partial<PortalWorkoutBlock["result"]>) => void; complete: (changes: Partial<PortalWorkoutBlock["result"]>) => Promise<void> }) {
  const configuration = [programmed.rounds ? `${programmed.rounds} rondas` : null, programmed.durationSeconds ? `${Math.round(programmed.durationSeconds / 60)} min` : null, programmed.workSeconds ? `${programmed.workSeconds} s trabajo` : null, programmed.restSeconds !== null ? `${programmed.restSeconds} s pausa` : null].filter(Boolean).join(" · ");
  const active = hasBlockActivity(block);
  const timed = isTimedBlockType(block.blockType);
  const numeric = (value: string) => value === "" ? null : Number(value);
  function toggleExercise(id: string) { update({ completedExerciseIds: block.result.completedExerciseIds.includes(id) ? block.result.completedExerciseIds.filter((item) => item !== id) : [...block.result.completedExerciseIds, id] }); }
  return <article className={`mb-3 overflow-hidden rounded-2xl border bg-zinc-900/90 ${open ? "border-yellow-400/30" : "border-zinc-800"}`}><button type="button" onClick={toggle} aria-expanded={open} className="flex min-h-16 w-full items-center gap-3 p-3.5 text-left"><span className={`grid size-9 shrink-0 place-items-center rounded-xl text-sm font-black ${active ? "bg-emerald-400/10 text-emerald-300" : "bg-yellow-400/10 text-yellow-300"}`}>{active ? "✓" : programmed.order}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm uppercase tracking-wide text-zinc-100">{programmed.name}</strong><span className="mt-1 block text-[10px] text-zinc-500">{TRAINING_BLOCK_LABELS[programmed.type]}{configuration ? ` · ${configuration}` : ""}</span></span><span className="shrink-0 rounded-lg border border-yellow-400/25 px-2 py-1 text-[10px] font-bold text-yellow-300">{open ? "Cerrar" : "Comenzar bloque"}</span></button>{open && <div className="border-t border-zinc-800 p-3.5">{programmed.instructions && <p className="mb-3 whitespace-pre-wrap rounded-xl bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-300">{programmed.instructions}</p>}{timed && <WorkoutBlockTimer block={block} programmed={programmed} persistenceKey={timerPersistenceKey} update={update} complete={complete} />}{!timed && <ol className="mt-3 space-y-2">{block.exercises.map((exercise) => <li key={exercise.exerciseId} className="flex items-center gap-3 rounded-xl bg-zinc-950 px-3 py-2.5"><input aria-label={`${exercise.name} completado`} type="checkbox" checked={block.result.completedExerciseIds.includes(exercise.exerciseId)} onChange={() => toggleExercise(exercise.exerciseId)} className="size-5 shrink-0 accent-yellow-400" /><span className="min-w-0"><strong className="block text-sm">{exercise.order}. {exercise.name}</strong><span className="text-xs text-zinc-500">{exercise.targetLabel}</span></span></li>)}</ol>}<div className="mt-4 grid gap-3 sm:grid-cols-2">
      {block.blockType === "ROUNDS" && <Field label="Rondas completadas"><input type="number" min="0" value={block.result.roundsCompleted ?? ""} onChange={(event) => update({ roundsCompleted: numeric(event.target.value) })} className={`${portalInput} mt-1`} /></Field>}
      {block.blockType === "ROUNDS" && <Field label="Duración realizada (seg.)"><input type="number" min="0" value={block.result.durationSeconds ?? ""} onChange={(event) => update({ durationSeconds: numeric(event.target.value) })} className={`${portalInput} mt-1`} /></Field>}
      {block.blockType === "FOR_TIME" && <Field label="Trabajo pendiente"><input value={block.result.pendingWork} onChange={(event) => update({ pendingWork: event.target.value })} className={`${portalInput} mt-1`} /></Field>}
      {block.blockType === "FREE" && <Field label="Resultado"><textarea rows={2} value={block.result.resultText} onChange={(event) => update({ resultText: event.target.value })} className={`${portalInput} mt-1`} /></Field>}
      <Field label="Observación"><textarea rows={2} value={block.result.observation} onChange={(event) => update({ observation: event.target.value })} className={`${portalInput} mt-1`} /></Field>
    </div>{!timed && <label className="mt-3 flex min-h-11 items-center gap-3 rounded-xl border border-zinc-700 px-3 text-sm font-semibold"><input type="checkbox" checked={block.result.completed} onChange={(event) => update({ completed: event.target.checked })} className="size-5 accent-yellow-400" /> Bloque completado</label>}</div>}</article>;
}

function workoutBlockResultSummary(block: PortalWorkoutBlock) {
  const result = block.result;
  if (block.blockType === "AMRAP") return `${result.roundsCompleted ?? 0} vueltas${result.extraRepetitions ? ` + ${result.extraRepetitions} reps` : ""}`;
  if (block.blockType === "EMOM") return `${result.minutesCompleted ?? 0} min${result.roundsCompleted ? ` · ${result.roundsCompleted} ciclos` : ""}`;
  if (block.blockType === "FOR_TIME") return result.completed ? `${result.durationSeconds ?? 0} s · completado` : `${result.roundsCompleted ?? 0} rondas${result.pendingWork ? ` · pendiente: ${result.pendingWork}` : ""}`;
  if (block.blockType === "FREE") return result.resultText || (result.completed ? "Completado" : "Sin resultado");
  return `${result.roundsCompleted ?? 0} rondas${result.durationSeconds ? ` · ${result.durationSeconds} s` : ""}`;
}

function WorkoutHistoryView({ data }: { data: PortalData }) {
  const sessions = data.workoutSessions;
  return <section>
      <div className="mb-4"><p className="text-xs font-bold uppercase tracking-wider text-yellow-400">Rutinas personalizadas</p><h2 className="mt-1 text-xl font-bold">Historial de entrenamientos</h2>{sessions.length > 0 && <p className="mt-1 text-sm text-zinc-500">{sessions.length} sesiones recientes</p>}</div>
      {sessions.length ? <div className="space-y-3">{sessions.map((session) => {
        const completedExercises = session.exercises.filter((exercise) => exercise.sets.some((set) => set.completed)).length;
        const completedSets = session.exercises.reduce((total, exercise) => total + exercise.sets.filter((set) => set.completed).length, 0);
        return <details key={session.id ?? `${session.date}-${session.dayId}`} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><summary className="cursor-pointer list-none"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{session.routineNameSnapshot || session.routineName || "Rutina eliminada"}</p><p className="mt-1 text-sm text-zinc-400">Día {session.routineDayNumberSnapshot ?? session.dayNumber}{session.dayName ? ` — ${session.dayName}` : ""}</p><p className="mt-2 text-xs text-zinc-500">{date(session.date)}{session.durationMinutes ? ` · ${session.durationMinutes} min` : ""} · {completedExercises} ejercicios · {completedSets} series · {(session.blocks ?? []).filter(hasBlockActivity).length} bloques</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${session.status === "finalizado" ? "bg-emerald-400/10 text-emerald-300" : "bg-yellow-400/10 text-yellow-300"}`}>{session.status === "finalizado" ? "Completado" : "En progreso"}</span></div><span className="mt-3 inline-block text-sm font-bold text-yellow-400">Ver detalle</span></summary><div className="mt-4 space-y-3 border-t border-zinc-800 pt-4">{(session.energyBefore !== null || session.difficulty !== null || session.energyAfter !== null) && <div className="grid grid-cols-3 gap-2"><SmallMetric title="Energía antes" value={session.energyBefore?.toString() ?? "Sin dato"} /><SmallMetric title="Dificultad" value={session.difficulty?.toString() ?? "Sin dato"} /><SmallMetric title="Energía después" value={session.energyAfter?.toString() ?? "Sin dato"} /></div>}{(session.blocks ?? []).filter((block) => block.blockType !== "STRENGTH").sort((left, right) => left.blockOrder - right.blockOrder).map((block) => <article key={block.id ?? block.blockId} className="rounded-xl border border-yellow-400/15 bg-zinc-950 p-3"><div className="flex items-start justify-between gap-3"><p className="font-semibold">{block.blockName}</p><span className="text-[10px] font-bold uppercase text-yellow-300">{TRAINING_BLOCK_LABELS[block.blockType]}</span></div><p className="mt-2 whitespace-pre-wrap text-xs text-zinc-300">{workoutBlockResultSummary(block)}</p>{block.result.observation && <p className="mt-2 whitespace-pre-wrap text-xs text-zinc-500">{block.result.observation}</p>}</article>)}{session.exercises.map((exercise) => <article key={exercise.id ?? exercise.exerciseId} className="rounded-xl bg-zinc-950 p-3"><p className="font-semibold">{exercise.exerciseName}</p><div className="mt-2 space-y-1">{exercise.sets.map((set) => <p key={set.id ?? set.setNumber} className="text-xs text-zinc-400">Serie {set.setNumber}: {set.weight ?? "—"} kg · {set.repetitions ?? "—"} reps · RIR/RPE {set.effort ?? "—"}{set.completed ? " · completada" : ""}{set.observation ? ` · ${set.observation}` : ""}</p>)}</div>{exercise.observation && <p className="mt-2 text-xs text-zinc-500">{exercise.observation}</p>}</article>)}{session.finalComment && <p className="rounded-xl bg-zinc-950 p-3 text-sm text-zinc-300">{session.finalComment}</p>}{session.hasPain && <p className="rounded-xl bg-red-400/10 p-3 text-sm text-red-200">Dolor o molestia registrada: {session.painDetails || "sin detalle"}</p>}</div></details>;
      })}</div> : <Notice>Todavía no hay entrenamientos registrados.</Notice>}
  </section>;
}

function CommentsView({ data }: { data: PortalData }) {
  const [category, setCategory] = useState("consulta"); const [body, setBody] = useState(""); const [saving, setSaving] = useState(false); const [message, setMessage] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setMessage(""); const response = await fetch("/api/portal/comentarios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context: "general", category, body }) }); const result = await response.json() as { error?: string }; setMessage(response.ok ? "Tu comentario fue enviado." : result.error ?? "No se pudo enviar."); if (response.ok) setBody(""); setSaving(false); }
  const roots = data.comments.filter((item) => !item.parentId);
  return <PageHeader title="Comentarios" subtitle="Consultas y devoluciones para tu entrenador"><form onSubmit={submit} className="rounded-2xl border border-yellow-400/20 bg-zinc-900 p-4"><select value={category} onChange={(event) => setCategory(event.target.value)} className={portalInput}><option value="consulta">Consulta</option><option value="dificultad">Dificultad</option><option value="dolor">Dolor o molestia</option><option value="devolucion">Devolución</option></select><textarea required value={body} onChange={(event) => setBody(event.target.value)} placeholder="Escribí tu mensaje…" rows={4} className={`${portalInput} mt-3`} /><button disabled={saving} className="mt-3 w-full rounded-xl bg-yellow-400 p-3 font-bold text-zinc-950">Enviar comentario</button>{message && <p className="mt-3 text-sm text-yellow-200">{message}</p>}</form><div className="mt-5 space-y-3">{roots.map((item) => <article key={item.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><div className="flex justify-between"><span className="text-xs capitalize text-zinc-500">{item.category} · {item.contextLabel}</span><span className={`rounded-full px-2 py-1 text-[10px] ${item.status === "pendiente" ? "bg-yellow-400/10 text-yellow-300" : "bg-emerald-400/10 text-emerald-300"}`}>{item.status}</span></div><p className="mt-3 text-sm">{item.body}</p>{data.comments.filter((reply) => reply.parentId === item.id).map((reply) => <p key={reply.id} className="mt-3 rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-200"><strong>Entrenador:</strong> {reply.body}</p>)}</article>)}</div></PageHeader>;
}

const portalInput = "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-white outline-none focus:border-yellow-400";
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="text-xs text-zinc-500">{label}{children}</label>; }

function ChangePasswordCard({ forced = false, onSuccess }: { forced?: boolean; onSuccess?: () => void }) {
  const [currentPassword, setCurrentPassword] = useState(""); const [newPassword, setNewPassword] = useState(""); const [confirmPassword, setConfirmPassword] = useState(""); const [error, setError] = useState(""); const [success, setSuccess] = useState(""); const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); if (newPassword !== confirmPassword) { setError("Las contraseñas nuevas no coinciden."); return; } setSaving(true); setError(""); setSuccess(""); try { const response = await fetch("/api/portal/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) }); const body = await response.json() as { error?: string }; if (!response.ok) throw new Error(body.error ?? "No se pudo cambiar la contraseña."); setSuccess("Contraseña actualizada correctamente."); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); onSuccess?.(); } catch (changeError) { setError(changeError instanceof Error ? changeError.message : "No se pudo cambiar la contraseña."); } finally { setSaving(false); } }
  return <section className={`mt-6 rounded-2xl border p-5 ${forced ? "border-yellow-400/40 bg-yellow-400/5" : "border-zinc-800 bg-zinc-900"}`}><h2 className="font-semibold text-yellow-300">{forced ? "Creá tu contraseña personal" : "Cambiar contraseña"}</h2><p className="mt-1 text-sm text-zinc-500">{forced ? "La contraseña temporal debe reemplazarse antes de acceder a tus datos." : "Debe incluir mayúscula, minúscula, número y al menos 10 caracteres."}</p>{error && <p role="alert" className="mt-4 rounded-lg bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}{success && <p className="mt-4 rounded-lg bg-emerald-400/10 p-3 text-sm text-emerald-300">{success}</p>}<form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-3"><label className="text-sm">Contraseña actual<input required type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 outline-none focus:border-yellow-400" /></label><label className="text-sm">Nueva contraseña<input required type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 outline-none focus:border-yellow-400" /></label><label className="text-sm">Repetir contraseña<input required type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 outline-none focus:border-yellow-400" /></label><button disabled={saving} className="rounded-xl bg-yellow-400 px-4 py-3 font-bold text-zinc-950 disabled:opacity-60 sm:col-span-3">{saving ? "Guardando…" : "Guardar contraseña"}</button></form></section>;
}

function PortalLogoutCard() {
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/portal/logout", { method: "POST" });
    } finally {
      window.location.assign("/portal/login");
    }
  }
  return (
    <section className="mt-5 flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="font-semibold">Sesión</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Cerrá tu sesión cuando uses un dispositivo compartido.
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={logout}
        className="min-h-11 rounded-xl border border-red-400/25 px-4 text-sm font-semibold text-red-300 transition hover:bg-red-400/10 disabled:opacity-50"
      >
        {busy ? "Cerrando…" : "Cerrar sesión"}
      </button>
    </section>
  );
}

function PageHeader({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) { return <><header className="mb-6"><h1 className="text-2xl font-bold">{title}</h1><p className="mt-1 text-sm text-zinc-500">{subtitle}</p></header>{children}</>; }
function SmallMetric({ title, value }: { title: string; value: string }) { return <div className="rounded-lg bg-zinc-950 p-2"><p className="text-[10px] text-zinc-500">{title}</p><p className="mt-1 font-semibold">{value}</p></div>; }
function Notice({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "error" }) { return <section className={`rounded-2xl border p-5 text-sm ${tone === "error" ? "border-red-400/30 bg-red-400/10 text-red-200" : "border-zinc-800 bg-zinc-900 text-zinc-400"}`}>{children}</section>; }
function PortalLoading() { return <div className="animate-pulse space-y-4"><div className="h-8 w-48 rounded bg-zinc-800" /><div className="h-4 w-72 rounded bg-zinc-900" /><div className="grid gap-4 sm:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-32 rounded-2xl bg-zinc-900" />)}</div><div className="h-64 rounded-2xl bg-zinc-900" /></div>; }
