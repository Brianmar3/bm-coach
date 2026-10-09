"use client";
import { hasOfflineTraining, hydrateOfflineTraining, offlineWorkoutData, offlineWorkoutDraft, refreshOfflineTraining, saveOfflineWorkout, stageOfflineWorkout, logoutOfflineTraining, subscribeOfflineTraining } from "@/lib/offline-training-client";
import type { OfflineWorkoutData } from "@/lib/offline-training-types";
import { PortalHeroFrame, PortalRoutineFrame, PORTAL_STAT_CARD_CLASS } from "@/componentes/portal-visuals";
import { PortalPointsBackLink } from "@/componentes/portal-points-back-link";
import { AppearanceSelector } from "@/componentes/appearance-selector";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import type { PaymentAccountStatus, TrainingRoutineBlock } from "@/types/gestion";
import type { StudentEvaluation } from "@/types/evaluation-read-model";
import type { PortalData, PortalWorkoutBlock, PortalWorkoutSession } from "@/types/portal";
import { PortalClasses } from "@/componentes/portal-classes";
import { dailyFocusForInstant } from "@/lib/daily-focus";
import { BODY_METRICS, BodyEvolutionCard, formatBodyValue } from "@/componentes/body-evolution-card";
import type { PortalAchievement } from "@/lib/portal-achievements";
import { StudentProfileView } from "@/componentes/student-profile-view";
import { StudentAvatarPage } from "@/componentes/student-avatar-page";
import { PushNotificationsCard } from "@/componentes/push-notifications-card";
import { hasGroupClasses, hasPersonalizedService, isCompetitiveGamificationEligible } from "@/lib/student-service";
import { announceNewAchievements, useWeeklyMissionCelebration, type CelebrationAchievement } from "@/componentes/achievement-celebration";
import { cleanRoutineDisplayName, completedExerciseCount, exerciseCompletesWithSetChange, initialOpenExerciseId, nextIncompleteExerciseId, usefulDayName } from "@/lib/workout-presentation";
import { separateWorkoutInstructions } from "@/lib/workout-instructions";
import { argentinaDateKey } from "@/lib/payment-dates";
import { createFreshWorkoutSets, findCurrentWeekSession, getLocalWeekEnd, getWeekKey, legacyWorkoutDraftStorageKey, sessionBelongsToWeek, workoutDraftStorageKey } from "@/lib/workout-week";
import { freshWorkoutBlock, hasBlockActivity, TRAINING_BLOCK_LABELS } from "@/lib/training-blocks";
import { isTimedBlockType } from "@/lib/block-timer";
import { WorkoutBlockTimer } from "@/componentes/workout-block-timer";
import { ExerciseRestTimer, useExerciseRestTimer } from "@/componentes/exercise-rest-timer";
import { WorkoutFocusControls, WorkoutFocusHeader, WorkoutFocusIdentity, WorkoutFocusList, WorkoutFocusMedia } from "@/componentes/workout-focus";
import { PortalEvaluationsDashboard } from "@/componentes/portal-evaluations-dashboard";
import { RoutineExerciseMediaButton } from "@/componentes/routine-exercise-media";
import { RoutineOverlay } from "@/componentes/routine-overlay";
import { PortalActionCard } from "@/componentes/portal-action-card";
import { PasswordField } from "@/componentes/password-field";
import { apiRequest } from "@/lib/client-api";
import { invitationPasswordRequirements, invitationPasswordValidationError } from "@/lib/student-invitation-password";
import { PortalTransferPaymentSheet } from "@/componentes/portal-transfer-payment-sheet";
import { openTransferObligations } from "@/lib/transfer-payment";
import { portalEventDismissalKey } from "@/lib/portal-events";
import {
  BmAttendanceIcon,
  BmBarbellIcon,
  BmCalendarIcon,
  BmChallengeIcon,
  BmCheckIcon,
  BmChevronRightIcon,
  BmCloseIcon,
  BmDumbbellIcon,
  BmEvaluationIcon,
  BmFlameIcon,
  BmHistoryIcon,
  BmMedalIcon,
  BmPaymentIcon,
  BmPlayIcon,
  BmPointsIcon,
  BmProgressIcon,
  BmRankingIcon,
  BmRoutineIcon,
  BmSlidersIcon,
  BmTargetIcon,
  BmTimerIcon,
  BmTrophyIcon,
  BmWorkoutIcon,
} from "@/componentes/icons";
import type { StudentPointMovement } from "@/types/points";
import { homePaymentCardCopy } from "@/lib/home-payment-card";
import { useWorkspaceBranding } from "@/componentes/workspace-branding-provider";
import { mergePortalRefresh } from "@/lib/portal-weekly-mission-refresh";

type Section = "inicio" | "rutina" | "historial" | "entrenamiento" | "comentarios" | "evaluaciones" | "pagos" | "puntos" | "puntos-historial" | "perfil" | "avatar" | "configuracion";
const money = (value: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
const date = (value: string) => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("es-AR") : "—";
const number = (value: number | null, suffix = "") => value === null ? "—" : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value)}${suffix}`;
const accountStatus: Record<PaymentAccountStatus, { label: string; className: string }> = {
  AL_DIA: { label: "Al día", className: "bg-emerald-400/10 text-emerald-300" },
  VENCE_PRONTO: { label: "Vence pronto", className: "bg-amber-400/10 text-amber-300" },
  VENCIDA: { label: "Vencida", className: "bg-red-400/10 text-red-300" },
  SIN_PAGOS: { label: "Sin pagos", className: "bg-yellow-400/10 text-[var(--brand-text)]" },
  SIN_CONFIGURAR: { label: "Sin configurar", className: "bg-zinc-800 text-[var(--foreground-muted)]" },
};
const billingPeriod = (value: string) => value
  ? new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T12:00:00`))
  : "";

export function PortalSection({ section, dataEndpoint = "/api/portal/data", selfService = false }: { section: Section; dataEndpoint?: string; selfService?: boolean }) {
  const [cachedWorkout, setCachedWorkout] = useState<OfflineWorkoutData | null>(null);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    if (selfService) return;
    const update = () => { setOffline(!navigator.onLine); setCachedWorkout(offlineWorkoutData()); };
    const unsubscribe = subscribeOfflineTraining(update);
    void hydrateOfflineTraining().then(update).catch(() => {});
    window.addEventListener("offline", update); window.addEventListener("online", update);
    return () => { unsubscribe(); window.removeEventListener("offline", update); window.removeEventListener("online", update); };
  }, [selfService]);
  const [data, setData] = useState<PortalData | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [changeRequired, setChangeRequired] = useState(false);
  const dataSection = section === "historial" ? "rutina" : section === "avatar" ? "perfil" : section;
  const inFlightRefresh = useRef<Promise<void> | null>(null);
  const activeController = useRef<AbortController | null>(null);
  const hasLoadedData = useRef(false);
  const refreshPortalData = useCallback((showLoading = false) => {
    if (inFlightRefresh.current) return inFlightRefresh.current;
    if (showLoading) setLoading(true);
    const controller = new AbortController();
    activeController.current = controller;
    const request = fetch(`${dataEndpoint}?section=${dataSection}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as PortalData & { error?: string; code?: string };
        if (response.status === 401) { window.location.href = "/portal/login"; throw new Error("Sesión vencida. Los registros offline siguen guardados."); }
        if (body.code === "PASSWORD_CHANGE_REQUIRED") { setChangeRequired(true); return null; }
        if (!response.ok) throw new Error(body.error ?? "No se pudo cargar tu información.");
        return body;
      })
      .then(async (body) => { if (body) { if (!selfService && (section === "rutina" || section === "entrenamiento")) await refreshOfflineTraining(); hasLoadedData.current = true; setError(""); setData((previous) => mergePortalRefresh(previous, body, argentinaDateKey())); } })
      .catch(async (loadError: unknown) => { if (loadError instanceof Error && loadError.name !== "AbortError" && !hasLoadedData.current) { if (!selfService) await hydrateOfflineTraining().catch(() => null); setError(!navigator.onLine ? "Todavía no hay una rutina disponible sin conexión. Abrí la app con internet para guardarla." : loadError.message); } })
      .finally(() => {
        if (activeController.current === controller) { inFlightRefresh.current = null; activeController.current = null; }
        if (!controller.signal.aborted) setLoading(false);
      });
    inFlightRefresh.current = request;
    return request;
  }, [dataEndpoint, dataSection, section, selfService]);
  useEffect(() => {
    activeController.current?.abort(); inFlightRefresh.current = null; hasLoadedData.current = false;
    const resetTimeout = window.setTimeout(() => {
      setData(null); setError(""); setChangeRequired(false);
      void refreshPortalData(true);
    }, 0);
    return () => { window.clearTimeout(resetTimeout); activeController.current?.abort(); };
  }, [refreshPortalData]);
  useEffect(() => {
    const refresh = () => { void refreshPortalData(); };
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") refresh(); };
    const onServiceWorkerMessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === "BM_PORTAL_DATA_CHANGED" || event.data?.type === "BM_ACHIEVEMENT_AVAILABLE") refresh();
    };
    window.addEventListener("bm:portal-data-refresh", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    navigator.serviceWorker?.addEventListener("message", onServiceWorkerMessage);
    const poll = section === "inicio" ? window.setInterval(refreshWhenVisible, 8000) : null;
    return () => {
      window.removeEventListener("bm:portal-data-refresh", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      navigator.serviceWorker?.removeEventListener("message", onServiceWorkerMessage);
      if (poll !== null) window.clearInterval(poll);
    };
  }, [refreshPortalData, section]);
  if (offline && cachedWorkout && (!data || cachedWorkout.profile.id === data.profile.id)) {
    if (section === "rutina" || section === "entrenamiento") return <WorkoutView data={cachedWorkout} />;
    if (section === "inicio") return data ? <PortalOverview data={{ ...data, ...cachedWorkout, profile: data.profile }} /> : <OfflineRoutineHome data={cachedWorkout} />;
  }
  if (offline && ["inicio", "rutina", "entrenamiento"].includes(section)) return <Notice><p>Todavía no hay una rutina disponible sin conexión en este dispositivo. Abrí la app con internet para guardarla.</p></Notice>;
  if (loading) return <PortalLoading />;
  if (changeRequired) return <ChangePasswordCard forced onSuccess={() => { setChangeRequired(false); void refreshPortalData(true); }} />;
  if (error) return <Notice tone="error"><p>{error}</p><button onClick={() => { setError(""); void refreshPortalData(true); }} className="mt-3 rounded-lg bg-red-300 px-3 py-2 font-bold text-zinc-950">Reintentar</button></Notice>;
  if (!data) return null;
  if (section === "rutina") return <WorkoutView data={!selfService && hasOfflineTraining(data.profile.id) ? offlineWorkoutData() ?? data : data} selfService={selfService} />;
  if (section === "historial") return <WorkoutHistoryView data={data} />;
  if (section === "entrenamiento") return <WorkoutView data={!selfService && hasOfflineTraining(data.profile.id) ? offlineWorkoutData() ?? data : data} selfService={selfService} />;
  if (section === "comentarios") return <CommentsView data={data} />;
  if (section === "evaluaciones") return <ComparativeEvaluationsView data={data} />;
  if (section === "pagos") return <PaymentsView data={data} />;
  if (section === "puntos") return <PointsAndAchievementsView data={data} />;
  if (section === "puntos-historial") return <PointsHistoryPageView data={data} />;
  if (section === "perfil") return <StudentProfileView profile={data.profile} />;
  if (section === "avatar") return <StudentAvatarPage profile={data.profile} />;
  if (section === "configuracion") return <PageHeader title="Configuración" subtitle="Cuenta, seguridad y notificaciones"><section id="apariencia" className="mb-4 scroll-mt-24 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5"><h2 className="mb-4 font-semibold text-[var(--brand-text)]">Apariencia</h2><AppearanceSelector /></section><div id="notificaciones" className="scroll-mt-24"><PushNotificationsCard /></div><div id="seguridad" className="scroll-mt-24"><ExpandablePasswordCard /></div><section id="privacidad" className="mt-4 scroll-mt-24 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5"><h2 className="font-semibold text-[var(--brand-text)]">Privacidad</h2><p className="mt-1 text-sm leading-relaxed text-[var(--foreground-muted)]">Tus datos se muestran únicamente dentro de tu cuenta. Los cambios administrativos de plan, servicio y estado los gestiona tu entrenador.</p></section><section id="preferencias" className="mt-4 scroll-mt-24 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5"><h2 className="font-semibold text-[var(--brand-text)]">Preferencias</h2><p className="mt-1 text-sm leading-relaxed text-[var(--foreground-muted)]">BM Training respeta las preferencias de movimiento y accesibilidad configuradas en tu dispositivo.</p></section><PortalLogoutCard /></PageHeader>;
  return <PortalOverview data={data} />;
}

function PortalOverview({ data }: { data: PortalData }) {
  const weeklyCelebrated = useWeeklyMissionCelebration(data.home.weeklyMission);
  const now = new Date();
  const rawTodayLabel = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "long", day: "numeric", month: "long" }).format(now);
  const todayLabel = `${rawTodayLabel.charAt(0).toLocaleUpperCase("es")}${rawTodayLabel.slice(1)}`;
  const dailyFocus = dailyFocusForInstant(now);
  const groupClassesEnabled = hasGroupClasses(data.profile.serviceType);
  const routineFocused = data.profile.serviceType === "PERSONALIZED";
  const showRoutineHomeCard = hasPersonalizedService(data.profile.serviceType) && (routineFocused || Boolean(data.routine));
  const homePlan = showRoutineHomeCard ? personalizedHomePlan(data) : null;
  return <div className="portal-home-sequence mx-auto max-w-5xl space-y-4">
    <PortalHeroFrame>
      <span aria-hidden="true" className="portal-home-light-sweep" />
      <div className={`relative ${groupClassesEnabled && !routineFocused ? "min-h-[7.5rem] pr-[5.6rem] min-[390px]:pr-[6.4rem] sm:min-h-[9rem] sm:pr-36" : "min-h-[7rem] sm:min-h-[9rem]"}`}>
        <p className="flex items-center gap-2.5 text-xs text-[var(--foreground-muted)] sm:text-sm"><BmCalendarIcon size={19} className="shrink-0 text-[var(--brand-text)]" />{todayLabel}</p>
        <h1 className="mt-4 text-[clamp(1.85rem,8vw,3.15rem)] font-black leading-none tracking-[-.045em] text-zinc-50 sm:mt-7">¡Hola, <span className="text-[var(--brand-text)]">{data.profile.firstName}</span>!</h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--foreground-muted)] sm:mt-2.5 sm:text-base">{routineFocused ? "Hoy avanzás una parte más de tu plan." : "Vamos por un día más de progreso."}</p>
        {groupClassesEnabled && <MonthlyAttendanceIndicator data={data} />}
      </div>
    </PortalHeroFrame>
    <PortalEventAnnouncement events={data.events} studentId={data.profile.id} />
    <section className="portal-home-enter portal-home-focus relative overflow-hidden rounded-[26px] border border-white/[.1] bg-[linear-gradient(145deg,#151515,#090909)] px-5 py-5 shadow-[0_14px_34px_rgba(0,0,0,.28)] min-[390px]:px-6 sm:px-7 sm:py-6"><span aria-hidden="true" className="portal-home-focus-lines" /><div className="relative z-[1]"><p className="text-[11px] font-black uppercase tracking-[.22em] text-[var(--brand-text)] sm:text-xs">Enfoque de hoy</p><div className="mt-3 flex items-start gap-3 sm:gap-4"><span aria-hidden="true" className="portal-home-focus-quote text-4xl font-black leading-none text-[var(--brand-text)]/90">“</span><div className="min-w-0 max-w-2xl"><h2 className="break-words text-base font-semibold italic leading-snug text-zinc-100 sm:text-xl">{dailyFocus.title}</h2><p className="mt-1.5 break-words text-xs leading-relaxed text-[var(--foreground-muted)] sm:mt-2 sm:text-sm">{dailyFocus.reflection}</p></div></div></div></section>
    {groupClassesEnabled && !weeklyCelebrated && data.home.weeklyMission && <WeeklyObjectiveCard mission={data.home.weeklyMission} />}
    <div className="portal-home-enter">{homePlan ? <RoutineHomeCard plan={homePlan} /> : groupClassesEnabled && <PortalClasses compact />}</div>
    <HomeQuickStats data={data} />
  </div>;
}

function eventDateLabel(date: string, time: string) {
  const label = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00-03:00`));
  const capitalized = `${label.charAt(0).toLocaleUpperCase("es")}${label.slice(1)}`;
  return time ? `${capitalized} · ${time}` : capitalized;
}

function PortalEventAnnouncement({ events, studentId }: { events: PortalData["events"]; studentId: string }) {
  const branding = useWorkspaceBranding();
  const [dismissed, setDismissed] = useState(false);
  const [detail, setDetail] = useState<PortalData["events"][number] | null>(null);
  const event = events[0] ?? null;
  useEffect(() => {
    if (!event) return;
    const frame = window.requestAnimationFrame(() => {
      const hiddenVersion = window.localStorage.getItem(portalEventDismissalKey(studentId, event.id));
      setDismissed(hiddenVersion === event.updatedAt);
      const linkedEvent = events.find((item) => window.location.hash === `#evento-${item.id}`);
      if (linkedEvent) setDetail(linkedEvent);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [event, events, studentId]);
  if (!event) return null;
  function dismiss() {
    window.localStorage.setItem(portalEventDismissalKey(studentId, event!.id), event!.updatedAt);
    setDismissed(true);
  }
  return <>
    {!dismissed && <section className="portal-home-enter relative overflow-hidden rounded-2xl border border-yellow-400/25 bg-[linear-gradient(145deg,rgba(250,204,21,.08),#101010_70%)] px-4 py-4 shadow-[0_12px_30px_rgba(0,0,0,.24)] sm:px-5">
      <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl border border-yellow-400/25 bg-yellow-400/10 text-[var(--brand-text)]"><BmCalendarIcon size={20} /></span><div className="min-w-0 flex-1"><p className="text-[11px] font-black uppercase tracking-[.2em] text-[var(--brand-text)]">Evento de {branding.displayName}</p><h2 className="mt-1 break-words text-base font-bold text-white sm:text-lg">{event.title}</h2><p className="mt-1 text-xs text-[var(--foreground-muted)] sm:text-sm">{eventDateLabel(event.date, event.time)}</p>{event.location && <p className="mt-1 break-words text-xs text-[var(--foreground-muted)] sm:text-sm">{event.location}</p>}<div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" onClick={() => setDetail(event)} className="min-h-10 text-sm font-bold text-[var(--brand-text)]">Ver detalles →</button>{events.length > 1 && <span className="text-xs text-[var(--foreground-muted)]">+ {events.length - 1} evento{events.length === 2 ? "" : "s"}</span>}</div></div><button type="button" onClick={dismiss} aria-label="Ocultar anuncio" className="grid size-10 shrink-0 place-items-center rounded-xl text-[var(--foreground-muted)] hover:bg-white/5 hover:text-white"><BmCloseIcon size={18} /></button></div>
    </section>}
    {detail && <div className="fixed inset-0 z-[130] overflow-y-auto bg-black/80 p-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] sm:grid sm:place-items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetail(null); }}><section role="dialog" aria-modal="true" aria-labelledby="portal-event-title" className="mx-auto w-full max-w-lg rounded-2xl border border-yellow-400/25 bg-zinc-950 p-5 text-white shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-black uppercase tracking-[.2em] text-[var(--brand-text)]">Evento de {branding.displayName}</p><h2 id="portal-event-title" className="mt-2 text-xl font-bold">{detail.title}</h2></div><button type="button" onClick={() => setDetail(null)} aria-label="Cerrar detalle" className="grid size-10 shrink-0 place-items-center rounded-xl text-[var(--foreground-muted)] hover:bg-zinc-900"><BmCloseIcon size={20} /></button></div><dl className="mt-5 space-y-3 text-sm"><div><dt className="text-xs text-[var(--foreground-muted)]">Fecha y hora</dt><dd className="mt-1">{eventDateLabel(detail.date, detail.time)}</dd></div>{detail.location && <div><dt className="text-xs text-[var(--foreground-muted)]">Lugar</dt><dd className="mt-1 break-words">{detail.location}</dd></div>}</dl>{detail.description && <p className="mt-5 border-t border-zinc-800 pt-4 text-sm leading-relaxed text-zinc-300">{detail.description}</p>}</section></div>}
  </>;
}

type PersonalizedHomePlan = ReturnType<typeof personalizedHomePlan>;

export function OfflineRoutineHome({ data }: { data: OfflineWorkoutData }) {
  return <div className="portal-home-sequence mx-auto max-w-5xl space-y-4"><RoutineHomeCard plan={personalizedHomePlan(data)} /></div>;
}

function personalizedHomePlan(data: OfflineWorkoutData) {
  const routine = data.routine;
  const trainingDays = routine?.days.filter((day) => day.blocks.length > 0) ?? [];
  const weekKey = getWeekKey();
  const weeklySessions = routine ? data.workoutSessions.filter((session) => session.routineId === routine.id && sessionBelongsToWeek(session, weekKey)) : [];
  const completedDayIds = new Set(weeklySessions.filter((session) => session.status === "finalizado").map((session) => session.dayId));
  const inProgress = weeklySessions.find((session) => session.status === "en_progreso" && trainingDays.some((day) => day.id === session.dayId)) ?? null;
  const lastCompleted = routine ? data.workoutSessions.find((session) => session.routineId === routine.id && session.status === "finalizado" && trainingDays.some((day) => day.id === session.dayId)) : null;
  const lastIndex = lastCompleted ? trainingDays.findIndex((day) => day.id === lastCompleted.dayId) : -1;
  const suggestedDay = inProgress ? trainingDays.find((day) => day.id === inProgress.dayId) : trainingDays[(lastIndex + 1) % trainingDays.length] ?? trainingDays[0] ?? null;
  const activityCount = suggestedDay ? suggestedDay.blocks.reduce((sum, block) => sum + block.exercises.length, 0) : 0;
  const usefulName = suggestedDay ? usefulDayName(suggestedDay.dayNumber, suggestedDay.name) : "";
  const title = suggestedDay ? `${suggestedDay.objective || usefulName || cleanRoutineDisplayName(routine?.name ?? "Tu rutina")} · Día ${suggestedDay.dayNumber}` : "Tu plan está listo para continuar";
  return { title, activityCount, estimatedMinutes: suggestedDay?.estimatedMinutes ?? null, completed: completedDayIds.size, target: trainingDays.length, inProgress: Boolean(inProgress), available: Boolean(routine && suggestedDay) };
}

function RoutineHomeCard({ plan }: { plan: PersonalizedHomePlan }) {
  const progress = plan.target ? Math.min(100, (plan.completed / plan.target) * 100) : 0;
  const heading = plan.inProgress ? "Continuá tu entrenamiento" : plan.available ? "Tu entrenamiento está listo" : "Tu plan está listo para continuar";
  const subtitle = plan.available ? plan.title : "Continuá desde tu planificación activa";
  return <PortalRoutineFrame>
    <div className="flex items-center justify-between gap-3"><p className="text-[11px] font-black uppercase tracking-[.2em] text-[var(--brand-text)]">Tu rutina de hoy</p><span className="rounded-full border border-yellow-400/25 bg-yellow-400/[.05] px-2 py-1 text-[11px] font-bold text-[var(--brand-text)]">Personalizado</span></div>
    <div className="mt-2.5 flex items-center gap-3"><span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full border border-yellow-400/25 bg-yellow-400/[.05] text-[var(--brand-text)] shadow-[0_0_18px_rgba(250,204,21,.08)]"><BmDumbbellIcon size={22} /></span><div className="min-w-0"><h2 className="text-base font-black leading-tight text-zinc-50 min-[390px]:text-lg">{heading}</h2><p className="mt-1 line-clamp-2 text-xs leading-snug text-[var(--foreground-muted)]">{subtitle}</p></div></div>
    <div className="mt-2.5 border-t border-white/[.07] pt-2.5">{plan.target > 0 ? <><div className="flex min-w-0 items-center gap-1.5 text-[11px] leading-snug text-[var(--foreground-muted)]"><BmCheckIcon size={13} className="shrink-0 text-[var(--brand-text)]" /><span><strong className="font-bold text-[var(--brand-text)]">{plan.completed} de {plan.target}</strong> sesiones completadas esta semana</span></div><div role="progressbar" aria-label="Progreso semanal del plan" aria-valuemin={0} aria-valuemax={plan.target} aria-valuenow={plan.completed} className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-800"><div className="portal-home-progress-fill h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300" style={{ width: `${progress}%` }} /></div></> : <p className="text-xs leading-relaxed text-[var(--foreground-muted)]">Revisá tu planificación para conocer el próximo bloque.</p>}</div>
    <Link href="/portal/rutina" className="portal-home-interactive mt-2.5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-yellow-400/45 px-4 text-sm font-bold text-[var(--brand-text)] transition hover:bg-yellow-400/[.06]"><BmPlayIcon size={18} />{plan.available ? plan.inProgress ? "Continuar rutina" : "Empezar rutina" : "Ver rutina"}</Link>
  </PortalRoutineFrame>;
}

function WeeklyObjectiveCard({ mission }: { mission: NonNullable<PortalData["home"]["weeklyMission"]> }) {
  const completed = mission.state === "COMPLETED";
  const expired = mission.state === "EXPIRED";

  const [advancing, setAdvancing] = useState(false);
  const previousMission = useRef({ id: mission.id, state: mission.state, progress: mission.progress, target: mission.target, percentage: mission.percentage });
  const animatedProgress = useHomeAnimatedValue(mission.progress, 620);
  const animatedPercentage = useHomeAnimatedValue(mission.percentage, 620);
  const stateLabel = completed ? "Cumplido" : expired ? "Vencida" : "Activa";
  const remainingMessage = completed
    ? `Objetivo semanal completado · +${mission.completionBonus} pts`
    : expired
      ? "La semana finalizó."
      : mission.progress === 0
        ? "Tu semana recién empieza."
        : mission.remaining === 1
          ? `Te falta 1 clase para ganar +${mission.completionBonus} pts`
          : `Te faltan ${mission.remaining} clases para ganar +${mission.completionBonus} pts`;

  useEffect(() => {
    const previous = previousMission.current;
    previousMission.current = { id: mission.id, state: mission.state, progress: mission.progress, target: mission.target, percentage: mission.percentage };
    if (previous.id !== mission.id) return;
    const changed = previous.progress !== mission.progress || previous.target !== mission.target || previous.state !== mission.state || previous.percentage !== mission.percentage;
    if (!changed) return;
    setAdvancing(true);
    const advanceTimeout = window.setTimeout(() => setAdvancing(false), 650);
    return () => window.clearTimeout(advanceTimeout);
  }, [mission.id, mission.percentage, mission.progress, mission.state, mission.target]);

  return <section aria-live="polite" className={`bm-surface-featured portal-home-enter relative overflow-hidden rounded-[22px] border bg-[linear-gradient(145deg,#151515,#090909)] px-5 py-[15px] shadow-[0_14px_34px_rgba(0,0,0,.28)] ${completed ? "border-emerald-400/25" : "border-yellow-400/35"} ${advancing ? "portal-home-objective-advancing" : ""}`}>
    <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2.5">
      <span aria-hidden="true" className={`portal-home-objective-icon grid size-11 place-items-center rounded-full border ${completed ? "border-emerald-400/30 bg-emerald-400/[.08] text-emerald-300" : "border-yellow-400/25 bg-yellow-400/[.05] text-[var(--brand-text)]"}`}>{completed ? <BmCheckIcon size={22} className="portal-home-objective-check" /> : <BmTargetIcon size={22} />}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><p className="text-[11px] font-black uppercase tracking-[.18em] text-[var(--brand-text)] sm:text-[11px]">Objetivo semanal</p><span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${completed ? "border-emerald-400/25 bg-emerald-400/[.07] text-emerald-300" : expired ? "border-zinc-700 bg-zinc-800/70 text-[var(--foreground-muted)]" : "border-emerald-400/20 bg-emerald-400/[.06] text-emerald-300"}`}>{stateLabel}</span></div>
        <h2 className="mt-1 text-sm font-bold leading-snug text-zinc-100 sm:text-base">{Math.round(animatedProgress)} de {mission.target} clases completadas</h2>
      </div>
      <strong className={`text-lg font-black tabular-nums sm:text-xl ${completed ? "text-emerald-300" : "text-[var(--brand-text)]"}`}>{Math.round(animatedPercentage)}%</strong>
    </div>
    <div className="mt-2"><div role="progressbar" aria-label="Progreso del objetivo semanal" aria-valuemin={0} aria-valuemax={mission.target} aria-valuenow={Math.min(mission.progress, mission.target)} className="h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className={`portal-home-objective-progress h-full rounded-full ${completed ? "bg-gradient-to-r from-emerald-500 to-yellow-300" : "bg-gradient-to-r from-amber-500 to-yellow-300"}`} style={{ width: `${animatedPercentage}%` }} /></div><div className="mt-1.5 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[11px] leading-snug text-[var(--foreground-muted)] sm:text-xs"><span>{remainingMessage}</span><span>+{mission.pointsPerSession} por clase · +{mission.completionBonus} bonus</span></div></div>
  </section>;
}

function HomeQuickStats({ data }: { data: PortalData }) {
  const competitive = isCompetitiveGamificationEligible(data.profile.serviceType);
  const account = data.paymentAccount;
  const weekStart = new Date(`${argentinaDateKey()}T12:00:00.000Z`);
  weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
  const weekStartKey = weekStart.toISOString().slice(0, 10);
  const weeklyPoints = data.home.points.recent.filter((item) => item.occurredAt.slice(0, 10) >= weekStartKey).reduce((sum, item) => sum + item.points, 0);
  const [pointsDelta, setPointsDelta] = useState<number | null>(null);
  const previousPoints = useRef({ total: data.home.points.total, weekly: weeklyPoints, monthly: data.home.points.monthlyTotal });
  useEffect(() => {
    const previous = previousPoints.current;
    const next = { total: data.home.points.total, weekly: weeklyPoints, monthly: data.home.points.monthlyTotal };
    previousPoints.current = next;
    if (previous.total === next.total && previous.weekly === next.weekly && previous.monthly === next.monthly) return;
    const delta = next.total - previous.total;
    if (delta <= 0) return;
    setPointsDelta(delta);
    const timeout = window.setTimeout(() => setPointsDelta(null), 1000);
    return () => window.clearTimeout(timeout);
  }, [data.home.points.monthlyTotal, data.home.points.total, weeklyPoints]);
  const paymentCopy = homePaymentCardCopy(account.status, account.nextDueDate, argentinaDateKey());
  const paymentTone = paymentCopy.tone === "current"
    ? "text-emerald-300"
    : paymentCopy.tone === "due-soon"
      ? "text-amber-300"
      : paymentCopy.tone === "overdue"
        ? "text-red-300"
        : "text-zinc-100";
  const cardClass = PORTAL_STAT_CARD_CLASS;
  return <section aria-label="Resumen del alumno" className="portal-home-enter grid grid-cols-2 gap-2 sm:gap-3">
    <Link href="/portal/pagos" aria-label={`Tu cuota. ${paymentCopy.title}. ${paymentCopy.detail}. Ver pagos.`} className={cardClass}><BmPaymentIcon size={17} className="absolute right-3.5 top-3.5 text-[var(--brand-text)]/60" /><p className="pr-6 text-[11px] font-black uppercase tracking-[.15em] text-[var(--brand-text)] min-[390px]:text-[11px]">Tu cuota</p><p className={`mt-2 text-base font-semibold leading-tight min-[390px]:text-lg ${paymentTone}`}>{paymentCopy.title}</p><p className="mt-1 text-[11px] font-medium leading-snug text-[var(--foreground-muted)] min-[390px]:text-[11px]">{paymentCopy.detail}</p><span className="mt-auto pt-2 text-[11px] font-semibold text-[var(--brand-text)] min-[390px]:text-[11px]">Ver pagos <BmChevronRightIcon size={16} className="inline" /></span></Link>
    {competitive ? <Link href="/portal/puntos" aria-live="polite" aria-label={`Tus puntos. ${data.home.points.total} puntos. ${weeklyPoints} esta semana. Ver puntos y logros.`} className={`portal-home-points ${pointsDelta !== null ? "portal-home-points-changed" : ""} ${cardClass}`}>{pointsDelta !== null && <><span aria-hidden="true" className="portal-home-points-sweep" /><span aria-hidden="true" className="portal-home-points-spark portal-home-points-spark-one" /><span aria-hidden="true" className="portal-home-points-spark portal-home-points-spark-two" /><span className="portal-home-points-delta">+{pointsDelta}</span></>}<span className="absolute right-2.5 top-2.5 grid size-6 place-items-center rounded-full border border-yellow-400/30 text-[var(--brand-text)]"><BmPointsIcon size={15} /></span><p className="relative pr-6 text-[11px] font-black uppercase tracking-[.15em] text-[var(--brand-text)] min-[390px]:text-[11px]">Tus puntos</p><p className="relative mt-2 truncate text-xl font-semibold leading-none text-zinc-100 min-[390px]:text-2xl"><HomeAnimatedNumber value={data.home.points.total} /></p><p className="relative mt-1 truncate text-[11px] text-[var(--foreground-muted)] min-[390px]:text-[11px]">+{weeklyPoints} esta semana</p><span className="relative mt-auto pt-2 text-[11px] font-semibold text-[var(--brand-text)] min-[390px]:text-[11px]">Ver puntos <BmChevronRightIcon size={16} className="inline" /></span></Link> : <Link href="/portal/progreso" className={cardClass}><BmProgressIcon size={17} className="absolute right-3.5 top-3.5 text-[var(--brand-text)]/60" /><p className="pr-6 text-[11px] font-black uppercase tracking-[.15em] text-[var(--brand-text)] min-[390px]:text-[11px]">Tu progreso</p><p className="mt-2 text-xl font-semibold leading-none text-zinc-100 min-[390px]:text-2xl">{data.weeklyWorkouts}</p><p className="mt-1 text-[11px] leading-snug text-[var(--foreground-muted)] min-[390px]:text-[11px]">entrenamientos completados esta semana</p></Link>}
  </section>;
}

function WeeklyMissionAchievement({ data }: { data: PortalData }) {
  const mission = data.home.weeklyMission;
  if (!mission) return null;
  const completed = mission.state === "COMPLETED";
  const expired = mission.state === "EXPIRED";
  const stateLabel = completed ? "Completada" : expired ? "Vencida" : "Activa";
  return <section className={`portal-points-enter relative overflow-hidden rounded-[22px] border p-4 shadow-[0_14px_35px_rgba(0,0,0,.25)] [--points-delay:220ms] sm:p-5 ${completed ? "border-emerald-400/20 bg-[linear-gradient(145deg,#151816,#090909)]" : "border-white/[.08] bg-[linear-gradient(145deg,#151515,#090909)]"}`}>
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-[11px] font-bold uppercase tracking-[.18em] text-[var(--brand-text)]">Misión semanal</p><span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${completed ? "border-emerald-400/20 bg-emerald-400/[.07] text-emerald-300" : expired ? "border-zinc-700 bg-zinc-800/70 text-[var(--foreground-muted)]" : "border-yellow-400/20 bg-yellow-400/[.06] text-[var(--brand-text)]"}`}>{stateLabel}</span></div><h2 className="mt-2 flex items-center gap-2 text-sm font-black leading-snug text-white sm:text-base">{completed ? <BmTrophyIcon size={20} className="shrink-0 text-emerald-300" /> : <BmTargetIcon size={20} className="shrink-0 text-[var(--brand-text)]" />}{mission.title}</h2></div><div className="shrink-0 text-right text-[11px] leading-relaxed text-[var(--foreground-muted)]"><p className="font-bold uppercase tracking-[.12em] text-[var(--brand-text)]">Recompensa</p><p>+{mission.pointsPerSession} por entrenamiento</p><p>+{mission.completionBonus} bonus semanal</p><p className="mt-0.5 font-bold text-[var(--brand-text)]">Máximo +{mission.maximumReward} pts</p></div></div>
    <div className="mt-4 flex items-end justify-between gap-3"><strong className="text-2xl font-black tracking-tight text-white">{mission.progress} <span className="text-base text-[var(--foreground-muted)]">/ {mission.target}</span></strong><p className={`text-right text-xs font-semibold ${completed ? "text-emerald-300" : "text-[var(--foreground-muted)]"}`}>{completed ? `+${mission.maximumReward} pts obtenidos` : mission.message}</p></div>
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800" role="progressbar" aria-label="Progreso de la misión semanal" aria-valuemin={0} aria-valuemax={mission.target} aria-valuenow={Math.min(mission.progress, mission.target)}><div className={`portal-points-progress h-full rounded-full ${completed ? "bg-gradient-to-r from-emerald-500 to-yellow-300" : "bg-gradient-to-r from-amber-500 to-yellow-300"}`} style={{ width: `${mission.percentage}%` }} /></div>
  </section>;
}

type PointsRankingPreview = {
  currentPosition: number | null;
  currentPoints: number;
  ranking: Array<{ studentId: string; studentName: string; profileImageUrl: string; total: number }>;
};

function PointsSummary({ data, ranking }: { data: PortalData; ranking: PointsRankingPreview | null }) {
  const points = data.home.points;
  const progress = points.nextTarget > 0 ? Math.min(100, (points.total / points.nextTarget) * 100) : 0;
  return <section id="puntos" className="portal-points-summary portal-points-enter relative scroll-mt-24 overflow-hidden rounded-[26px] border border-yellow-400/55 p-4 shadow-[0_20px_55px_rgba(0,0,0,.42),0_0_28px_rgba(250,204,21,.08)] [--points-delay:70ms] sm:p-6">
    <span aria-hidden="true" className="portal-points-sweep" />
    <div className="relative grid grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[1fr_86px_1fr] sm:gap-5">
      <div className="min-w-0"><p className="text-[11px] font-black uppercase tracking-[.18em] text-[var(--brand-text)] sm:text-[11px]">Puntos totales</p><strong className="mt-2 block truncate text-4xl font-black tabular-nums text-white sm:text-5xl"><HomeAnimatedNumber value={points.total} /></strong><span className="mt-1 block text-[11px] text-[var(--foreground-muted)]">Acumulados</span></div>
      <span className="portal-points-emblem relative grid size-16 place-items-center justify-self-center rounded-[22px] border border-yellow-300/55 bg-yellow-400/[.08] text-[var(--brand-text)] sm:size-[86px]"><BmPointsIcon size={38} strokeWidth={1.55} /></span>
      <div className="min-w-0 text-right"><p className="text-[11px] font-black uppercase tracking-[.12em] text-[var(--foreground-muted)] sm:text-[11px]">Este mes</p><strong className="mt-2 block truncate text-4xl font-black tabular-nums text-[var(--brand-text)] sm:text-5xl"><HomeAnimatedNumber value={points.monthlyTotal} /></strong><span className="mt-1 block text-[11px] text-[var(--foreground-muted)]">{ranking?.currentPosition ? `Posición #${ranking.currentPosition}` : "Ranking mensual"}</span></div>
    </div>
    <div className="relative mt-5 grid grid-cols-2 gap-2.5"><Link href="/portal/ranking" aria-label="Ver ranking mensual" className="portal-points-primary portal-points-action inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-yellow-400 px-2 text-[11px] font-black text-zinc-950 transition hover:bg-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-200 min-[390px]:px-3 min-[390px]:text-xs sm:text-sm"><BmRankingIcon size={20} />Ver ranking<BmChevronRightIcon size={17} /></Link><Link href="/portal/puntos/historial" aria-label="Ver historial de puntos" className="portal-points-secondary portal-points-action inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-yellow-400/40 bg-black/25 px-2 text-[11px] font-black text-[var(--brand-text)] transition hover:bg-yellow-400/[.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 min-[390px]:px-3 min-[390px]:text-xs sm:text-sm"><BmHistoryIcon size={20} />Ver historial<BmChevronRightIcon size={17} /></Link></div>
    <div className="relative mt-4 flex items-center justify-between gap-3 text-[11px] text-[var(--foreground-muted)]"><span>Próximo objetivo: {points.nextTarget} pts</span><span>{points.pointsToNextTarget} pts restantes</span></div>
    <div className="relative portal-points-track mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="portal-points-fill portal-points-progress h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300" style={{ width: `${progress}%` }} /></div>
  </section>;
}

function PointsAndAchievementsView({ data }: { data: PortalData }) {
  const competitive = isCompetitiveGamificationEligible(data.profile.serviceType);
  const [ranking, setRanking] = useState<PointsRankingPreview | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    if (!competitive) return () => controller.abort();
    fetch("/api/portal/ranking", { cache: "no-store", signal: controller.signal })
      .then(async (response) => response.ok ? await response.json() as PointsRankingPreview : null)
      .then((body) => { if (body) setRanking(body); })
      .catch((loadError: unknown) => { if (loadError instanceof Error && loadError.name !== "AbortError") setRanking(null); });
    return () => controller.abort();
  }, [competitive]);
  return <div className="portal-points-page mx-auto max-w-5xl space-y-4 sm:space-y-5">
    <header className="portal-points-enter [--points-delay:0ms]"><p className="text-[11px] font-black uppercase tracking-[.22em] text-[var(--brand-text)]">Tu evolución</p><h1 className="mt-1 text-2xl font-black uppercase tracking-[.02em] text-zinc-100 sm:text-3xl">{competitive ? "Puntos y logros" : "Progreso y logros"}</h1><p className="mt-1 text-sm text-[var(--foreground-muted)]">{competitive ? "Tus avances, movimientos y próximos hitos" : "Tu constancia, evolución y logros personales"}</p></header>
    {competitive && <PointsSummary data={data} ranking={ranking} />}
    {competitive && <WeeklyMissionAchievement data={data} />}
    <AchievementsOverview data={data} />
  </div>;
}

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(listener: () => void) {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribeReducedMotion, () => window.matchMedia(reducedMotionQuery).matches, () => false);
}

function useHomeAnimatedValue(value: number, duration: number) {
  const reducedMotion = usePrefersReducedMotion();
  const [visibleValue, setVisibleValue] = useState(value);
  const previousValue = useRef(value);

  useEffect(() => {
    const from = previousValue.current;
    previousValue.current = value;
    if (reducedMotion || from === value) { setVisibleValue(value); return; }
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      start ??= now;
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVisibleValue(from + (value - from) * eased);
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [duration, reducedMotion, value]);

  return reducedMotion ? value : visibleValue;
}

function HomeAnimatedNumber({ value }: { value: number }) {
  const visibleValue = useHomeAnimatedValue(value, 760);
  return <>{Math.round(visibleValue).toLocaleString("es-AR")}</>;
}

function MonthlyAttendanceIndicator({ data }: { data: PortalData }) {
  const percentage = data.home.monthlyAttendancePercentage;
  const animatedPercentage = useHomeAnimatedValue(percentage ?? 0, 650);
  const visiblePercentage = percentage === null ? 0 : animatedPercentage;
  const angle = Math.min(100, Math.max(0, visiblePercentage)) * 3.6;
  const attended = data.home.classesAttendedThisMonth;
  const detail = percentage === null ? "Sin registros este mes" : `${attended} ${attended === 1 ? "presente" : "presentes"} este mes`;
  const finalDisplay = percentage === null ? "—" : `${percentage.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
  const display = percentage === null ? "—" : `${visiblePercentage.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
  return <Link href="/portal/asistencias" aria-label={`Ver detalle de asistencia mensual. ${percentage === null ? "Sin registros este mes." : `${finalDisplay}. ${detail}.`}`} className="portal-home-interactive group absolute right-0 top-0 z-10 flex w-[5.4rem] cursor-pointer flex-col items-center gap-1 rounded-2xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 min-[390px]:w-[6.2rem] sm:w-[9rem] sm:gap-1.5" title="Ver detalle de asistencias">
    <span className="relative grid size-[82px] place-items-center rounded-full border border-zinc-700/70 shadow-[0_8px_22px_rgba(0,0,0,.28)] transition group-hover:border-yellow-400/40 min-[390px]:size-[86px] sm:size-[6.5rem]" style={{ background: `conic-gradient(var(--bm-accent) ${angle}deg,var(--border-soft) 0deg)` }}><span className="absolute inset-[7px] rounded-full bg-[#0b0b0b] sm:inset-2" /><strong className="relative text-lg font-black tabular-nums text-[var(--brand-text)] sm:text-xl">{display}</strong></span>
    <span className="text-[11px] font-bold uppercase tracking-[.2em] text-[var(--foreground-muted)] sm:text-[11px]">Asistencia</span>
    <span className="text-[11px] font-semibold leading-none text-[var(--brand-text)] sm:text-xs">Ver detalle <BmChevronRightIcon size={16} className="inline" /></span>
  </Link>;
}

function AchievementsOverview({ data }: { data: PortalData }) {
  const unlocked = data.home.achievements.filter((achievement) => achievement.unlocked).sort((left, right) => right.unlockedAt.localeCompare(left.unlockedAt));
  const upcoming = data.home.achievements.filter((achievement) => !achievement.unlocked && achievement.progress > 0).sort((left, right) => right.progress / right.target - left.progress / left.target);
  const categories = [...new Set([...unlocked, ...upcoming].map((achievement) => achievement.category).filter(Boolean))];
  return <section id="logros" className="portal-points-enter scroll-mt-24 [--points-delay:340ms]"><div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-[.2em] text-[var(--brand-text)]">Logros</p><h2 className="mt-1 text-lg font-black">Tus hitos</h2></div><span className="rounded-full border border-yellow-400/20 bg-yellow-400/[.05] px-3 py-1 text-xs font-bold text-[var(--brand-text)]">{unlocked.length} obtenidos</span></div>{categories.length ? <div className="space-y-5">{categories.map((category) => { const items = [...unlocked, ...upcoming].filter((achievement) => achievement.category === category); return <section key={category}><div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-black uppercase tracking-[.16em] text-[var(--foreground-muted)]">{achievementCategoryLabel(category)}</h3><span className="text-[11px] text-[var(--foreground-muted)]">{items.filter((item) => item.unlocked).length} de {items.length}</span></div><div className="space-y-2">{items.map((achievement) => <AchievementCard key={achievement.id} achievement={achievement} />)}</div></section>; })}</div> : <p className="rounded-2xl border border-dashed border-white/[.08] p-6 text-center text-sm text-[var(--foreground-muted)]">Tus próximos logros aparecerán acá.</p>}</section>;
}

function AchievementCard({ achievement }: { achievement: PortalAchievement }) {
  const percentage = achievement.target > 0 ? Math.min(100, achievement.progress / achievement.target * 100) : 0;
  return <article data-unlocked={achievement.unlocked} className={`portal-achievement-card grid grid-cols-[2.75rem_minmax(0,1fr)] gap-3 rounded-2xl border p-3.5 ${achievement.unlocked ? "border-yellow-400/20 bg-[linear-gradient(145deg,rgba(250,204,21,.045),rgba(9,9,11,.88))]" : "border-white/[.07] bg-[#111113]"}`}><span className={`portal-achievement-icon grid size-11 place-items-center rounded-full border ${achievement.unlocked ? "border-yellow-400/35 bg-yellow-400/[.07] text-[var(--brand-text)] shadow-[0_0_18px_rgba(250,204,21,.07)]" : "border-zinc-700 bg-zinc-900 text-[var(--foreground-muted)]"}`}>{achievementIcon(achievement)}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className={`text-sm font-bold ${achievement.unlocked ? "text-zinc-100" : "text-[var(--foreground-muted)]"}`}>{achievement.name}</h4>{achievement.level && <span className="portal-achievement-badge rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-[var(--foreground-muted)]">{achievementLevelLabel(achievement.level)}</span>}</div>{achievement.exercise && <p className="mt-1 truncate text-xs font-semibold text-[var(--brand-text)]">{achievement.exercise} · {achievement.source === "CLASS" ? "Clase presencial" : achievement.source === "QUICK_LOG" ? "Registro personal" : "Rutina personalizada"}</p>}<p className="mt-1 text-xs leading-relaxed text-[var(--foreground-muted)]">{achievement.description}</p>{achievement.previousValue && achievement.newValue && <p className="mt-1 text-xs text-[var(--foreground-muted)]">{achievement.previousValue} → {achievement.newValue}</p>}{achievement.feedback && <p className="mt-2 rounded-lg bg-yellow-400/[.05] p-2 text-xs text-zinc-300">Devolución: {achievement.feedback}</p>}<div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-[var(--foreground-muted)]"><span>{achievement.unlocked ? date(achievement.unlockedAt) : `${achievement.progress} de ${achievement.target}`}</span>{achievement.unlocked && <span className="font-bold text-[var(--brand-text)]/75">Desbloqueado</span>}</div>{!achievement.unlocked && <div className="portal-points-track mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="portal-points-fill portal-points-progress h-full rounded-full bg-gradient-to-r from-amber-600 to-yellow-300" style={{ width: `${percentage}%` }} /></div>}</div></article>;
}

function achievementCategoryLabel(category: PortalAchievement["category"]) {
  const labels: Partial<Record<NonNullable<PortalAchievement["category"]>, string>> = { CONSTANCIA: "Constancia", ASISTENCIA: "Asistencia", FUERZA: "Fuerza", REPETICIONES: "Repeticiones", VOLUMEN: "Volumen", RUTINAS: "Rutinas", CLASES: "Clases", EVALUACIONES: "Evaluaciones", ANTIGUEDAD: "Antigüedad", RECORDS_PERSONALES: "Récords personales", TIEMPO: "Tiempo", PROGRESO: "Progreso" };
  return category ? labels[category] ?? category.replaceAll("_", " ") : "Otros";
}

function achievementLevelLabel(level: NonNullable<PortalAchievement["level"]>) {
  return ({ COMUN: "Común", DESTACADO: "Destacado", ESPECIAL: "Especial", HITO: "Hito" })[level];
}

function achievementIcon(achievement: PortalAchievement) {
  const className = "size-5";
  if (achievement.category === "CONSTANCIA") return <BmFlameIcon className={className} />;
  if (achievement.category === "ASISTENCIA" || achievement.category === "CLASES") return <BmAttendanceIcon className={className} />;
  if (["FUERZA", "REPETICIONES", "VOLUMEN", "RECORDS_PERSONALES"].includes(achievement.category ?? "")) return <BmBarbellIcon className={className} />;
  if (achievement.category === "RUTINAS") return <BmWorkoutIcon className={className} />;
  if (achievement.category === "EVALUACIONES") return <BmEvaluationIcon className={className} />;
  if (achievement.category === "ANTIGUEDAD") return <BmMedalIcon className={className} />;
  if (achievement.category === "TIEMPO") return <BmTimerIcon className={className} />;
  if (achievement.category === "PROGRESO") return <BmProgressIcon className={className} />;
  return <BmTrophyIcon className={className} />;
}

type PointHistoryFilter = "ALL" | "CLASSES" | "PAYMENTS" | "ACHIEVEMENTS" | "CHALLENGES";

function movementMatchesFilter(movement: StudentPointMovement, filter: PointHistoryFilter) {
  if (filter === "ALL") return true;
  if (filter === "CLASSES") return movement.eventType === "ATTENDANCE";
  if (filter === "PAYMENTS") return movement.eventType === "PAYMENT";
  if (filter === "ACHIEVEMENTS") return movement.eventType === "ACHIEVEMENT" || movement.eventType === "MILESTONE";
  return movement.eventType === "RECORD" || movement.eventType === "PERSONAL_RECORD" || movement.eventType === "WEEKLY_MISSION";
}

function movementIcon(eventType: StudentPointMovement["eventType"]) {
  if (eventType === "ATTENDANCE") return <BmAttendanceIcon size={19} />;
  if (eventType === "PAYMENT") return <BmPaymentIcon size={19} />;
  if (eventType === "ACHIEVEMENT" || eventType === "MILESTONE") return <BmTrophyIcon size={19} />;
  if (eventType === "WEEKLY_MISSION") return <BmTargetIcon size={19} />;
  if (eventType === "PERSONAL_RECORD") return <BmMedalIcon size={19} />;
  if (eventType === "RECORD") return <BmBarbellIcon size={19} />;
  return <BmChallengeIcon size={19} />;
}

function PointsHistoryPageView({ data }: { data: PortalData }) {
  return <div className="mx-auto w-full max-w-3xl overflow-x-clip px-0.5 sm:px-0">
    <header className="portal-points-enter flex items-start gap-3 md:block [--points-delay:0ms]"><PortalPointsBackLink /><div className="min-w-0 md:mt-6"><p className="text-[11px] font-black uppercase tracking-[.22em] text-[var(--brand-text)]">Historial</p><h1 className="mt-1 text-2xl font-black tracking-tight text-zinc-100 sm:text-3xl">Movimientos de puntos</h1><p className="mt-1 text-sm text-[var(--foreground-muted)]">Consultá cómo sumaste tus puntos.</p></div></header>
    <div className="mt-5"><PointsHistory data={data} /></div>
  </div>;
}

function PointsHistory({ data }: { data: PortalData }) {
  const [filter, setFilter] = useState<PointHistoryFilter>("ALL");
  const points = data.home.points;
  const visible = points.recent.filter((movement) => movementMatchesFilter(movement, filter));
  const filters: Array<[PointHistoryFilter, string]> = [["ALL", "Todos"], ["CLASSES", "Clases"], ["PAYMENTS", "Pagos"], ["ACHIEVEMENTS", "Logros"], ["CHALLENGES", "Desafíos"]];
  return <section id="historial-puntos" className="portal-points-enter scroll-mt-24 [--points-delay:400ms]"><div className="rounded-[22px] border border-white/[.08] bg-[linear-gradient(145deg,#151515,#090909)] p-4 sm:p-5"><div className="flex items-end justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-[.2em] text-[var(--brand-text)]">Historial</p><h2 className="mt-1 text-lg font-black">Movimientos de puntos</h2></div><div className="text-right text-[11px] text-[var(--foreground-muted)]"><strong className="block text-lg text-white">{points.total}</strong>Total · <span className="text-[var(--brand-text)]">+{points.monthlyTotal} mes</span></div></div><div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">{filters.map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value} className={`min-h-10 shrink-0 rounded-full border px-3 text-xs font-bold transition ${filter === value ? "border-yellow-400/55 bg-yellow-400/[.09] text-[var(--brand-text)]" : "border-white/[.08] bg-black/25 text-[var(--foreground-muted)] hover:text-zinc-300"}`}>{label}</button>)}</div><div className="mt-4 space-y-2">{visible.length ? visible.map((movement) => <article key={movement.id} className="grid min-h-16 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-white/[.06] bg-black/30 px-3 py-2.5"><span className="grid size-10 place-items-center rounded-xl border border-yellow-400/20 bg-yellow-400/[.05] text-[var(--brand-text)]">{movementIcon(movement.eventType)}</span><div className="min-w-0"><h3 className="text-sm font-semibold leading-snug text-zinc-200">{movement.description}</h3><time dateTime={movement.occurredAt} className="mt-1 block text-[11px] text-[var(--foreground-muted)]">{date(movement.occurredAt)}</time></div><strong className="shrink-0 text-sm text-[var(--brand-text)]">+{movement.points} pts</strong></article>) : <p className="rounded-xl border border-dashed border-white/[.08] p-5 text-center text-sm text-[var(--foreground-muted)]">No hay movimientos registrados todavía.</p>}</div></div></section>;
}

function ComparativeEvaluationsView({ data }: { data: PortalData }) {
  return <div className="mx-auto max-w-5xl"><header className="mb-4 px-1 pt-1 sm:mb-5"><h1 className="text-3xl font-black tracking-tight text-zinc-100 sm:text-4xl">Mis evaluaciones</h1><p className="mt-1 text-base text-[var(--foreground-muted)] sm:text-lg">Tu evolución física</p></header><PortalEvaluationsDashboard evaluations={data.evaluations} /></div>;
}

// Se conserva temporalmente para compatibilidad visual con enlaces internos antiguos.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CompactEvaluationsView({ data }: { data: PortalData }) {
  const latest = data.evaluations[0];
  if (!latest) return <PageHeader title="Evaluaciones" subtitle="Tu seguimiento"><Notice>Todavía no hay evaluaciones completadas.</Notice></PageHeader>;
  const progress = Math.min(100, Math.max(0, latest.completionPercentage ?? 100));
  const state = latest.status === "REASSESSMENT_RECOMMENDED" ? "Reevaluación recomendada" : "Completada";
  return <PageHeader title="Evaluaciones" subtitle="Tu información básica de seguimiento">
    <section className="rounded-2xl border border-yellow-400/15 bg-[linear-gradient(145deg,#181818,#090909)] p-4 shadow-[0_14px_35px_rgba(0,0,0,.25)]"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-[var(--brand-text)]">Última evaluación</p><p className="mt-2 text-lg font-black">{date(latest.date)}</p><p className="mt-1 text-xs text-[var(--foreground-muted)]">Versión {latest.version ?? data.evaluations.length} · {state}</p></div><span className="rounded-full bg-emerald-400/10 px-3 py-1 text-sm font-black text-emerald-300">{progress}%</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800" aria-label={`Progreso ${progress}%`}><div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-400" style={{ width: `${progress}%` }} /></div><div className="mt-4 grid grid-cols-2 gap-2"><SmallMetric title="Estado" value={state} /><SmallMetric title="Próxima evaluación" value={latest.reassessmentDate ? date(latest.reassessmentDate) : "—"} /></div></section>
    <details className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-3"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-bold text-[var(--brand-text)] focus:outline-none focus:ring-2 focus:ring-yellow-400"><span>Ver historial</span><span aria-hidden="true"><BmChevronRightIcon size={16} className="inline" /></span></summary><div className="mt-3 space-y-2 border-t border-zinc-800 pt-3">{data.evaluations.map((item) => <details key={item.id} className="rounded-lg bg-zinc-950 p-3"><summary className="cursor-pointer list-none"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">Versión {item.version ?? "—"} · {date(item.date)}</p><p className="mt-1 text-xs text-[var(--foreground-muted)]">{item.status === "REASSESSMENT_RECOMMENDED" ? "Reevaluación recomendada" : "Completada"} · {item.completionPercentage ?? 100}%</p></div><span className="text-xs font-bold text-[var(--brand-text)]">Ver</span></div></summary><div className="mt-3 grid grid-cols-2 gap-2 border-t border-zinc-800 pt-3 sm:grid-cols-4">{evaluationMeasurements(item).map((measurement) => <SmallMetric key={measurement.key} title={measurement.label} value={measurement.display} />)}</div></details>)}</div></details>
  </PageHeader>;
}

function evaluationMeasurements(evaluation: StudentEvaluation) {
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

// Se conserva temporalmente para compatibilidad visual mientras la Parte 2 define comparaciones públicas.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-wider text-[var(--brand-text)]">Última evaluación</p><p className="mt-1 font-bold">{date(latest.date)}</p></div><span className="text-xs text-[var(--foreground-muted)]">{measurements.length} mediciones</span></div>{summary.length > 0 && <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{summary.map((item) => <SmallMetric key={item.key} title={item.label} value={item.display} />)}</div>}{latest.notes && <p className="mt-4 rounded-xl bg-zinc-950 p-3 text-sm text-[var(--foreground-muted)]">{latest.notes}</p>}</section>
    <div className="mt-5"><BodyEvolutionCard evaluations={data.evaluations} /></div>
    <section className="mt-5"><h2 className="font-semibold">Comparación anterior</h2>{previous ? <><p className="mt-1 text-xs text-[var(--foreground-muted)]">{date(previous.date)} → {date(latest.date)}</p><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{BODY_METRICS.flatMap((metric) => { const current = latest[metric.key]; const before = previous[metric.key]; if (current === null || before === null) return []; const difference = current - before; return [<article key={metric.key} className="rounded-xl bg-zinc-900 p-3"><p className="text-xs text-[var(--foreground-muted)]">{metric.label}</p><p className="mt-1 text-sm font-semibold">{formatBodyValue(before, metric.unit)} → {formatBodyValue(current, metric.unit)}</p><p className="mt-1 text-xs text-zinc-300">{difference > 0 ? "↑ +" : difference < 0 ? "↓ " : "→ "}{formatBodyValue(difference, metric.unit)}</p></article>]; })}</div></> : <p className="mt-3 text-sm text-[var(--foreground-muted)]">Todavía no hay datos suficientes para comparar.</p>}</section>
    {bodyMeasures.length > 0 && <section className="mt-5"><h2 className="font-semibold">Medidas corporales</h2><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{bodyMeasures.map((item) => <SmallMetric key={item.key} title={item.label} value={item.display} />)}</div></section>}
    {symmetry.length > 0 && <section className="mt-5"><h2 className="font-semibold">Simetría corporal</h2><p className="mt-1 text-xs text-[var(--foreground-muted)]">Comparación informativa, sin interpretación médica.</p><div className="mt-3 grid gap-2 sm:grid-cols-3">{symmetry.map((item) => { const difference = Math.abs(item.right - item.left); const greater = item.right === item.left ? "Sin diferencia" : item.right > item.left ? "Mayor medida: derecho" : "Mayor medida: izquierdo"; return <article key={item.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3"><p className="font-semibold">{item.label}</p><p className="mt-2 text-xs text-[var(--foreground-muted)]">Derecho {formatBodyValue(item.right, "cm")} · Izquierdo {formatBodyValue(item.left, "cm")}</p><p className="mt-2 text-xs text-[var(--foreground-muted)]">Diferencia {formatBodyValue(difference, "cm")} · {greater}</p></article>; })}</div></section>}
    <section className="mt-5"><h2 className="font-semibold">Historial de evaluaciones</h2><div className="mt-3 space-y-2">{data.evaluations.map((item) => <details key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3"><summary className="cursor-pointer list-none"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold">{date(item.date)}</p><p className="mt-1 text-xs text-[var(--foreground-muted)]">{item.weight === null ? "Evaluación corporal" : formatBodyValue(item.weight, "kg")}{item.bmi === null ? "" : ` · IMC ${number(item.bmi)}`}</p></div><span className="text-sm font-bold text-[var(--brand-text)]">Ver detalle</span></div></summary><div className="mt-3 grid grid-cols-2 gap-2 border-t border-zinc-800 pt-3 sm:grid-cols-4">{evaluationMeasurements(item).map((measurement) => <SmallMetric key={measurement.key} title={measurement.label} value={measurement.display} />)}</div>{item.notes && <p className="mt-3 rounded-xl bg-zinc-950 p-3 text-sm text-[var(--foreground-muted)]">{item.notes}</p>}</details>)}</div></section>
  </PageHeader>;
}

function PaymentsView({ data }: { data: PortalData }) {
  const [visibleCount, setVisibleCount] = useState(8);
  const account = data.paymentAccount;
  const status = accountStatus[account.status];
  const openObligations = openTransferObligations(data.paymentObligations);
  return <PageHeader title="Mi cuota" subtitle="Estado e historial personal de pagos">
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-[var(--foreground-muted)]">Estado actual</p><span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-sm font-bold ${status.className}`}>{status.label}</span></div>{account.monthlyFee > 0 && <p className="text-2xl font-bold">{money(account.monthlyFee)}<span className="ml-1 text-xs font-normal text-[var(--foreground-muted)]">por mes</span></p>}</div>
      {account.configured ? <><dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><SmallMetric title="Próximo vencimiento" value={date(account.nextDueDate)} /><SmallMetric title="Plan" value={account.plan || "Sin detalle"} /><SmallMetric title="Último pago" value={account.lastPaymentDate ? date(account.lastPaymentDate) : "Sin registrar"} /><SmallMetric title="Importe del último pago" value={account.lastPaymentAmount === null ? "Sin pagos" : money(account.lastPaymentAmount)} /></dl>{account.status === "SIN_PAGOS" && <p className="mt-3 rounded-lg bg-yellow-400/5 px-3 py-2 text-sm text-yellow-100">Tu cuota todavía no registra pagos.</p>}</> : <p className="mt-4 text-sm text-[var(--foreground-muted)]">Todavía no tenés una cuota configurada.</p>}
    </section>
    <section className="mt-5">
      <h2 className="font-semibold">Historial de pagos</h2>
      {data.payments.length ? <div className="mt-3 space-y-2">{data.payments.slice(0, visibleCount).map((payment) => <article key={payment.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{date(payment.paidDate || payment.createdAt)}</p><p className="mt-1 text-xs capitalize text-[var(--foreground-muted)]">{billingPeriod(payment.billingPeriod) || payment.concept}</p></div><div className="text-right"><p className="font-bold">{money(payment.amount)}</p><span className="mt-1 inline-flex rounded-full bg-emerald-400/10 px-2 py-0.5 text-[11px] font-bold text-emerald-300">Confirmado</span></div></div><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--foreground-muted)]"><span>{payment.method || "Medio no informado"}</span>{payment.concept && billingPeriod(payment.billingPeriod) && <span>{payment.concept}</span>}</div>{payment.notes && <p className="mt-2 border-t border-zinc-800 pt-2 text-xs text-[var(--foreground-muted)]">{payment.notes}</p>}</article>)}</div> : <Notice>Todavía no hay pagos registrados.</Notice>}
      {visibleCount < data.payments.length && <button type="button" onClick={() => setVisibleCount((count) => count + 10)} className="mt-3 rounded-lg border border-zinc-700 px-3 py-2 text-sm font-bold text-[var(--brand-text)] focus:outline-none focus:ring-2 focus:ring-yellow-400">Ver más pagos</button>}
    </section>
    <section className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900 p-4"><h2 className="font-semibold">Medios de pago</h2>{data.paymentMethods.length ? <ul className="mt-3 space-y-2">{data.paymentMethods.map((method) => { const transfer = method.trim().toLocaleLowerCase("es") === "transferencia"; return <li key={method}>{transfer && openObligations.length ? <PortalTransferPaymentSheet details={data.transferDetails} obligations={data.paymentObligations} /> : <div className="flex min-h-11 items-center justify-between rounded-lg bg-zinc-950 px-3 py-2 text-sm text-zinc-300"><span>{method}</span>{transfer && data.paymentObligations.length > 0 && <span className="text-xs text-emerald-300">Sin saldo pendiente</span>}</div>}</li>; })}</ul> : <p className="mt-2 text-sm text-[var(--foreground-muted)]">Consultá con tu entrenador para conocer los medios de pago.</p>}<p className="mt-3 text-xs text-[var(--foreground-muted)]">Los pagos son confirmados únicamente por el entrenador.</p></section>
  </PageHeader>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PortalSchedules({ data }: { data: PortalData }) {
  const { scheduleLabels, flexibleSchedule } = data.profile;
  if (!scheduleLabels.length && !flexibleSchedule) return null;
  return <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
    <h2 className="font-semibold">Tus horarios</h2>
    {scheduleLabels.length > 0 && <ul className="mt-3 space-y-2">{scheduleLabels.map((label) => <li key={label} className="rounded-lg bg-zinc-950 px-3 py-2 text-sm text-zinc-300">{label}</li>)}</ul>}
    {flexibleSchedule && <p className="mt-3 text-sm text-[var(--foreground-muted)]">Horario habitual: <span className="font-semibold text-zinc-200">{flexibleSchedule}</span></p>}
  </section>;
}

export function WorkoutView({ data, selfService = false }: { data: OfflineWorkoutData; selfService?: boolean }) {
  const requestWorkout = useCallback(async <T,>(input: RequestInfo | URL, init: RequestInit | undefined, options: { fallback: string; scope: "portal" }): Promise<T> => {
    if (!selfService && hasOfflineTraining(data.profile.id) && typeof init?.body === "string") return await saveOfflineWorkout(JSON.parse(init.body) as PortalWorkoutSession) as T;
    return apiRequest<T>(input, init, options);
  }, [data.profile.id, selfService]);
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
  const [focusExerciseId, setFocusExerciseId] = useState<string | null>(null);
  const focusRootRef = useRef<HTMLDivElement | null>(null);
  const exerciseRestTimer = useExerciseRestTimer();
  const autosaveSignature = useRef("");
  const autosaveAbortRef = useRef<AbortController | null>(null);
  const saveLockRef = useRef(false);
  const sessionFinalizingRef = useRef(false);
  const setCompletionLocksRef = useRef(new Set<string>());
  const exerciseHeaderRefs = useRef(new Map<string, HTMLButtonElement>());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const selectedDay = trainingDays.find((day) => day.id === selectedDayId);
  const focusViewportActive = Boolean(focusExerciseId && draft && !completionSuccess);
  useEffect(() => {
    if (!focusViewportActive) return;
    const root = focusRootRef.current;
    const viewport = window.visualViewport;
    const fitViewport = () => {
      if (!root || (viewport && Math.abs(viewport.scale - 1) > .05)) return;
      root.style.setProperty("--focus-viewport-height", `${Math.min(window.innerHeight, viewport?.height ?? window.innerHeight)}px`);
      root.style.setProperty("--focus-viewport-top", `${viewport?.offsetTop ?? 0}px`);
    };
    fitViewport();
    viewport?.addEventListener("resize", fitViewport);
    viewport?.addEventListener("scroll", fitViewport);
    window.addEventListener("resize", fitViewport);
    return () => {
      viewport?.removeEventListener("resize", fitViewport);
      viewport?.removeEventListener("scroll", fitViewport);
      window.removeEventListener("resize", fitViewport);
      root?.style.removeProperty("--focus-viewport-height");
      root?.style.removeProperty("--focus-viewport-top");
    };
  }, [focusViewportActive]);

  useEffect(() => {
    const delay = Math.max(1_000, getLocalWeekEnd().getTime() - Date.now() + 1_001);
    const timer = window.setTimeout(() => window.location.reload(), delay);
    return () => window.clearTimeout(timer);
  }, [weekKey]);

  const storageKey = useCallback((dayId: string) => {
    return routine ? workoutDraftStorageKey(data.profile.id, routine.id, dayId, weekKey) : "";
  }, [data.profile.id, routine, weekKey]);
  const persistDraft = useCallback((value: PortalWorkoutSession) => {
    if (!selfService && hasOfflineTraining(data.profile.id)) void stageOfflineWorkout(value).catch((error: Error) => setError(error.message));
    else window.localStorage.setItem(storageKey(value.dayId), JSON.stringify(value));
  }, [data.profile.id, selfService, storageKey]);

  function freshDraft(dayId: string): PortalWorkoutSession | null {
    const day = trainingDays.find((item) => item.id === dayId);
    if (!routine || !day) return null;
    const todayKey = argentinaDateKey();
    const databaseSession = findCurrentWeekSession(data.workoutSessions, { routineId: routine.id, dayId, weekKey });
    if (databaseSession) return databaseSession;
    const currentStorageKey = storageKey(dayId);
    const saved = offlineWorkoutDraft(routine.id, dayId, weekKey) ?? (typeof window === "undefined" ? null : window.localStorage.getItem(currentStorageKey));
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
    if (completionSuccess || draft || !selectedDayId) return;
    const timer = window.setTimeout(() => {
      const next = freshDraft(selectedDayId);
      setDraft(next);
      setOpenExerciseId(initialOpenExerciseId(next?.exercises ?? []));
      const saved = window.localStorage.getItem(storageKey(selectedDayId));
      setStarted(next?.status === "en_progreso" && Boolean(next.id || saved || offlineWorkoutDraft(routine?.id ?? "", selectedDayId, weekKey)));
    }, 0);
    return () => window.clearTimeout(timer);
    // freshDraft reads the current server payload; this initialization only runs while draft is empty.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completionSuccess, data.profile.id, draft, selectedDayId]);

  function chooseDay(dayId: string) {
    if (started && draft?.status === "en_progreso" && dayId !== draft.dayId && !window.confirm("Hay un entrenamiento en progreso. Se conservará por separado. ¿Querés cambiar de día?")) return;
    const next = freshDraft(dayId);
    setSelectedDayId(dayId);
    setFocusExerciseId(null);
    setDraft(next);
    setOpenExerciseId(initialOpenExerciseId(next?.exercises ?? []));
    setStarted(next?.status === "en_progreso" && Boolean(next.id || offlineWorkoutDraft(routine?.id ?? "", dayId, weekKey) || window.localStorage.getItem(storageKey(dayId))));
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
    if (!draft || sessionFinalizingRef.current) return;
    const exercises = [...draft.exercises];
    const exercise = exercises[exerciseIndex];
    const sets = [...exercise.sets];
    sets[setIndex] = { ...sets[setIndex], ...changes };
    const next = beginWith({ ...draft, exercises: exercises.map((item, index) => index === exerciseIndex ? { ...exercise, sets } : item) });
    setDraft(next);
    persistDraft(next);
  }

  async function updateSetCompletion(exerciseIndex: number, setIndex: number, completed: boolean) {
    if (!draft || sessionFinalizingRef.current) return;
    const exercise = draft.exercises[exerciseIndex];
    const set = exercise?.sets[setIndex];
    if (!exercise || !set || set.completed === completed) return;
    const lockKey = `${exercise.exerciseId}:${set.setNumber}`;
    if (setCompletionLocksRef.current.has(lockKey)) return;
    setCompletionLocksRef.current.add(lockKey);
    const shouldAdvance = exerciseCompletesWithSetChange(exercise, setIndex, completed);
    const sets = exercise.sets.map((item, index) => index === setIndex ? { ...item, completed } : item);
    const exercises = draft.exercises.map((item, index) => index === exerciseIndex ? { ...exercise, sets } : item);
    const next = beginWith({ ...draft, exercises });
    const signature = JSON.stringify(next);
    autosaveAbortRef.current?.abort();
    autosaveSignature.current = signature;
    setDraft(next);
    persistDraft(next);
    setError("");
    try {
      const body = await requestWorkout<{ id?: string }>("/api/portal/entrenamientos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...next, status: "en_progreso" }) }, { fallback: "No se pudo guardar el entrenamiento.", scope: "portal" });
      const saved = { ...next, id: body.id ?? next.id };
      autosaveSignature.current = JSON.stringify(saved);
      persistDraft(saved);
      setDraft((current) => current?.dayId === saved.dayId ? { ...current, id: saved.id } : current);
      if (shouldAdvance) {
        const nextExerciseId = nextIncompleteExerciseId(saved.exercises, exercise.exerciseId);
        setOpenExerciseId(nextExerciseId);
        if (nextExerciseId && !focusExerciseId) window.requestAnimationFrame(() => exerciseHeaderRefs.current.get(nextExerciseId)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
      }
    } catch (value) {
      autosaveSignature.current = "";
      setError(value instanceof Error ? value.message : "No se pudo guardar el entrenamiento.");
    } finally {
      setCompletionLocksRef.current.delete(lockKey);
    }
  }

  function updateBlockResult(blockId: string, changes: Partial<NonNullable<PortalWorkoutSession["blocks"]>[number]["result"]>) {
    if (!draft || sessionFinalizingRef.current) return;
    const next = beginWith({ ...draft, blocks: (draft.blocks ?? []).map((block) => block.blockId === blockId ? { ...block, result: { ...block.result, ...changes } } : block) });
    setDraft(next);
    persistDraft(next);
  }

  async function completeBlockResult(blockId: string, changes: Partial<NonNullable<PortalWorkoutSession["blocks"]>[number]["result"]>) {
    if (!draft) throw new Error("No hay una sesión activa.");
    if (sessionFinalizingRef.current) return;
    const next = beginWith({ ...draft, blocks: (draft.blocks ?? []).map((block) => block.blockId === blockId ? { ...block, result: { ...block.result, ...changes } } : block) });
    const signature = JSON.stringify(next);
    autosaveAbortRef.current?.abort();
    autosaveSignature.current = signature;
    setError("");
    try {
      const body = await requestWorkout<{ id?: string }>("/api/portal/entrenamientos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...next, status: "en_progreso" }) }, { fallback: "No se pudo guardar el entrenamiento.", scope: "portal" });
      const saved = { ...next, id: body.id ?? next.id };
      autosaveSignature.current = JSON.stringify(saved);
      persistDraft(saved);
      setDraft((current) => current?.dayId === next.dayId ? saved : current);
    } catch (value) {
      autosaveSignature.current = "";
      const message = value instanceof Error ? value.message : "No se pudo guardar el entrenamiento.";
      setError(message);
      throw value;
    }
  }

  useEffect(() => {
    if (sessionFinalizingRef.current || !started || !draft || draft.status === "finalizado") return;
    persistDraft(draft);
    const signature = JSON.stringify(draft);
    if (signature === autosaveSignature.current) return;
    const controller = new AbortController();
    autosaveAbortRef.current = controller;
    const timer = window.setTimeout(async () => {
      if (sessionFinalizingRef.current) return;
      try {
        const body = await requestWorkout<{ id?: string }>("/api/portal/entrenamientos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, status: "en_progreso" }), signal: controller.signal }, { fallback: "No se pudo guardar automáticamente.", scope: "portal" });
        autosaveSignature.current = signature;
        if (!draft.id && body.id) setDraft((current) => current?.dayId === draft.dayId ? { ...current, id: body.id } : current);
      } catch (value) {
        if (sessionFinalizingRef.current || value instanceof DOMException && value.name === "AbortError") return;
        setError(value instanceof Error ? value.message : "No se pudo guardar automáticamente.");
      }
    }, 900);
    return () => { window.clearTimeout(timer); controller.abort(); if (autosaveAbortRef.current === controller) autosaveAbortRef.current = null; };
  }, [data.profile.id, draft, started, storageKey, persistDraft, requestWorkout]);
  async function save(finalize = false) {
    if (!draft || saveLockRef.current) return;
    saveLockRef.current = true;
    if (finalize) {
      sessionFinalizingRef.current = true;
      autosaveAbortRef.current?.abort();
      autosaveAbortRef.current = null;
    }
    setSaving(true); setSavingAction(finalize ? "final" : "draft"); setError(""); setMessage("");
    try {
      const duration = draft.durationMinutes;
      const finalComment = finalize && sensation ? `Sensación general: ${sensation}${draft.finalComment.trim() ? `\n${draft.finalComment.trim()}` : ""}` : draft.finalComment;
      const painDetails = finalize && draft.hasPain
        ? [`Zona: ${painLocation.trim() || "sin especificar"}`, painIntensity ? `Intensidad: ${painIntensity}/10` : "", draft.painDetails.trim()].filter(Boolean).join(" · ")
        : draft.painDetails;
      const payload = { ...draft, durationMinutes: duration, generalFeeling: finalize ? sensation as PortalWorkoutSession["generalFeeling"] : draft.generalFeeling, finalComment, painDetails, status: finalize ? "finalizado" as const : "en_progreso" as const };
      const body = await requestWorkout<{ id?: string; achievements?: PortalAchievement[]; newAchievements?: CelebrationAchievement[] }>("/api/portal/entrenamientos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }, { fallback: "No se pudo guardar.", scope: "portal" });
      announceNewAchievements(body.newAchievements);
      const updated = { ...payload, id: body.id };
      if (finalize) {
        window.localStorage.removeItem(storageKey(draft.dayId));
        autosaveSignature.current = "";
        setStarted(false);
        setFinalOpen(false);
        setDraft(null);
        setError("");
        setMessage("");
        setCompletionSuccess(true);
        window.setTimeout(() => window.location.assign(selfService ? "/portal/autogestion/rutina" : "/portal/rutina#historial-entrenamientos"), body.newAchievements?.length ? 4200 : 1400);
      } else {
        setDraft(updated);
        setMessage("Progreso guardado.");
      }
    } catch (value) {
      if (finalize) sessionFinalizingRef.current = false;
      setError(value instanceof Error ? value.message : "No se pudo guardar.");
    }
    finally { saveLockRef.current = false; setSaving(false); setSavingAction(null); }
  }
  function openFinalSummary() {
    if (!draft || !started) return;
    setAllowIncomplete(false);
    setFinalOpen(true);
  }
  function focusExercise(id: string) {
    setFocusExerciseId(id);
    setOpenExerciseId(id);
    window.requestAnimationFrame(() => {
      document.querySelector(".workout-focus-body")?.scrollTo({ top: 0 });
      if (!focusExerciseId) document.querySelector<HTMLButtonElement>('[aria-label="Salir del modo enfoque"]')?.focus({ preventScroll: true });
    });
  }
  function exitFocus() {
    const id = focusExerciseId;
    setFocusExerciseId(null);
    if (id) {
      setOpenExerciseId(id);
      window.requestAnimationFrame(() => {
        const header = exerciseHeaderRefs.current.get(id);
        header?.scrollIntoView({ block: "center" });
        header?.focus({ preventScroll: true });
      });
    }
  }
  if (!routine || !selectedDay) return <PageHeader title="Mi rutina" subtitle="Tu planificación activa"><Notice>Todavía no tenés una rutina activa.</Notice></PageHeader>;
  const totalSets = draft?.exercises.reduce((total, exercise) => total + exercise.sets.length, 0) ?? 0;
  const completedTotal = draft?.exercises.reduce((total, exercise) => total + exercise.sets.filter((set) => set.completed).length, 0) ?? 0;
  const completedExercises = completedExerciseCount(draft?.exercises ?? []);
  const conditioningBlocks = selectedDay.blocks.filter((block) => block.type !== "STRENGTH");
  const completedConditioningBlocks = (draft?.blocks ?? []).filter((block) => block.blockType !== "STRENGTH" && block.result.completed).length;
  const totalActivities = selectedDay.blocks.filter((block) => block.type === "STRENGTH").reduce((sum, block) => sum + block.exercises.length, 0) + conditioningBlocks.length;
  const completedActivities = completedExercises + completedConditioningBlocks;
  const completedStrengthBlocks = selectedDay.blocks.filter((block) => block.type === "STRENGTH" && block.exercises.length > 0 && block.exercises.every((programmed) => {
    const exercise = draft?.exercises.find((item) => item.exerciseId === programmed.id);
    return Boolean(exercise?.sets.length && exercise.sets.every((set) => set.completed));
  })).length;
  const completedBlocks = completedStrengthBlocks + completedConditioningBlocks;
  const totalBlocks = selectedDay.blocks.length;
  const routineDisplayName = cleanRoutineDisplayName(routine.name) || routine.name;
  const selectedDayName = usefulDayName(selectedDay.dayNumber, selectedDay.name);
  const dayFocus = selectedDay.objective || selectedDayName || routine.objective || `Día ${selectedDay.dayNumber}`;
  const dayProgress = totalBlocks ? completedBlocks / totalBlocks * 100 : 0;
  const dayStateLabel = completedBlocks === totalBlocks && totalBlocks ? "Completado" : started ? "En curso" : "Sin comenzar";
  const incomplete = completedActivities < totalActivities;
  const focusIndex = draft?.exercises.findIndex((exercise) => exercise.exerciseId === focusExerciseId) ?? -1;
  const focused = focusIndex >= 0 && !completionSuccess;
  const focusExerciseData = focused ? draft?.exercises[focusIndex] : undefined;
  // A running rest belongs to its original exercise even after Previous/Next.
  const timerExercise = draft?.exercises.find((exercise) => exercise.exerciseId === exerciseRestTimer.timer?.exerciseId && ["running", "paused"].includes(exerciseRestTimer.timer.status)) ?? focusExerciseData;
  const timerProgrammed = selectedDay.exercises.find((exercise) => exercise.id === timerExercise?.exerciseId);
  return <>
    <div ref={focusRootRef} className={`portal-routine-screen ${focused ? "workout-focus" : ""}`} role={focused ? "dialog" : undefined} aria-modal={focused ? true : undefined} aria-label={focused ? "Modo enfoque" : undefined} onKeyDown={(event) => {
      if (!focused || finalOpen || !event.currentTarget.contains(event.target as Node)) return;
      if (event.key === "Escape") exitFocus();
      if (event.key === "Tab") {
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), summary, a[href], select, textarea')).filter((element) => element.getClientRects().length > 0);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}>
    {focused && draft && <WorkoutFocusHeader index={focusIndex} total={draft.exercises.length} onExit={exitFocus} />}
    <div hidden={focused}>
    <header className="portal-routine-enter mb-3 px-1"><p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--brand-text)]/80">Tu plan activo</p><p className="mt-1 text-sm font-semibold text-zinc-300">{routineDisplayName}</p></header>
    <div aria-label="Días de la rutina" className="portal-routine-enter mb-4 flex w-fit max-w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{trainingDays.map((day) => {
      const usefulName = usefulDayName(day.dayNumber, day.name);
      return <button type="button" key={day.id} onClick={() => chooseDay(day.id)} aria-pressed={day.id === selectedDayId} className="portal-routine-day min-h-11 shrink-0 rounded-full border px-4 py-2 text-left text-sm font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-yellow-300"><span className="block text-xs font-medium">Día {day.dayNumber}</span>{usefulName && <span className="mt-0.5 block max-w-36 truncate text-sm font-bold">{usefulName}</span>}</button>;
    })}</div>
    <section className="portal-routine-hero portal-routine-enter relative mb-4 overflow-hidden rounded-3xl border p-4 sm:p-5">
      <span className={`absolute right-3 top-3 rounded-full border px-2.5 py-1 text-[11px] font-bold ${dayStateLabel === "Completado" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : dayStateLabel === "En curso" ? "border-yellow-400/25 bg-yellow-400/10 text-[var(--brand-text)]" : "border-zinc-700 bg-zinc-800/90 text-[var(--foreground-muted)]"}`}>{dayStateLabel}</span>
      <div className="mb-3 flex items-center gap-2 pt-6 text-[11px] font-bold uppercase tracking-[.2em] text-[var(--brand-text)]"><BmPointsIcon size={15} /> Tu entrenamiento de hoy</div>
      <div className="grid grid-cols-[minmax(0,1fr)_4rem] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_4.75rem]">
        <div className="min-w-0"><p className="line-clamp-2 break-words text-2xl font-black leading-tight text-white sm:text-3xl">{dayFocus}</p><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--foreground-muted)]"><span className="inline-flex items-center gap-1.5"><BmBarbellIcon size={16} className="text-[var(--brand-text)]" />{selectedDay.exercises.length} ejercicios</span>{selectedDay.estimatedMinutes && <span className="inline-flex items-center gap-1.5"><BmTimerIcon size={16} className="text-[var(--brand-text)]" />{selectedDay.estimatedMinutes} min</span>}</div>{selectedDay.id === suggestedDayId && <p className="mt-2 text-sm font-semibold text-[var(--brand-text)]">Día sugerido</p>}</div>
        <div aria-label={`${completedBlocks} de ${totalBlocks} bloques completados`} className="portal-routine-progress-ring grid aspect-square shrink-0 place-items-center rounded-full p-[7px]" style={{ "--routine-progress": `${dayProgress * 3.6}deg` } as CSSProperties}><span className="grid h-full w-full place-items-center rounded-full bg-zinc-950 text-center"><span><strong className="block text-lg font-black text-white">{completedBlocks}/{totalBlocks}</strong><small className="block text-[11px] text-[var(--foreground-muted)]">bloques</small></span></span></div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-[var(--foreground-muted)]"><span>Progreso del día</span><span>{Math.round(dayProgress)}%</span></div>
      <div className="portal-routine-track mt-1.5 h-1.5 overflow-hidden rounded-full"><div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-[width]" style={{ width: `${dayProgress}%` }} /></div>
    </section>
    {selectedDay.warmup.trim() && <button type="button" onClick={() => setWarmupOpen(true)} className="portal-routine-warmup portal-routine-enter mb-4 flex min-h-20 w-full items-center gap-3 rounded-3xl border px-4 py-3 text-left outline-none transition hover:border-yellow-400/45 focus-visible:ring-2 focus-visible:ring-yellow-300"><span className="grid size-12 shrink-0 place-items-center rounded-full border border-yellow-300/60 text-[var(--brand-text)]"><BmFlameIcon size={24} /></span><span className="min-w-0 flex-1"><strong className="block text-base text-zinc-100">Entrada en calor</strong><span className="mt-1 block text-xs text-[var(--foreground-muted)]">Prepará tu cuerpo para entrenar</span></span><BmChevronRightIcon size={22} className="shrink-0 text-[var(--brand-text)]" /></button>}
    <div className="portal-routine-enter mb-4 flex items-center gap-3 px-1"><BmSlidersIcon size={20} className="text-[var(--brand-text)]" /><h2 className="shrink-0 text-sm font-black uppercase tracking-[.2em] text-[var(--brand-text)]">Recorrido de hoy</h2><span className="h-px flex-1 bg-gradient-to-r from-yellow-400/40 to-transparent" /></div>
    </div>
    {completionSuccess && <div role="status" aria-live="polite" className="fixed inset-x-4 top-[calc(env(safe-area-inset-top)+1rem)] z-[100] mx-auto max-w-md rounded-xl border border-emerald-400/40 bg-zinc-950 px-4 py-3 text-center font-semibold text-emerald-200 shadow-2xl">Entrenamiento guardado correctamente</div>}
    {message && <p className="mb-4 rounded-xl bg-emerald-400/10 p-3 text-emerald-200">{message}</p>}{error && <p className="mb-4 rounded-xl bg-red-400/10 p-3 text-red-200">{error}</p>}{!draft && !completionSuccess && <p className="rounded-xl bg-zinc-900 p-4 text-sm text-[var(--foreground-muted)]">Preparando ejercicios…</p>}
    <RoutineOverlay open={warmupOpen} onClose={() => setWarmupOpen(false)} labelledBy="warmup-title"><header className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-800 p-4 sm:p-5"><div className="min-w-0"><h2 id="warmup-title" className="text-lg font-black">Entrada en calor</h2><p className="mt-1 text-sm text-[var(--brand-text)]">Día {selectedDay.dayNumber} · {selectedDay.objective || selectedDay.name}</p></div><button type="button" onClick={() => setWarmupOpen(false)} aria-label="Cerrar entrada en calor" className="grid size-10 shrink-0 place-items-center rounded-xl border border-zinc-800 text-[var(--foreground-muted)] outline-none hover:bg-zinc-800 hover:text-white focus-visible:ring-2 focus-visible:ring-yellow-300"><BmCloseIcon size={22} /></button></header><div className="min-h-0 overflow-y-auto p-4 sm:p-5"><p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-200">{selectedDay.warmup}</p><button type="button" onClick={() => setWarmupOpen(false)} className="mt-5 min-h-11 w-full rounded-xl border border-zinc-700 px-4 text-sm font-bold text-zinc-200">Cerrar</button></div></RoutineOverlay>
    <div className="portal-routine-timeline" hidden={focused}>{draft && conditioningBlocks.map((programmed) => {
      const block = (draft.blocks ?? []).find((item) => item.blockId === programmed.id);
      return block ? <div key={block.blockId} className="portal-routine-timeline-row portal-routine-enter"><WorkoutBlockCard block={block} programmed={programmed} libraryMediaEnabled={data.exerciseMediaEnabled} timerPersistenceKey={`${storageKey(selectedDay.id)}:timer:${block.blockId}`} open={openBlockId === block.blockId} toggle={() => setOpenBlockId(openBlockId === block.blockId ? null : block.blockId)} update={(changes) => updateBlockResult(block.blockId, changes)} complete={(changes) => completeBlockResult(block.blockId, changes)} /></div> : null;
    })}</div>
    {draft && <>
      <div className={focused ? "workout-focus-body" : "contents"}>
      <div className="mt-5 space-y-3">{draft.exercises.map((exercise, exerciseIndex) => {
        const programmed = selectedDay.exercises.find((item) => item.id === exercise.exerciseId);
        const instructions = separateWorkoutInstructions(programmed?.observations);
        const completedSets = exercise.sets.filter((set) => set.completed).length;
        const open = focused ? focusExerciseId === exercise.exerciseId : openExerciseId === exercise.exerciseId;
        const completed = completedSets === exercise.sets.length && exercise.sets.length > 0;
        return <article key={exercise.exerciseId} hidden={focused && focusExerciseId !== exercise.exerciseId} className={`portal-routine-exercise overflow-hidden rounded-2xl border transition ${open ? "border-yellow-400/25 shadow-[0_12px_28px_rgba(0,0,0,.22)]" : "border-zinc-800"}`}>
          {focused && open && programmed && <WorkoutFocusMedia key={exercise.exerciseId} exercise={programmed} libraryMediaEnabled={data.exerciseMediaEnabled} />}
          {focused && open && <WorkoutFocusIdentity name={exercise.exerciseName} muscles={programmed?.muscleGroup} previous={exercise.previous} />}
          <div className="relative" hidden={focused}>
          <button ref={(node) => { if (node) exerciseHeaderRefs.current.set(exercise.exerciseId, node); else exerciseHeaderRefs.current.delete(exercise.exerciseId); }} type="button" aria-expanded={open} aria-controls={`exercise-${exercise.exerciseId}`} onClick={() => setOpenExerciseId(open ? null : exercise.exerciseId)} className="w-full scroll-mt-24 p-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-yellow-300">
            <span className="flex items-start gap-3"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-black ${completed ? "bg-emerald-400/10 text-emerald-300" : "bg-yellow-400/10 text-[var(--brand-text)]"}`}>{completed ? "✓" : exerciseIndex + 1}</span><span className="min-w-0 flex-1 pr-28"><span className="block truncate text-sm font-bold text-zinc-100">{exercise.exerciseName}</span><span className="mt-1 block text-[11px] leading-relaxed text-[var(--foreground-muted)]">{programmed ? `${programmed.sets} series · ${programmed.repetitions} reps${programmed.restSeconds !== null ? ` · ${programmed.restSeconds} s` : ""}${programmed.weight !== null ? ` · ${programmed.weight} kg` : ""}` : `${exercise.sets.length} series`}</span></span><span className="shrink-0 text-right"><span className="block text-[11px] font-semibold text-[var(--foreground-muted)]">{completedSets}/{exercise.sets.length}</span><span aria-hidden="true" className={`mt-1 block text-sm text-[var(--brand-text)] transition-transform ${open ? "rotate-180" : ""}`}>⌄</span></span></span>
            <span className="portal-routine-track mt-3 block h-1 overflow-hidden rounded-full"><span className="block h-full rounded-full bg-yellow-400 transition-[width]" style={{ width: `${exercise.sets.length ? completedSets / exercise.sets.length * 100 : 0}%` }} /></span>
          </button>
          {(open || exerciseRestTimer.timer?.exerciseId === exercise.exerciseId) && programmed?.restSeconds !== null && programmed?.restSeconds !== undefined && programmed.restSeconds > 0 && <ExerciseRestTimer exerciseId={exercise.exerciseId} exerciseName={exercise.exerciseName} durationSeconds={programmed.restSeconds} {...exerciseRestTimer} />}
          </div>
          {instructions.structural.length > 0 && <div data-structural-instructions className="space-y-2 border-t border-yellow-400/10 bg-yellow-400/[.035] px-3 py-3 sm:px-4">{instructions.structural.map((instruction) => <div key={`${instruction.label}-${instruction.text}`} className="flex items-start gap-2.5 rounded-xl border border-yellow-400/20 bg-zinc-950/70 px-3 py-2.5"><span className="mt-0.5 shrink-0 rounded-md bg-yellow-400/10 px-2 py-1 text-[11px] font-black tracking-wide text-[var(--brand-text)]">{instruction.label}</span><p className="min-w-0 text-xs leading-relaxed text-zinc-200">{instruction.text}</p></div>)}</div>}
          {open && <div id={`exercise-${exercise.exerciseId}`} className="border-t border-zinc-800 px-3 pb-4 pt-3 sm:px-4">
            {!focused && <button type="button" className="workout-focus-button mb-3 w-full" onClick={() => focusExercise(exercise.exerciseId)}><BmPlayIcon size={20} />Entrenar en modo enfoque</button>}
            <div hidden={focused} className="mb-3 flex items-center justify-between gap-3 text-[11px] text-[var(--foreground-muted)]">{programmed?.muscleGroup ? <span>{programmed.muscleGroup}</span> : <span />}{exercise.previous ? <span>Última: {exercise.previous.weight ?? "—"} kg × {exercise.previous.repetitions ?? "—"} · {date(exercise.previous.date)}</span> : <span>Sin registros anteriores</span>}</div>
            <div className="portal-routine-sets overflow-hidden rounded-xl border" onFocusCapture={() => { if (!focused) setFocusExerciseId(exercise.exerciseId); }} onChangeCapture={() => { if (!focused) setFocusExerciseId(exercise.exerciseId); }}>
              <div aria-hidden="true" className="grid grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_2.5rem] items-center gap-1 border-b border-zinc-800 px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-[var(--foreground-muted)]"><span>Serie</span><span>Kg</span><span>Reps</span><span>{programmed?.effortType ?? "RIR"}</span><span>✓</span></div>
              {exercise.sets.map((set, setIndex) => <div key={set.setNumber} data-current={!set.completed && setIndex === exercise.sets.findIndex((item) => !item.completed)} className={`grid grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_2.5rem] items-center gap-1 border-b border-zinc-800/70 px-2 py-0 last:border-0 ${set.completed ? "portal-routine-set-complete" : ""}`}><span className="text-center text-xs font-black text-[var(--brand-text)]">{set.setNumber}</span><label><span className="sr-only">Kilogramos de la serie {set.setNumber}</span><input aria-label={`Kg de la serie ${set.setNumber}`} inputMode="decimal" type="number" min="0" step=".25" value={set.weight ?? ""} onChange={(event) => updateSet(exerciseIndex, setIndex, { weight: event.target.value ? Number(event.target.value) : null })} className="min-h-10 w-full min-w-0 rounded-lg border border-zinc-700 bg-black px-1 text-center text-sm text-white outline-none focus:border-yellow-400" /></label><label><span className="sr-only">Repeticiones de la serie {set.setNumber}</span><input aria-label={`Reps de la serie ${set.setNumber}`} inputMode="numeric" type="number" min="0" value={set.repetitions ?? ""} onChange={(event) => updateSet(exerciseIndex, setIndex, { repetitions: event.target.value ? Number(event.target.value) : null })} className="min-h-10 w-full min-w-0 rounded-lg border border-zinc-700 bg-black px-1 text-center text-sm text-white outline-none focus:border-yellow-400" /></label><label><span className="sr-only">{programmed?.effortType ?? "RIR"} de la serie {set.setNumber}</span><input aria-label={`${programmed?.effortType ?? "RIR"} de la serie ${set.setNumber}`} inputMode="decimal" type="number" min="0" max="10" step=".5" value={set.effort ?? ""} onChange={(event) => updateSet(exerciseIndex, setIndex, { effort: event.target.value ? Number(event.target.value) : null })} className="min-h-10 w-full min-w-0 rounded-lg border border-zinc-700 bg-black px-1 text-center text-sm text-white outline-none focus:border-yellow-400" /></label><label className="grid min-h-10 place-items-center"><span className="sr-only">Serie {set.setNumber} completada</span><input aria-label={`Serie ${set.setNumber} completada`} type="checkbox" checked={set.completed} onChange={(event) => void updateSetCompletion(exerciseIndex, setIndex, event.target.checked)} className="h-5 w-5 accent-yellow-400" /></label></div>)}
            </div>
            {instructions.technicalText && <details className="mt-3 rounded-xl border border-zinc-800 bg-black/30 px-3 py-2 text-sm text-[var(--foreground-muted)]"><summary className="cursor-pointer list-none font-semibold text-[var(--brand-text)] outline-none focus-visible:ring-2 focus-visible:ring-yellow-300">Indicaciones</summary><div className="mt-3 border-t border-zinc-800 pt-3"><p className="whitespace-pre-line text-xs leading-relaxed text-zinc-300">{instructions.technicalText}</p></div></details>}
            {!focused && programmed && <RoutineExerciseMediaButton exercise={programmed} libraryMediaEnabled={data.exerciseMediaEnabled} separated />}
            {exercise.history.length > 0 && <details className="portal-routine-history mt-2"><summary className="flex min-h-11 cursor-pointer items-center text-xs font-semibold text-[var(--foreground-muted)]">Historial anterior ({exercise.history.length})</summary><div className="mt-2 grid gap-2 sm:grid-cols-2">{exercise.history.map((item, index) => <p key={`${item.date}-${index}`} className="rounded-lg bg-zinc-950 p-2 text-xs text-[var(--foreground-muted)]">{date(item.date)} · {item.weight ?? "—"} kg · {item.repetitions ?? "—"} reps · esfuerzo {item.effort ?? "—"}</p>)}</div></details>}
          </div>}
        </article>;
      })}</div>
      {focused && focusExerciseData && <>
        <WorkoutFocusList exercises={draft.exercises} activeId={focusExerciseData.exerciseId} onSelect={focusExercise} />
      </>}
      </div>
      {focused && timerExercise && <WorkoutFocusControls exercise={timerExercise} durationSeconds={timerProgrammed?.restSeconds ?? null} index={focusIndex} total={draft.exercises.length} onPrevious={() => { const previous = draft.exercises[focusIndex - 1]; if (previous) focusExercise(previous.exerciseId); }} onNext={() => { const next = draft.exercises[focusIndex + 1]; if (next) focusExercise(next.exerciseId); }} />}
      <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-3 max-[340px]:grid-cols-1 md:ml-auto md:flex md:max-w-xl md:justify-end"><button type="button" disabled={saving || !started} onClick={() => save(false)} className="min-h-11 min-w-0 rounded-xl border border-yellow-400/40 px-3 py-2.5 text-xs font-bold text-[var(--brand-text)] outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 disabled:opacity-50 md:text-sm">{savingAction === "draft" ? "Guardando…" : "Guardar progreso"}</button><button type="button" disabled={saving || !started} onClick={openFinalSummary} className="min-h-11 min-w-0 rounded-xl bg-yellow-400 px-3 py-2.5 text-xs font-black text-zinc-950 outline-none focus-visible:ring-2 focus-visible:ring-yellow-100 disabled:opacity-50 md:text-sm">Finalizar entrenamiento</button></div>
      {!focused && !selfService && hasPersonalizedService(data.profile.serviceType) && <div className="mt-5 border-t border-zinc-800 pt-5"><PortalActionCard href="/portal/progreso" ariaLabel="Ver mi progreso" title="Ver mi progreso" subtitle="Historial, evolución y avances" icon={<BmProgressIcon size={20} />} /></div>}
      <RoutineOverlay open={finalOpen} onClose={() => { if (!saving) setFinalOpen(false); }} labelledBy="workout-summary-title" maxWidth="max-w-xl" closeOnBackdrop={!saving}><header className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-800 p-5"><div><h2 id="workout-summary-title" className="text-xl font-bold">Finalizar entrenamiento</h2><p className="mt-1 text-sm text-[var(--foreground-muted)]">{completedTotal} de {totalSets} series{draft.durationMinutes ? ` · ${draft.durationMinutes} min` : " · duración pendiente"}</p></div><button type="button" onClick={() => setFinalOpen(false)} disabled={saving} aria-label="Cerrar finalización" className="grid size-10 shrink-0 place-items-center rounded-xl border border-zinc-700 text-[var(--foreground-muted)] outline-none hover:bg-zinc-800 hover:text-white focus-visible:ring-2 focus-visible:ring-yellow-300 disabled:opacity-50"><BmCloseIcon size={22} /></button></header><div className="min-h-0 overflow-y-auto p-5">
        {incomplete && !allowIncomplete ? <div className="portal-finish-warning mt-5 rounded-xl border border-orange-400/40 bg-orange-400/10 p-4"><p className="font-semibold text-orange-200">Todavía quedan ejercicios o series sin completar.</p><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => setFinalOpen(false)} className="rounded-lg bg-zinc-800 px-3 py-2 text-sm">Continuar entrenando</button><button onClick={() => { save(false); setFinalOpen(false); }} className="rounded-lg border border-yellow-400/40 px-3 py-2 text-sm text-[var(--brand-text)]">Guardar para continuar después</button><button onClick={() => setAllowIncomplete(true)} className="rounded-lg bg-orange-300 px-3 py-2 text-sm font-bold text-zinc-950">Finalizar igualmente</button></div></div> : <div className="mt-5 space-y-4"><Field label="Sensación general"><select value={sensation} onChange={(event) => setSensation(event.target.value)} className={`${portalInput} mt-1`}><option value="">Seleccionar</option><option>Muy buena</option><option>Buena</option><option>Normal</option><option>Difícil</option><option>Muy difícil</option></select></Field><Field label="Duración calculada (min)"><input inputMode="numeric" type="number" min="1" max="1440" placeholder="Ej: 45" value={draft.durationMinutes ?? ""} onChange={(event) => setDraft({ ...draft, durationMinutes: event.target.value === "" ? null : Number(event.target.value) })} className={`${portalInput} mt-1`} /></Field><label className="flex min-w-0 items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/[.05] p-3.5 text-red-100"><input type="checkbox" checked={draft.hasPain} onChange={(event) => setDraft({ ...draft, hasPain: event.target.checked })} className="mt-0.5 h-5 w-5 shrink-0 accent-red-400" /><span className="min-w-0"><strong className="block text-sm font-semibold">Dolor o molestias</strong><small className="mt-1 block text-xs font-normal leading-relaxed text-[var(--foreground-muted)]">Marcá esta opción si sentiste dolor durante la sesión.</small></span></label>{draft.hasPain && <div className="grid gap-3 sm:grid-cols-2"><Field label="Zona"><input value={painLocation} onChange={(event) => setPainLocation(event.target.value)} className={`${portalInput} mt-1`} /></Field><Field label="Intensidad (1 a 10)"><input type="number" min="1" max="10" value={painIntensity ?? ""} onChange={(event) => setPainIntensity(event.target.value ? Number(event.target.value) : null)} className={`${portalInput} mt-1`} /></Field><Field label="Comentario"><textarea value={draft.painDetails} onChange={(event) => setDraft({ ...draft, painDetails: event.target.value })} rows={2} className={`${portalInput} mt-1 sm:col-span-2`} /></Field></div>}<Field label="Comentario final (opcional)"><textarea value={draft.finalComment} onChange={(event) => setDraft({ ...draft, finalComment: event.target.value })} rows={3} className={`${portalInput} mt-1`} /></Field><button disabled={saving || draft.durationMinutes === null || !sensation || (draft.hasPain && (!painLocation.trim() || painIntensity === null))} onClick={() => save(true)} className="w-full rounded-xl bg-yellow-400 px-4 py-3 font-bold text-zinc-950 disabled:opacity-50">{savingAction === "final" ? "Finalizando…" : "Confirmar y finalizar"}</button></div>}
      </div></RoutineOverlay></>}
    </div>
  </>;
}

function WorkoutBlockCard({ block, programmed, libraryMediaEnabled, timerPersistenceKey, open, toggle, update, complete }: { block: PortalWorkoutBlock; programmed: TrainingRoutineBlock; libraryMediaEnabled: boolean; timerPersistenceKey: string; open: boolean; toggle: () => void; update: (changes: Partial<PortalWorkoutBlock["result"]>) => void; complete: (changes: Partial<PortalWorkoutBlock["result"]>) => Promise<void> }) {
  const configuration = [programmed.rounds ? `${programmed.rounds} rondas` : null, programmed.durationSeconds ? `${Math.round(programmed.durationSeconds / 60)} min` : null, programmed.workSeconds ? `${programmed.workSeconds} s trabajo` : null, programmed.restSeconds !== null ? `${programmed.restSeconds} s pausa` : null].filter(Boolean).join(" · ");
  const active = hasBlockActivity(block);
  const timed = isTimedBlockType(block.blockType);
  const numeric = (value: string) => value === "" ? null : Number(value);
  function toggleExercise(id: string) { update({ completedExerciseIds: block.result.completedExerciseIds.includes(id) ? block.result.completedExerciseIds.filter((item) => item !== id) : [...block.result.completedExerciseIds, id] }); }
  if (block.blockType === "MOBILITY") {
    const minutes = programmed.durationSeconds ? Math.max(1, Math.round(programmed.durationSeconds / 60)) : null;
    return <article className="portal-routine-block min-w-0 flex-1 rounded-3xl border border-yellow-400/20 p-3.5">
      <header className="flex items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-full border border-yellow-400/25 text-[var(--brand-text)]"><BmRoutineIcon size={22} /></span><span className="min-w-0 flex-1"><strong className="line-clamp-2 break-words text-base text-zinc-100">{programmed.name || "Movilidad"}</strong><span className="mt-1 block text-xs text-[var(--foreground-muted)]">Movilidad · {block.exercises.length} ejercicio{block.exercises.length === 1 ? "" : "s"}{minutes ? ` · ${minutes} min` : ""}</span></span></header>
      {programmed.instructions && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[var(--foreground-muted)]">{programmed.instructions}</p>}
      <ol className="mt-3 divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/70">{block.exercises.map((exercise) => {
        const source = programmed.exercises.find((item) => item.id === exercise.exerciseId);
        return <li key={exercise.exerciseId} className="grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-2.5 py-2"><input aria-label={`${exercise.name} completado`} type="checkbox" checked={block.result.completedExerciseIds.includes(exercise.exerciseId)} onChange={() => toggleExercise(exercise.exerciseId)} className="size-4 shrink-0 accent-yellow-400" /><span className="min-w-0"><strong className="block truncate text-xs font-semibold text-zinc-100">{exercise.name}</strong><span className="mt-0.5 block text-[11px] text-[var(--brand-text)]/80">{exercise.targetLabel}</span>{source?.observations && <span className="mt-0.5 line-clamp-1 block text-[11px] text-[var(--foreground-muted)]">{source.observations}</span>}</span>{source && <RoutineExerciseMediaButton exercise={source} libraryMediaEnabled={libraryMediaEnabled} compact />}</li>;
      })}</ol>
      <label className="mt-2 flex min-h-9 items-center gap-2 px-1 text-xs font-semibold text-zinc-300"><input type="checkbox" checked={block.result.completed} onChange={(event) => update({ completed: event.target.checked })} className="size-4 accent-yellow-400" /> Bloque completado</label>
    </article>;
  }
  return <article className={`portal-routine-block min-w-0 flex-1 overflow-hidden rounded-3xl border transition ${open ? "border-yellow-400/45 shadow-[0_12px_30px_rgba(0,0,0,.3)]" : "border-zinc-800"}`}>
    <button type="button" onClick={toggle} aria-expanded={open} className="portal-routine-block-heading flex min-h-20 w-full items-center gap-3 p-3.5 text-left sm:p-4"><span className="grid size-11 shrink-0 place-items-center rounded-full border border-yellow-400/25 text-[var(--brand-text)]">{programmed.type === "FREE" ? <BmFlameIcon size={22} /> : <BmChallengeIcon size={22} />}</span><span className="min-w-0 flex-1"><strong className="line-clamp-2 break-words text-base text-zinc-100">{programmed.name}</strong><span className="mt-1 block text-xs leading-relaxed text-[var(--foreground-muted)]">{TRAINING_BLOCK_LABELS[programmed.type]}{configuration ? ` · ${configuration}` : ""}</span></span><span className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-xl border border-yellow-400/40 px-2.5 text-xs font-bold text-[var(--brand-text)]"><span className="portal-routine-block-action">{open ? "Cerrar" : active ? "Continuar" : "Comenzar"}</span><BmChevronRightIcon size={17} className={open ? "rotate-90" : ""} /></span></button>
    {open && <div className="border-t border-zinc-800 p-3.5">
      {programmed.instructions && <p className="mb-3 whitespace-pre-wrap rounded-xl bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-300">{programmed.instructions}</p>}
      <ol className="mb-3 space-y-2">{block.exercises.map((exercise) => { const source = programmed.exercises.find((item) => item.id === exercise.exerciseId); return <li key={exercise.exerciseId} className="flex items-center gap-3 rounded-xl bg-zinc-950 px-3 py-2.5">{!timed && <input aria-label={`${exercise.name} completado`} type="checkbox" checked={block.result.completedExerciseIds.includes(exercise.exerciseId)} onChange={() => toggleExercise(exercise.exerciseId)} className="size-5 shrink-0 accent-yellow-400" />}{source && <RoutineExerciseMediaButton exercise={source} libraryMediaEnabled={libraryMediaEnabled} thumbnail />}<span className="min-w-0 flex-1"><strong className="block text-sm">{exercise.order}. {exercise.name}</strong><span className="text-xs text-[var(--foreground-muted)]">{exercise.targetLabel}</span></span></li>; })}</ol>
      {timed && <WorkoutBlockTimer block={block} programmed={programmed} persistenceKey={timerPersistenceKey} update={update} complete={complete} />}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {block.blockType === "ROUNDS" && <Field label="Rondas completadas"><input type="number" min="0" value={block.result.roundsCompleted ?? ""} onChange={(event) => update({ roundsCompleted: numeric(event.target.value) })} className={`${portalInput} mt-1`} /></Field>}
      {block.blockType === "ROUNDS" && <Field label="Duración realizada (seg.)"><input type="number" min="0" value={block.result.durationSeconds ?? ""} onChange={(event) => update({ durationSeconds: numeric(event.target.value) })} className={`${portalInput} mt-1`} /></Field>}
      {block.blockType === "FOR_TIME" && <Field label="Trabajo pendiente"><input value={block.result.pendingWork} onChange={(event) => update({ pendingWork: event.target.value })} className={`${portalInput} mt-1`} /></Field>}
      {block.blockType !== "FREE" && <Field label="Observación"><textarea rows={2} value={block.result.observation} onChange={(event) => update({ observation: event.target.value })} className={`${portalInput} mt-1`} /></Field>}
      </div>{!timed && <label className="mt-3 flex min-h-11 items-center gap-3 rounded-xl border border-zinc-700 px-3 text-sm font-semibold"><input type="checkbox" checked={block.result.completed} onChange={(event) => update({ completed: event.target.checked })} className="size-5 accent-yellow-400" /> Bloque completado</label>}
    </div>}
  </article>;
}

function workoutBlockResultSummary(block: PortalWorkoutBlock) {
  const result = block.result;
  if (block.blockType === "MOBILITY") return `${result.completedExerciseIds.length} ejercicio${result.completedExerciseIds.length === 1 ? "" : "s"} completado${result.completedExerciseIds.length === 1 ? "" : "s"}`;
  if (block.blockType === "AMRAP") return `${result.roundsCompleted ?? 0} vueltas${result.extraRepetitions ? ` + ${result.extraRepetitions} reps` : ""}`;
  if (block.blockType === "EMOM") return `${result.minutesCompleted ?? 0} min${result.roundsCompleted ? ` · ${result.roundsCompleted} ciclos` : ""}`;
  if (block.blockType === "FOR_TIME") return result.completed ? `${result.durationSeconds ?? 0} s · completado` : `${result.roundsCompleted ?? 0} rondas${result.pendingWork ? ` · pendiente: ${result.pendingWork}` : ""}`;
  if (block.blockType === "FREE") return result.resultText || (result.completed ? "Completado" : "Sin resultado");
  return `${result.roundsCompleted ?? 0} rondas${result.durationSeconds ? ` · ${result.durationSeconds} s` : ""}`;
}

function WorkoutHistoryView({ data }: { data: PortalData }) {
  const sessions = data.workoutSessions;
  useEffect(() => {
    const openLinkedSession = () => {
      if (!window.location.hash.startsWith("#historial-")) return;
      const linked = document.querySelector<HTMLDetailsElement>(window.location.hash);
      if (!linked) return;
      linked.open = true;
      window.requestAnimationFrame(() => linked.scrollIntoView({ behavior: "smooth", block: "start" }));
    };
    openLinkedSession();
    window.addEventListener("hashchange", openLinkedSession);
    return () => window.removeEventListener("hashchange", openLinkedSession);
  }, []);
  return <section>
      <div className="mb-4"><p className="text-xs font-bold uppercase tracking-wider text-[var(--brand-text)]">Rutinas personalizadas</p><h2 className="mt-1 text-xl font-bold">Historial de entrenamientos</h2>{sessions.length > 0 && <p className="mt-1 text-sm text-[var(--foreground-muted)]">{sessions.length} sesiones recientes</p>}</div>
      {sessions.length ? <div className="space-y-3">{sessions.map((session) => {
        const completedExercises = session.exercises.filter((exercise) => exercise.sets.some((set) => set.completed)).length;
        const completedSets = session.exercises.reduce((total, exercise) => total + exercise.sets.filter((set) => set.completed).length, 0);
        return <details id={session.id ? `historial-${session.id}` : undefined} key={session.id ?? `${session.date}-${session.dayId}`} className="scroll-mt-24 rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><summary className="cursor-pointer list-none"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{session.routineNameSnapshot || session.routineName || "Rutina eliminada"}</p><p className="mt-1 text-sm text-[var(--foreground-muted)]">Día {session.routineDayNumberSnapshot ?? session.dayNumber}{session.dayName ? ` — ${session.dayName}` : ""}</p><p className="mt-2 text-xs text-[var(--foreground-muted)]">{date(session.date)}{session.durationMinutes ? ` · ${session.durationMinutes} min` : ""} · {completedExercises} ejercicios · {completedSets} series · {(session.blocks ?? []).filter(hasBlockActivity).length} bloques</p></div><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${session.status === "finalizado" ? "bg-emerald-400/10 text-emerald-300" : "bg-yellow-400/10 text-[var(--brand-text)]"}`}>{session.status === "finalizado" ? "Completado" : "En progreso"}</span></div><span className="mt-3 inline-block text-sm font-bold text-[var(--brand-text)]">Ver detalle</span></summary><div className="mt-4 space-y-3 border-t border-zinc-800 pt-4">{(session.energyBefore !== null || session.difficulty !== null || session.energyAfter !== null) && <div className="grid grid-cols-3 gap-2"><SmallMetric title="Energía antes" value={session.energyBefore?.toString() ?? "Sin dato"} /><SmallMetric title="Dificultad" value={session.difficulty?.toString() ?? "Sin dato"} /><SmallMetric title="Energía después" value={session.energyAfter?.toString() ?? "Sin dato"} /></div>}{(session.blocks ?? []).filter((block) => block.blockType !== "STRENGTH").sort((left, right) => left.blockOrder - right.blockOrder).map((block) => <article key={block.id ?? block.blockId} className="rounded-xl border border-yellow-400/15 bg-zinc-950 p-3"><div className="flex items-start justify-between gap-3"><p className="font-semibold">{block.blockName}</p><span className="text-[11px] font-bold uppercase text-[var(--brand-text)]">{TRAINING_BLOCK_LABELS[block.blockType]}</span></div><p className="mt-2 whitespace-pre-wrap text-xs text-zinc-300">{workoutBlockResultSummary(block)}</p>{block.result.observation && <p className="mt-2 whitespace-pre-wrap text-xs text-[var(--foreground-muted)]">{block.result.observation}</p>}</article>)}{session.exercises.map((exercise) => <article key={exercise.id ?? exercise.exerciseId} className="rounded-xl bg-zinc-950 p-3"><p className="font-semibold">{exercise.exerciseName}</p><div className="mt-2 space-y-1">{exercise.sets.map((set) => <p key={set.id ?? set.setNumber} className="text-xs text-[var(--foreground-muted)]">Serie {set.setNumber}: {set.weight ?? "—"} kg · {set.repetitions ?? "—"} reps · RIR/RPE {set.effort ?? "—"}{set.completed ? " · completada" : ""}{set.observation ? ` · ${set.observation}` : ""}</p>)}</div>{exercise.observation && <p className="mt-2 text-xs text-[var(--foreground-muted)]">{exercise.observation}</p>}</article>)}{session.finalComment && <p className="rounded-xl bg-zinc-950 p-3 text-sm text-zinc-300">{session.finalComment}</p>}{session.hasPain && <p className="rounded-xl bg-red-400/10 p-3 text-sm text-red-200">Dolor o molestia registrada: {session.painDetails || "sin detalle"}</p>}</div></details>;
      })}</div> : <Notice>Todavía no hay entrenamientos registrados.</Notice>}
  </section>;
}

function CommentsView({ data }: { data: PortalData }) {
  const [category, setCategory] = useState("consulta"); const [body, setBody] = useState(""); const [saving, setSaving] = useState(false); const [message, setMessage] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setMessage(""); const response = await fetch("/api/portal/comentarios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context: "general", category, body }) }); const result = await response.json() as { error?: string }; setMessage(response.ok ? "Tu comentario fue enviado." : result.error ?? "No se pudo enviar."); if (response.ok) setBody(""); setSaving(false); }
  const roots = data.comments.filter((item) => !item.parentId);
  return <PageHeader title="Comentarios" subtitle="Consultas y devoluciones para tu entrenador"><form onSubmit={submit} className="rounded-2xl border border-yellow-400/20 bg-zinc-900 p-4"><select value={category} onChange={(event) => setCategory(event.target.value)} className={portalInput}><option value="consulta">Consulta</option><option value="dificultad">Dificultad</option><option value="dolor">Dolor o molestia</option><option value="devolucion">Devolución</option></select><textarea required value={body} onChange={(event) => setBody(event.target.value)} placeholder="Escribí tu mensaje…" rows={4} className={`${portalInput} mt-3`} /><button disabled={saving} className="mt-3 w-full rounded-xl bg-yellow-400 p-3 font-bold text-zinc-950">Enviar comentario</button>{message && <p className="mt-3 text-sm text-[var(--brand-text)]">{message}</p>}</form><div className="mt-5 space-y-3">{roots.map((item) => <article key={item.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><div className="flex justify-between"><span className="text-xs capitalize text-[var(--foreground-muted)]">{item.category} · {item.contextLabel}</span><span className={`rounded-full px-2 py-1 text-[11px] ${item.status === "pendiente" ? "bg-yellow-400/10 text-[var(--brand-text)]" : "bg-emerald-400/10 text-emerald-300"}`}>{item.status}</span></div><p className="mt-3 text-sm">{item.body}</p>{data.comments.filter((reply) => reply.parentId === item.id).map((reply) => <p key={reply.id} className="mt-3 rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-200"><strong>Entrenador:</strong> {reply.body}</p>)}</article>)}</div></PageHeader>;
}

const portalInput = "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-white outline-none focus:border-yellow-400";
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="text-xs text-[var(--foreground-muted)]">{label}{children}</label>; }

function ExpandablePasswordCard() {
  const [expanded, setExpanded] = useState(false);
  const contentId = "portal-change-password-content";
  return <section className="mt-4 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={contentId}
      onClick={() => setExpanded((value) => !value)}
      className="flex min-h-16 w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-white/[.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-yellow-300 sm:px-5"
    >
      <span className="min-w-0">
        <span className="block font-semibold text-[var(--brand-text)]">Cambiar contraseña</span>
        <span className="mt-1 block text-sm text-[var(--foreground-muted)]">Actualizá la contraseña de acceso a tu cuenta.</span>
      </span>
      <span aria-hidden="true" className={`shrink-0 text-xl text-[var(--foreground-muted)] transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}><BmChevronRightIcon size={16} className="inline" /></span>
    </button>
    <div
      id={contentId}
      aria-hidden={!expanded}
      inert={!expanded}
      // Keep the form mounted so collapsing it never clears what the student typed.
      className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${expanded ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0"}`}
    >
      <div className="overflow-hidden">
        <ChangePasswordCard embedded />
      </div>
    </div>
  </section>;
}

export function ChangePasswordCard({ forced = false, embedded = false, onSuccess }: { forced?: boolean; embedded?: boolean; onSuccess?: () => void }) {
  type PasswordErrors = { current?: string; next?: string; confirm?: string };
  const [currentPassword, setCurrentPassword] = useState(""); const [newPassword, setNewPassword] = useState(""); const [confirmPassword, setConfirmPassword] = useState(""); const [error, setError] = useState(""); const [success, setSuccess] = useState(""); const [saving, setSaving] = useState(false); const [fieldErrors, setFieldErrors] = useState<PasswordErrors>({});
  const currentRef = useRef<HTMLInputElement>(null); const newRef = useRef<HTMLInputElement>(null); const confirmRef = useRef<HTMLInputElement>(null);
  function validate() {
    const nextErrors: PasswordErrors = {};
    const passwordError = invitationPasswordValidationError(newPassword);
    if (!currentPassword) nextErrors.current = "Ingresá tu contraseña actual.";
    if (!newPassword) nextErrors.next = "Ingresá una contraseña nueva.";
    else if (passwordError) nextErrors.next = passwordError;
    if (!confirmPassword) nextErrors.confirm = "Repetí la contraseña nueva.";
    else if (newPassword !== confirmPassword) nextErrors.confirm = "Las contraseñas nuevas no coinciden.";
    setFieldErrors(nextErrors);
    if (nextErrors.current) currentRef.current?.focus(); else if (nextErrors.next) newRef.current?.focus(); else if (nextErrors.confirm) confirmRef.current?.focus();
    return Object.keys(nextErrors).length === 0;
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || !validate()) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/portal/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) {
        const message = body.error ?? "No se pudo cambiar la contraseña.";
        if (message.toLocaleLowerCase("es").includes("actual")) { setFieldErrors({ current: message }); currentRef.current?.focus(); }
        else { setFieldErrors({ next: message }); newRef.current?.focus(); }
        return;
      }
      setSuccess("Contraseña actualizada correctamente."); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setFieldErrors({}); onSuccess?.();
    } catch {
      setError("No pudimos guardar el cambio. Revisá tu conexión e intentá nuevamente.");
    } finally { setSaving(false); }
  }
  return <section className={embedded ? "border-t border-zinc-800 px-4 pb-4 pt-3 sm:px-5 sm:pb-5" : `mt-6 rounded-2xl border p-5 ${forced ? "border-yellow-400/40 bg-yellow-400/5" : "border-zinc-800 bg-zinc-900"}`}><h2 className={embedded ? "sr-only" : "font-semibold text-[var(--brand-text)]"}>{forced ? "Creá tu contraseña personal" : "Cambiar contraseña"}</h2><p className="mt-1 text-sm text-[var(--foreground-muted)]">{forced ? "La contraseña temporal debe reemplazarse antes de acceder a tus datos." : "Debe incluir mayúscula, minúscula, número y al menos 10 caracteres."}</p>{error && <p role="alert" className="mt-4 rounded-lg bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}{success && <p role="status" className="mt-4 rounded-lg bg-emerald-400/10 p-3 text-sm text-emerald-300">{success}</p>}<form noValidate onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-3"><PasswordField ref={currentRef} id="current-password" label="Contraseña actual" required autoComplete="current-password" value={currentPassword} error={fieldErrors.current} onChange={(event) => { setCurrentPassword(event.target.value); setError(""); if (fieldErrors.current) setFieldErrors((value) => ({ ...value, current: undefined })); }} /><PasswordField ref={newRef} id="new-password" label="Nueva contraseña" required aria-describedby="change-password-checklist" autoComplete="new-password" value={newPassword} error={fieldErrors.next} onChange={(event) => { const value = event.target.value; setNewPassword(value); setError(""); setFieldErrors((errors) => ({ ...errors, next: undefined, confirm: confirmPassword && value === confirmPassword ? undefined : errors.confirm })); }} /><PasswordField ref={confirmRef} id="confirm-password" label="Repetir contraseña" required autoComplete="new-password" value={confirmPassword} error={fieldErrors.confirm} onChange={(event) => { setConfirmPassword(event.target.value); setError(""); if (fieldErrors.confirm) setFieldErrors((value) => ({ ...value, confirm: undefined })); }} /><ul id="change-password-checklist" aria-label="Requisitos de contraseña" className="flex flex-col gap-1 text-xs leading-relaxed sm:col-span-3">{invitationPasswordRequirements(newPassword).map((requirement) => <li key={requirement.id} className={`${requirement.id === "lower" ? "order-last " : ""}${requirement.met ? "text-[var(--success)]" : "text-[var(--foreground-muted)]"}`}><span aria-hidden="true">{requirement.met ? "✓" : "○"}</span> <span className="sr-only">{requirement.met ? "Cumplido: " : "Pendiente: "}</span>{requirement.label}</li>)}</ul><button type="submit" disabled={saving} aria-busy={saving} className="rounded-xl bg-yellow-400 px-4 py-3 font-bold text-zinc-950 disabled:cursor-wait disabled:opacity-60 sm:col-span-3">{saving ? "Guardando…" : "Guardar contraseña"}</button></form></section>;
}

function PortalLogoutCard() {
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    try {
      if (await logoutOfflineTraining()) window.location.assign("/portal/login");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-4 flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div>
        <h2 className="font-semibold">Sesión</h2>
        <p className="mt-1 text-sm text-[var(--foreground-muted)]">
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

function PageHeader({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) { return <><header className="mb-6"><h1 className="text-2xl font-bold">{title}</h1><p className="mt-1 text-sm text-[var(--foreground-muted)]">{subtitle}</p></header>{children}</>; }
function SmallMetric({ title, value }: { title: string; value: string }) { return <div className="rounded-lg bg-zinc-950 p-2"><p className="text-[11px] text-[var(--foreground-muted)]">{title}</p><p className="mt-1 font-semibold">{value}</p></div>; }
function Notice({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "error" }) { return <section className={`rounded-2xl border p-5 text-sm ${tone === "error" ? "border-red-400/30 bg-red-400/10 text-red-200" : "border-zinc-800 bg-zinc-900 text-[var(--foreground-muted)]"}`}>{children}</section>; }
function PortalLoading() { return <div className="animate-pulse space-y-4"><div className="h-8 w-48 rounded bg-zinc-800" /><div className="h-4 w-72 rounded bg-zinc-900" /><div className="grid gap-4 sm:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-32 rounded-2xl bg-zinc-900" />)}</div><div className="h-64 rounded-2xl bg-zinc-900" /></div>; }
