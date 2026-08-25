"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PortalClassOccurrence } from "@/types/classes";
import type { PortalClassAgendaSummary } from "@/lib/portal-class-schedule";
import { PortalActionCard } from "@/componentes/portal-action-card";
import { QuickNoteButton } from "@/componentes/quick-log";
import { BmCalendarIcon, BmCheckIcon, BmChevronRightIcon, BmCloseIcon, BmHistoryIcon, BmTimerIcon, BmUserIcon } from "@/componentes/icons";

type ClassData = {
  occurrences: PortalClassOccurrence[];
  scheduleLabels: string[];
  flexibleSchedule: string;
  availability: {
    eligible: boolean;
    reason: "ACTIVE" | "INACTIVE" | "SUSPENDED";
    message: string | null;
  };
  focus: {
    date: string | null;
    title: string;
    subtitle: string;
    occurrenceIds: string[];
    refreshAfterMs: number | null;
  };
  upcoming: {
    from: string;
    to: string;
    occurrenceIds: string[];
  };
  summary: PortalClassAgendaSummary<PortalClassOccurrence>;
};

const noClassesMessage = "No hay clases disponibles durante los próximos 7 días.";

const dateLabel = (value: string) =>
  new Date(`${value}T12:00:00Z`).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

const capitalize = (value: string) => value.charAt(0).toLocaleUpperCase("es") + value.slice(1);

function disciplineLabel(value: string, fallbackLabel = value) {
  return fallbackLabel.trim() || value.trim() || "Clase";
}

function focusDateHeading(data: ClassData) {
  if (!data.focus.date) return "Clases de hoy";
  const label = capitalize(dateLabel(data.focus.date));
  if (data.focus.title.toLocaleLowerCase("es").includes("mañana")) return `Mañana · ${label}`;
  if (data.focus.title.toLocaleLowerCase("es").includes("hoy")) return `Hoy · ${label}`;
  return label;
}

function focusSectionLabel(data: ClassData) {
  return data.focus.title === "Clases de hoy" ? "Clases de hoy" : "Próximas clases";
}

function weeklyScheduleDisplay(label: string) {
  const [timePart = label, disciplinePart = "Clase"] = label.split(" · ");
  const match = /^(\S+)\s+(\d{2}:\d{2})[–-](\d{2}:\d{2})$/.exec(timePart.trim());
  const discipline = disciplineLabel(disciplinePart);
  return {
    day: match?.[1] ?? "Horario",
    time: match ? `${match[2]}–${match[3]}` : timePart,
    discipline,
  };
}

export function PortalClasses({ compact = false, showQuickLogAction = false }: { compact?: boolean; showQuickLogAction?: boolean }) {
  const [data, setData] = useState<ClassData | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [confirmedId, setConfirmedId] = useState("");
  const responseInFlight = useRef(false);
  const confirmationTimer = useRef<number | null>(null);
  const [showWeek, setShowWeek] = useState(false);
  const endpoint = compact ? "/api/portal/clases?summary=1" : "/api/portal/clases";

  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(endpoint, { cache: "no-store", signal });
    const body = (await response.json()) as ClassData & { error?: string };
    if (response.status === 401) {
      window.location.href = "/portal/login";
      return;
    }
    if (!response.ok)
      throw new Error(body.error ?? "No se pudieron cargar las clases.");
    setData(body);
    setError("");
  }, [endpoint]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void load(controller.signal).catch((value: unknown) => {
        if (value instanceof Error && value.name !== "AbortError") setError(value.message);
      });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  useEffect(() => {
    const refresh = () => { void load().catch((value: unknown) => setError(value instanceof Error ? value.message : "No se pudieron cargar las clases.")); };
    const visibilityRefresh = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visibilityRefresh);
    const delay = data?.focus.refreshAfterMs;
    const timer = typeof delay === "number" ? window.setTimeout(refresh, delay) : null;
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visibilityRefresh);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [data?.focus.refreshAfterMs, load]);

  useEffect(() => () => {
    if (confirmationTimer.current !== null) window.clearTimeout(confirmationTimer.current);
  }, []);

  async function respond(
    item: PortalClassOccurrence,
    value: "GOING" | "NOT_GOING",
  ) {
    if (responseInFlight.current) return;
    responseInFlight.current = true;
    setSavingId(item.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/portal/clases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occurrenceId: item.id, response: value }),
      });
      const body = (await response.json()) as {
        error?: string;
        message?: string;
      };
      if (!response.ok)
        throw new Error(body.error ?? "No se pudo guardar.");
      setNotice(body.message ?? "Respuesta guardada.");
      await load();
      if (value === "GOING") {
        setConfirmedId(item.id);
        if (confirmationTimer.current !== null) window.clearTimeout(confirmationTimer.current);
        confirmationTimer.current = window.setTimeout(() => setConfirmedId(""), 600);
      }
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "No se pudo guardar.",
      );
    } finally {
      responseInFlight.current = false;
      setSavingId("");
    }
  }

  const focusItems = useMemo(() => {
    const ids = new Set(data?.focus.occurrenceIds ?? []);
    return (data?.occurrences ?? []).filter((item) => ids.has(item.id)).sort((left, right) => left.startTime.localeCompare(right.startTime));
  }, [data]);
  const upcomingItems = useMemo(() => {
    const ids = new Set(data?.upcoming.occurrenceIds ?? []);
    return (data?.occurrences ?? []).filter((item) => ids.has(item.id));
  }, [data]);
  const grouped = useMemo(() => {
    const map = new Map<string, PortalClassOccurrence[]>();
    const visible = showWeek ? upcomingItems : focusItems;
    for (const item of visible)
      map.set(item.date, [...(map.get(item.date) ?? []), item]);
    return [...map.entries()];
  }, [focusItems, showWeek, upcomingItems]);
  const weeklySchedules = useMemo(() => {
    const map = new Map<string, Array<ReturnType<typeof weeklyScheduleDisplay>>>();
    for (const label of data?.scheduleLabels ?? []) {
      const item = weeklyScheduleDisplay(label);
      map.set(item.day, [...(map.get(item.day) ?? []), item]);
    }
    return [...map.entries()];
  }, [data?.scheduleLabels]);
  const nextClass = useMemo(() => {
    return [...upcomingItems].sort((left, right) => `${left.date} ${left.startTime}`.localeCompare(`${right.date} ${right.startTime}`))[0] ?? null;
  }, [upcomingItems]);

  if (!data) {
    if (!error) return <div className="h-44 animate-pulse rounded-2xl bg-zinc-900" />;
    return (
      <section className="rounded-2xl border border-red-400/20 bg-red-400/10 p-5">
        <p role="alert" className="text-sm text-red-200">{error}</p>
        <button type="button" onClick={() => void load().catch((value: unknown) => setError(value instanceof Error ? value.message : "No se pudieron cargar las clases."))} className="mt-3 min-h-11 rounded-xl bg-red-200 px-4 text-xs font-black text-zinc-950">Reintentar</button>
      </section>
    );
  }

  if (compact)
    return (
      <section className="h-full overflow-hidden rounded-[22px] border border-white/[.07] bg-[linear-gradient(145deg,#151515,#090909)] p-3.5 shadow-[0_14px_35px_rgba(0,0,0,.28)] sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-yellow-400">
              <BmCalendarIcon size={14} />{data.summary.mode === "TODAY" ? "Clases de hoy" : data.summary.mode === "NEXT_DAY" ? "Próximo día" : "Agenda de clases"}
            </p>
            <h2 className="mt-1.5 text-lg font-black leading-tight text-zinc-50">
              {data.summary.total
                ? `${data.summary.total} ${data.summary.total === 1 ? "clase disponible" : "clases disponibles"}`
                : "Sin próximas clases"}
            </h2>
          </div>
          <div className="shrink-0 text-right">
            {data.summary.dateLabel && <span className="block max-w-32 text-[10px] font-medium leading-tight text-zinc-500">{data.summary.dateLabel}</span>}
            <Link href="/portal/clases" className="mt-2 inline-flex min-h-7 items-center text-[10px] font-black text-yellow-300 transition hover:text-yellow-200">Ver agenda completa ›</Link>
          </div>
        </div>
        {data.summary.total ? (
          <>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-zinc-500">
              {data.summary.firstStartTime && data.summary.lastStartTime && (
                <span className="tabular-nums">◷ {data.summary.firstStartTime}–{data.summary.lastStartTime}</span>
              )}
              <span>· {data.summary.mode === "TODAY" ? "Elegí tu horario." : "Tu próximo día con actividad."}</span>
            </div>
            <div className="mt-3 space-y-2">
              {data.summary.preview.map((item, index) => (
                <CompactClassRow
                  key={item.id}
                  item={item}
                  saving={savingId === item.id}
                  confirmed={confirmedId === item.id}
                  index={index}
                  respond={respond}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-zinc-800 bg-black/25 p-3.5">
            <p className="text-xs leading-relaxed text-zinc-400">
              {data.availability.message ?? noClassesMessage}
            </p>
            <Link href="/portal/clases" className="mt-2.5 inline-flex text-xs font-black text-yellow-300">Ver todos los horarios →</Link>
          </div>
        )}
        <Feedback error={error} notice={notice} />
      </section>
    );

  return (
    <div className="mx-auto w-full max-w-5xl pb-4">
      <header className="flex items-start justify-between gap-3 px-1">
        <div className="min-w-0"><p className="text-[11px] font-black uppercase tracking-[.22em] text-yellow-400">Agenda presencial</p>
        <h1 className="mt-1.5 text-2xl font-black leading-tight tracking-[-.03em] text-zinc-50 sm:text-4xl">Tus próximas clases</h1>
        <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-zinc-400 sm:text-base">Consultá tus horarios y confirmá tu asistencia.</p></div>
        {showQuickLogAction && <QuickNoteButton placement="inline" />}
      </header>

      <section className="portal-home-class-row mt-5 flex min-h-24 items-center gap-3 rounded-[22px] border border-yellow-400/25 bg-[radial-gradient(circle_at_88%_12%,rgba(250,204,21,.12),transparent_34%),linear-gradient(145deg,#171717,#090909)] p-4 shadow-[0_16px_45px_rgba(0,0,0,.28)] sm:p-5">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-yellow-400/30 bg-yellow-400/[.07] text-yellow-300"><BmCalendarIcon size={24} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-yellow-400">PRÓXIMA CLASE</p>
          {nextClass ? <><p className="mt-1 text-xs font-semibold capitalize text-zinc-400">{dateLabel(nextClass.date)}</p><div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1"><strong className="text-sm tabular-nums text-yellow-300 sm:text-base">{nextClass.startTime}–{nextClass.endTime}</strong><span className="min-w-0 truncate text-base font-black text-zinc-50 sm:text-lg">{disciplineLabel(`${nextClass.name} ${nextClass.category}`, nextClass.name || nextClass.category)}</span></div></> : <><p className="mt-1 text-base font-black text-zinc-100">Sin próximas clases</p><p className="mt-1 text-xs text-zinc-500">{data.availability.message ?? noClassesMessage}</p></>}
        </div>
        <BmChevronRightIcon size={20} className="shrink-0 text-yellow-300" />
      </section>

      <nav aria-label="Vista de clases" className="portal-home-class-row mt-4 grid grid-cols-2 overflow-hidden rounded-2xl border border-white/[.1] bg-zinc-950/80 shadow-[inset_0_1px_rgba(255,255,255,.03)]" style={{ animationDelay: "65ms" }}>
        <button
          type="button"
          aria-pressed={!showWeek}
          onClick={() => setShowWeek(false)}
          className={`min-h-12 border-b-2 px-2 py-3 text-xs font-black transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-yellow-300 sm:text-sm ${!showWeek ? "border-yellow-400 text-yellow-300" : "border-transparent text-zinc-400 hover:text-zinc-100"}`}
        >
          <span className="inline-flex items-center justify-center gap-2"><BmCalendarIcon size={16} />Clases de hoy</span>
        </button>
        <button
          type="button"
          aria-pressed={showWeek}
          onClick={() => setShowWeek(true)}
          className={`min-h-12 border-b-2 border-l border-l-white/[.05] px-2 py-3 text-xs font-black transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-yellow-300 sm:text-sm ${showWeek ? "border-b-yellow-400 text-yellow-300" : "border-b-transparent text-zinc-400 hover:text-zinc-100"}`}
        >
          <span className="inline-flex items-center justify-center gap-2"><BmCalendarIcon size={16} />Próximos 7 días</span>
        </button>
      </nav>

      <Feedback error={error} notice={notice} />

      {grouped.length === 0 ? (
        <section className="mt-4 overflow-hidden rounded-2xl border border-white/[.07] bg-[radial-gradient(circle_at_top_right,rgba(250,204,21,.08),transparent_36%),linear-gradient(145deg,#181818,#0b0b0b)] p-4 text-center shadow-[0_16px_45px_rgba(0,0,0,.25)]">
          <span className="mx-auto grid size-10 place-items-center rounded-xl border border-yellow-400/20 bg-yellow-400/[.07] text-yellow-300"><BmCalendarIcon size={20} /></span>
          <h2 className="mt-3 text-base font-black text-zinc-100">Sin clases próximas</h2>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-zinc-400">
            {data.availability.message ?? noClassesMessage}
          </p>
        </section>
      ) : showWeek ? (
        <section className="portal-home-class-row mt-4 overflow-hidden rounded-2xl border border-white/[.08] bg-[linear-gradient(145deg,#171717,#0b0b0b)] shadow-[0_16px_45px_rgba(0,0,0,.25)] sm:rounded-3xl" style={{ animationDelay: "130ms" }}>
          <div className="flex items-center gap-2.5 border-b border-white/[.07] px-3 py-3 sm:gap-3 sm:px-5 sm:py-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-yellow-400/20 bg-yellow-400/[.08] text-yellow-300 sm:size-10"><BmCalendarIcon size={20} /></span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-yellow-400">Agenda completa</p>
              <h2 className="mt-0.5 text-base font-black text-zinc-100 sm:text-lg">Próximos 7 días</h2>
            </div>
          </div>
          <div className="px-3 sm:px-5">
            {grouped.map(([date, items]) => (
              <section key={date} className="border-b border-white/[.07] py-3 last:border-0 sm:py-4">
                <h3 className="mb-1.5 text-xs font-black capitalize text-zinc-300 sm:text-sm">{dateLabel(date)}</h3>
                <div>
                  {items.map((item) => <ClassRow key={item.id} item={item} saving={savingId === item.id} respond={respond} />)}
                </div>
              </section>
            ))}
          </div>
        </section>
      ) : (
        <section id="clases-del-dia" className="portal-home-class-row mt-4 overflow-hidden rounded-2xl border border-yellow-400/25 bg-[radial-gradient(circle_at_top_right,rgba(250,204,21,.13),transparent_34%),linear-gradient(145deg,#191919,#0a0a0a)] shadow-[0_18px_50px_rgba(0,0,0,.28)] sm:rounded-3xl" style={{ animationDelay: "130ms" }}>
          <div className="flex items-center justify-between gap-2.5 border-b border-white/[.07] px-3 py-3 sm:gap-3 sm:px-6 sm:py-4">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-yellow-400/25 bg-yellow-400/[.09] text-yellow-300 sm:size-11 sm:rounded-2xl"><BmCalendarIcon size={20} /></span>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-yellow-400">{focusSectionLabel(data)}</p>
                <h2 className="mt-0.5 truncate text-sm font-black text-zinc-100 sm:mt-1 sm:text-lg">{focusDateHeading(data)}</h2>
              </div>
            </div>
            <span className="shrink-0 rounded-full border border-yellow-400/20 bg-yellow-400/[.08] px-2.5 py-1 text-[10px] font-black text-yellow-300">
              {focusItems.length} {focusItems.length === 1 ? "clase" : "clases"}
            </span>
          </div>
          <div className="px-3 sm:px-5">
            {focusItems.map((item) => <ClassRow key={item.id} item={item} saving={savingId === item.id} respond={respond} />)}
          </div>
        </section>
      )}

      <details className="portal-home-class-row group mt-4 overflow-hidden rounded-2xl border border-white/[.08] bg-[#151517] transition hover:border-yellow-400/25 sm:mt-5" style={{ animationDelay: "195ms" }}>
        <summary aria-label="Ver mis horarios semanales" className="flex min-h-20 cursor-pointer list-none items-center justify-between gap-3 p-3.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-yellow-300">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-yellow-400/25 bg-yellow-400/[.07] text-yellow-300"><BmCalendarIcon size={21} /></span><div className="min-w-0 flex-1">
            <h2 className="font-black text-zinc-100">Mis horarios semanales</h2>
            <p className="mt-0.5 text-[11px] text-zinc-400 sm:mt-1 sm:text-xs">{data.scheduleLabels.length} {data.scheduleLabels.length === 1 ? "horario vigente" : "horarios vigentes"}</p>
          </div>
          <span className="flex shrink-0 items-center gap-1 text-[11px] font-black text-yellow-300 sm:gap-2 sm:text-xs">Ver semana <BmChevronRightIcon size={16} className="transition group-open:rotate-90" /></span>
        </summary>
        <div className="border-t border-white/[.07] px-3 py-1 sm:px-6 sm:py-2">
          {weeklySchedules.length ? (
            <ul>
              {weeklySchedules.map(([day, schedules]) => (
                <li key={day} className="grid grid-cols-[minmax(4.5rem,.7fr)_minmax(0,1.5fr)_auto] items-center gap-2.5 border-b border-white/[.06] py-3 last:border-0 sm:grid-cols-[minmax(5.25rem,.7fr)_minmax(0,1.5fr)_auto] sm:gap-3 sm:py-4">
                  <strong className="text-sm text-zinc-200">{day}</strong>
                  <div className="min-w-0 space-y-2">
                    {schedules.map((schedule, index) => (
                      <div key={`${schedule.time}-${schedule.discipline}-${index}`} className="flex min-w-0 items-center gap-2 text-sm text-zinc-400">
                        <span className="font-bold tabular-nums text-zinc-200">{schedule.time}</span>
                        <span className="truncate">{schedule.discipline}</span>
                      </div>
                    ))}
                  </div>
                  <span aria-hidden="true" className="text-lg text-zinc-600">›</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-5 text-sm text-zinc-500">No tenés horarios semanales asignados.</p>
          )}
          {data.flexibleSchedule && <p className="border-t border-white/[.06] py-4 text-sm text-zinc-400">Horario habitual: {data.flexibleSchedule}</p>}
        </div>
      </details>

      <div className="portal-home-class-row mt-4 sm:mt-5" style={{ animationDelay: "260ms" }}><PortalActionCard href="/portal/registro" ariaLabel="Ver mis registros" title="Mis registros" subtitle="Ejercicios, cargas y marcas" icon={<BmHistoryIcon size={20} />} /></div>
    </div>
  );
}

function CompactClassRow({
  item,
  saving,
  confirmed,
  index,
  respond,
}: {
  item: PortalClassOccurrence;
  saving: boolean;
  confirmed: boolean;
  index: number;
  respond: (
    item: PortalClassOccurrence,
    value: "GOING" | "NOT_GOING",
  ) => void;
}) {
  const discipline = disciplineLabel(`${item.name} ${item.category}`, item.name || item.category);
  const responseLabel = item.response === "GOING" ? "Confirmada" : item.response === "NOT_GOING" ? "No asistirás" : item.statusLabel;
  return (
    <article className={`portal-home-class-row grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-white/[.065] bg-black/35 p-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] ${confirmed ? "portal-home-confirmed" : ""}`} style={{ animationDelay: `${index * 75}ms` }}>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-black tabular-nums text-zinc-100">{item.startTime}–{item.endTime}</p>
        <p className="mt-0.5 truncate text-[10px] text-zinc-500">{discipline}</p>
      </div>
      <span className={`hidden shrink-0 text-[9px] font-bold sm:inline ${item.response === "GOING" ? "text-emerald-400" : "text-zinc-500"}`}>{item.response === "GOING" ? "✓ " : ""}{responseLabel}</span>
      {item.canRespond ? <button type="button" disabled={saving} onClick={() => respond(item, "GOING")} className={`portal-home-interactive min-h-9 shrink-0 rounded-lg border px-2.5 text-[10px] font-bold transition disabled:opacity-50 ${item.response === "GOING" ? "border-yellow-400/35 bg-yellow-400/[.055] text-yellow-200" : "border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-yellow-400/25"}`}>{item.response === "GOING" ? "✓ Asistiré" : "Asistiré"}</button> : <span className={`shrink-0 text-[9px] font-bold sm:hidden ${item.response === "GOING" ? "text-emerald-400" : "text-zinc-500"}`}>{responseLabel}</span>}
    </article>
  );
}

function ClassRow({
  item,
  saving,
  respond,
}: {
  item: PortalClassOccurrence;
  saving: boolean;
  respond: (
    item: PortalClassOccurrence,
    value: "GOING" | "NOT_GOING",
  ) => void;
}) {
  const discipline = disciplineLabel(`${item.name} ${item.category}`, item.name || item.category);
  const responseLabel = item.response === "GOING" ? "Confirmada" : item.response === "NOT_GOING" ? "No asistirás" : item.statusLabel;
  const confirmedLabel = `${item.confirmedCount} ${item.confirmedCount === 1 ? "confirmado" : "confirmados"}`;
  return (
    <article className="min-w-0 border-b border-white/[.075] py-4 last:border-0 sm:py-5">
      <div className="grid min-w-0 grid-cols-[minmax(6.8rem,.8fr)_minmax(0,1.4fr)] items-center gap-3 sm:gap-5">
        <p className="flex items-center gap-2 border-r border-white/[.1] pr-3 text-xs font-black tabular-nums text-yellow-300 sm:text-sm"><BmTimerIcon size={19} className="shrink-0" />{item.startTime}–{item.endTime}</p>
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-black text-zinc-100 sm:text-base">{discipline}</h3>
          <p className={`mt-1 flex items-center gap-1.5 text-[11px] font-semibold ${item.response === "GOING" ? "text-emerald-400" : "text-zinc-400"}`}>{item.response === "GOING" && <BmCheckIcon size={13} />}{responseLabel}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[10px] text-zinc-500 sm:text-[11px]"><BmUserIcon size={13} />{confirmedLabel}{item.capacity === null ? "" : ` · cupo ${item.capacity}`}</p>
        </div>
      </div>
      {item.canRespond && <ResponseButtons item={item} saving={saving} respond={respond} />}
    </article>
  );
}

function Feedback({ error, notice }: { error: string; notice: string }) {
  if (!error && !notice) return null;
  return (
    <p
      className={`mt-4 rounded-xl p-3 text-sm ${error ? "bg-red-400/10 text-red-200" : "bg-emerald-400/10 text-emerald-200"}`}
    >
      {error || notice}
    </p>
  );
}

function ResponseButtons({
  item,
  saving,
  respond,
  compact = false,
}: {
  item: PortalClassOccurrence;
  saving: boolean;
  respond: (
    item: PortalClassOccurrence,
    value: "GOING" | "NOT_GOING",
  ) => void;
  compact?: boolean;
}) {
  return (
    <div className={`${compact ? "col-span-2 grid-cols-2 min-[420px]:col-span-1 min-[420px]:grid-cols-1" : "mt-3 grid-cols-2 sm:mt-4"} grid gap-2`}>
      <button
        type="button"
        disabled={saving}
        onClick={() => respond(item, "GOING")}
        className={`${compact ? "min-h-10 rounded-lg px-2 py-1 text-[10px]" : "min-h-12 rounded-xl px-3 py-2 text-xs"} inline-flex items-center justify-center gap-2 border font-black transition active:scale-[.98] disabled:opacity-50 ${item.response === "GOING" ? "border-yellow-300 bg-gradient-to-r from-amber-400 to-yellow-300 text-zinc-950 shadow-[0_8px_25px_rgba(250,204,21,.14)]" : "border-zinc-700 bg-zinc-950/70 text-zinc-200 hover:border-yellow-400/25 hover:bg-white/[.03]"}`}
      >
        <BmCheckIcon size={17} /> Asistiré
      </button>
      <button
        type="button"
        disabled={saving}
        onClick={() => respond(item, "NOT_GOING")}
        className={`${compact ? "min-h-10 rounded-lg px-2 py-1 text-[10px]" : "min-h-12 rounded-xl px-3 py-2 text-xs"} inline-flex items-center justify-center gap-2 border font-bold transition active:scale-[.98] disabled:opacity-50 ${item.response === "NOT_GOING" ? "border-red-400/50 bg-red-400/[.08] text-red-200" : "border-zinc-700 bg-zinc-950/50 text-zinc-300 hover:border-zinc-500"}`}
      >
        <BmCloseIcon size={17} /> No asistiré
      </button>
    </div>
  );
}
