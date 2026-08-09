"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PortalClassOccurrence } from "@/types/classes";
import type { PortalClassAgendaSummary } from "@/lib/portal-class-schedule";

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

function disciplinePresentation(value: string, fallbackLabel = value) {
  const normalized = value.toLocaleLowerCase("es");
  if (normalized.includes("gap")) return { icon: "🍑", label: "GAP", accent: "border-l-pink-400" };
  if (normalized.includes("kids") || normalized.includes("niñ")) return { icon: "🧒", label: "Kids", accent: "border-l-sky-400" };
  if (normalized.includes("funcional")) return { icon: "💪🏽", label: "Funcional", accent: "border-l-yellow-400" };
  return { icon: "◆", label: fallbackLabel || "Clase", accent: "border-l-zinc-500" };
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
  const discipline = disciplinePresentation(disciplinePart);
  return {
    day: match?.[1] ?? "Horario",
    time: match ? `${match[2]}–${match[3]}` : timePart,
    discipline,
  };
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none">
      <path d="M7 3v3m10-3v3M4.5 9h15M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function PortalClasses({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<ClassData | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");
  const responseInFlight = useRef(false);
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
              <span aria-hidden="true">▣</span>{data.summary.mode === "TODAY" ? "Clases de hoy" : data.summary.mode === "NEXT_DAY" ? "Próximo día" : "Agenda de clases"}
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
              {data.summary.preview.map((item) => (
                <CompactClassRow
                  key={item.id}
                  item={item}
                  saving={savingId === item.id}
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
      <header className="px-1">
        <p className="text-[11px] font-black uppercase tracking-[.22em] text-yellow-400">Agenda presencial</p>
        <h1 className="mt-1.5 text-2xl font-black leading-tight tracking-[-.03em] text-zinc-50 sm:text-4xl">Tus próximas clases</h1>
        <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-zinc-400 sm:text-base">Consultá tus horarios y confirmá tu asistencia.</p>
      </header>

      <nav aria-label="Vista de clases" className="mt-4 grid grid-cols-2 gap-1 rounded-xl border border-white/[.07] bg-zinc-950/80 p-1 shadow-[inset_0_1px_rgba(255,255,255,.03)]">
        <button
          type="button"
          aria-pressed={!showWeek}
          onClick={() => setShowWeek(false)}
          className={`min-h-10 rounded-lg px-2 py-2 text-xs font-black transition focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 sm:text-sm ${!showWeek ? "bg-yellow-400 text-zinc-950 shadow-[0_8px_24px_rgba(250,204,21,.16)]" : "border border-transparent text-zinc-400 hover:text-zinc-100"}`}
        >
          Clases de hoy
        </button>
        <button
          type="button"
          aria-pressed={showWeek}
          onClick={() => setShowWeek(true)}
          className={`min-h-10 rounded-lg px-2 py-2 text-xs font-black transition focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 sm:text-sm ${showWeek ? "bg-yellow-400 text-zinc-950 shadow-[0_8px_24px_rgba(250,204,21,.16)]" : "border border-transparent text-zinc-400 hover:text-zinc-100"}`}
        >
          Próximos 7 días
        </button>
      </nav>

      <Feedback error={error} notice={notice} />

      {grouped.length === 0 ? (
        <section className="mt-4 overflow-hidden rounded-2xl border border-white/[.07] bg-[radial-gradient(circle_at_top_right,rgba(250,204,21,.08),transparent_36%),linear-gradient(145deg,#181818,#0b0b0b)] p-4 text-center shadow-[0_16px_45px_rgba(0,0,0,.25)]">
          <span className="mx-auto grid size-10 place-items-center rounded-xl border border-yellow-400/20 bg-yellow-400/[.07] text-yellow-300"><CalendarIcon /></span>
          <h2 className="mt-3 text-base font-black text-zinc-100">Sin clases próximas</h2>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-zinc-400">
            {data.availability.message ?? noClassesMessage}
          </p>
        </section>
      ) : showWeek ? (
        <section className="mt-4 rounded-2xl border border-white/[.07] bg-[linear-gradient(145deg,#171717,#0b0b0b)] p-3 shadow-[0_16px_45px_rgba(0,0,0,.25)] sm:rounded-3xl sm:p-6">
          <div className="flex items-center gap-2.5 border-b border-white/[.07] pb-3 sm:gap-3 sm:pb-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-yellow-400/20 bg-yellow-400/[.08] text-yellow-300 sm:size-10"><CalendarIcon /></span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-yellow-400">Agenda completa</p>
              <h2 className="mt-0.5 text-base font-black text-zinc-100 sm:text-lg">Próximos 7 días</h2>
            </div>
          </div>
          <div className="mt-3 space-y-4 sm:mt-5 sm:space-y-6">
            {grouped.map(([date, items]) => (
              <section key={date}>
                <h3 className="mb-2 text-xs font-black capitalize text-zinc-200 sm:mb-3 sm:text-sm">{dateLabel(date)}</h3>
                <div className="grid gap-2.5 sm:gap-3 md:grid-cols-2">
                  {items.map((item) => <ClassCard key={item.id} item={item} saving={savingId === item.id} respond={respond} />)}
                </div>
              </section>
            ))}
          </div>
        </section>
      ) : (
        <section id="clases-del-dia" className="mt-4 overflow-hidden rounded-2xl border border-yellow-400/15 bg-[radial-gradient(circle_at_top_right,rgba(250,204,21,.11),transparent_34%),linear-gradient(145deg,#191919,#0a0a0a)] shadow-[0_18px_50px_rgba(0,0,0,.28)] sm:rounded-3xl">
          <div className="flex items-center justify-between gap-2.5 border-b border-white/[.07] px-3 py-3 sm:gap-3 sm:px-6 sm:py-4">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-yellow-400/25 bg-yellow-400/[.09] text-yellow-300 sm:size-11 sm:rounded-2xl"><CalendarIcon /></span>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-yellow-400">{focusSectionLabel(data)}</p>
                <h2 className="mt-0.5 truncate text-sm font-black text-zinc-100 sm:mt-1 sm:text-lg">{focusDateHeading(data)}</h2>
              </div>
            </div>
            <span className="shrink-0 rounded-full border border-yellow-400/20 bg-yellow-400/[.08] px-2.5 py-1 text-[10px] font-black text-yellow-300">
              {focusItems.length} {focusItems.length === 1 ? "clase" : "clases"}
            </span>
          </div>
          <div className="grid gap-2.5 p-3 sm:gap-3 sm:p-6 md:grid-cols-2">
            {focusItems.map((item) => <ClassCard key={item.id} item={item} saving={savingId === item.id} respond={respond} />)}
          </div>
        </section>
      )}

      <details className="group mt-4 overflow-hidden rounded-2xl border border-white/[.07] bg-[linear-gradient(145deg,#171717,#0c0c0c)] shadow-[0_14px_36px_rgba(0,0,0,.2)] sm:mt-5 sm:rounded-3xl">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2.5 px-3 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-yellow-300 sm:min-h-16 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h2 className="font-black text-zinc-100">Mis horarios semanales</h2>
            <p className="mt-0.5 text-[11px] text-zinc-500 sm:mt-1 sm:text-xs">{data.scheduleLabels.length} {data.scheduleLabels.length === 1 ? "horario vigente" : "horarios vigentes"}</p>
          </div>
          <span className="flex shrink-0 items-center gap-1 text-[11px] font-black text-yellow-300 sm:gap-2 sm:text-xs">Ver semana <span aria-hidden="true" className="text-lg transition group-open:rotate-90">›</span></span>
        </summary>
        <div className="border-t border-white/[.07] px-3 py-1 sm:px-6 sm:py-2">
          {weeklySchedules.length ? (
            <ul>
              {weeklySchedules.map(([day, schedules]) => (
                <li key={day} className="grid grid-cols-[minmax(4.5rem,.7fr)_minmax(0,1.5fr)_auto] items-center gap-2.5 border-b border-white/[.06] py-3 last:border-0 sm:grid-cols-[minmax(5.25rem,.7fr)_minmax(0,1.5fr)_auto] sm:gap-3 sm:py-4">
                  <strong className="text-sm text-zinc-200">{day}</strong>
                  <div className="min-w-0 space-y-2">
                    {schedules.map((schedule, index) => (
                      <div key={`${schedule.time}-${schedule.discipline.label}-${index}`} className="flex min-w-0 items-center gap-2 text-sm text-zinc-400">
                        <span className="font-bold tabular-nums text-zinc-200">{schedule.time}</span>
                        <span aria-hidden="true">{schedule.discipline.icon}</span>
                        <span className="truncate">{schedule.discipline.label}</span>
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

      <section className="relative mt-4 overflow-hidden rounded-2xl border border-yellow-400/15 bg-[linear-gradient(135deg,#181818,#090909)] p-4 shadow-[0_16px_42px_rgba(0,0,0,.22)] sm:mt-5 sm:rounded-3xl sm:p-6">
        <span aria-hidden="true" className="absolute -right-10 -top-12 size-36 rounded-full border border-yellow-400/10 bg-yellow-400/[.035]" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-xl border border-yellow-400/25 bg-yellow-400/[.08] text-base text-yellow-300 sm:size-11 sm:rounded-2xl sm:text-lg">↗</span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-yellow-400">Mis registros</p>
              <h2 className="mt-0.5 text-base font-black text-zinc-100 sm:mt-1 sm:text-lg">Ejercicios, cargas y marcas</h2>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-400 sm:mt-1 sm:text-sm">Consultá tus ejercicios, cargas y marcas registradas.</p>
            </div>
          </div>
          <Link href="/portal/registro" className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-yellow-400/30 bg-yellow-400/[.07] px-4 py-2 text-xs font-black text-yellow-300 transition hover:bg-yellow-400/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 sm:min-h-11 sm:text-sm">Ver mis registros</Link>
        </div>
      </section>
    </div>
  );
}

function CompactClassRow({
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
  const discipline = disciplinePresentation(`${item.name} ${item.category}`, item.name || item.category);
  const responseLabel = item.response === "GOING" ? "Confirmada" : item.response === "NOT_GOING" ? "No asistirás" : item.statusLabel;
  return (
    <article className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-white/[.065] bg-black/35 p-2 sm:grid-cols-[2rem_minmax(0,1fr)_auto_auto]">
      <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full border border-yellow-400/20 bg-yellow-400/[.035] text-xs text-yellow-300">{discipline.icon}</span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-black tabular-nums text-zinc-100">{item.startTime}–{item.endTime}</p>
        <p className="mt-0.5 truncate text-[10px] text-zinc-500">{discipline.label}</p>
      </div>
      <span className={`hidden shrink-0 text-[9px] font-bold sm:inline ${item.response === "GOING" ? "text-emerald-400" : "text-zinc-500"}`}>{item.response === "GOING" ? "✓ " : ""}{responseLabel}</span>
      {item.canRespond ? <button type="button" disabled={saving} onClick={() => respond(item, "GOING")} className={`min-h-9 shrink-0 rounded-lg border px-2.5 text-[10px] font-bold transition disabled:opacity-50 ${item.response === "GOING" ? "border-yellow-400/35 bg-yellow-400/[.055] text-yellow-200" : "border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-yellow-400/25"}`}>{item.response === "GOING" ? "✓ Asistiré" : "Asistiré"}</button> : <span className={`shrink-0 text-[9px] font-bold sm:hidden ${item.response === "GOING" ? "text-emerald-400" : "text-zinc-500"}`}>{responseLabel}</span>}
    </article>
  );
}

function ClassCard({
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
  const discipline = disciplinePresentation(`${item.name} ${item.category}`, item.name || item.category);
  const responseLabel = item.response === "GOING" ? "Confirmada" : item.response === "NOT_GOING" ? "No asistirás" : item.statusLabel;
  return (
    <article className={`min-w-0 rounded-xl border border-white/[.07] border-l-2 ${discipline.accent} bg-zinc-950/75 p-3 shadow-[0_10px_24px_rgba(0,0,0,.16)] sm:rounded-2xl sm:p-4`}>
      <div className="flex items-start justify-between gap-2.5 sm:gap-3">
        <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
          <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/[.07] bg-white/[.035] text-base sm:size-10 sm:rounded-xl sm:text-lg">{discipline.icon}</span>
          <div className="min-w-0">
            <h3 className="break-words text-sm font-black text-zinc-100">{discipline.label}</h3>
            <p className="mt-0.5 text-sm font-black tabular-nums text-yellow-300 sm:mt-1 sm:text-base">{item.startTime}–{item.endTime}</p>
            {item.name !== item.category && <p className="mt-1 truncate text-xs text-zinc-500">{item.name}</p>}
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black ${item.response === "GOING" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : "border-white/[.08] bg-white/[.035] text-zinc-400"}`}>
          {responseLabel}
        </span>
      </div>
      <p className="mt-2 border-t border-white/[.06] pt-2 text-[10px] text-zinc-500 sm:mt-3 sm:pt-3 sm:text-[11px]">
        {item.confirmedCount} confirmados
        {item.capacity === null ? "" : ` · cupo ${item.capacity}`}
      </p>
      {item.canRespond && (
        <ResponseButtons item={item} saving={saving} respond={respond} />
      )}
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
    <div className={`${compact ? "mt-2" : "mt-2.5 sm:mt-3"} grid grid-cols-2 gap-2`}>
      <button
        type="button"
        disabled={saving}
        onClick={() => respond(item, "GOING")}
        className={`${compact ? "min-h-8 rounded-lg px-2 py-1 text-[10px]" : "min-h-9 rounded-lg px-2.5 py-1.5 text-[11px] sm:min-h-10 sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs"} border font-black transition disabled:opacity-50 ${item.response === "GOING" ? "border-yellow-400/45 bg-yellow-400/[.08] text-yellow-200" : "border-zinc-700 bg-zinc-950/70 text-zinc-200 hover:border-yellow-400/25 hover:bg-white/[.03]"}`}
      >
        {item.response === "GOING" ? "✓ Asistiré" : "Asistiré"}
      </button>
      <button
        type="button"
        disabled={saving}
        onClick={() => respond(item, "NOT_GOING")}
        className={`${compact ? "min-h-8 rounded-lg px-2 py-1 text-[10px]" : "min-h-9 rounded-lg px-2.5 py-1.5 text-[11px] sm:min-h-10 sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs"} border font-bold transition disabled:opacity-50 ${item.response === "NOT_GOING" ? "border-zinc-500 bg-white/[.04] text-zinc-100" : "border-zinc-700 bg-zinc-950/50 text-zinc-300 hover:border-zinc-500"}`}
      >
        No asistiré
      </button>
    </div>
  );
}
