"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PortalClassOccurrence } from "@/types/classes";

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
};

const dateLabel = (value: string) =>
  new Date(`${value}T12:00:00Z`).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
export function PortalClasses({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<ClassData | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");
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
      <section className="h-full rounded-2xl border border-yellow-400/15 bg-[linear-gradient(145deg,#181818,#0a0a0a)] p-4 shadow-[0_14px_35px_rgba(0,0,0,.28)] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-yellow-400">
              <span aria-hidden="true">▣</span>{data.focus.title}
            </p>
            <h2 className="mt-2 text-xl font-black">
              {focusItems.length
                ? `${focusItems.length} ${focusItems.length === 1 ? "clase disponible" : "clases disponibles"}`
                : "Sin próximas clases"}
            </h2>
            {focusItems.length > 0 && <p className="mt-1 text-xs text-zinc-500">{data.focus.subtitle}</p>}
          </div>
          <Link
            href="/portal/clases"
            className="shrink-0 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-yellow-300 transition hover:border-yellow-400/40"
          >
            Ver horarios
          </Link>
        </div>
        {focusItems.length ? (
          <div className="mt-4 space-y-3">
            {focusItems.slice(0, 2).map((item) => (
              <ClassCard
                key={item.id}
                item={item}
                saving={savingId === item.id}
                respond={respond}
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-zinc-800 bg-black/25 p-5">
            <p className="text-sm text-zinc-400">
              {data.availability.message ?? data.focus.subtitle}
            </p>
          </div>
        )}
        <Feedback error={error} notice={notice} />
      </section>
    );

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-yellow-400">Agenda presencial</p>
          <h1 className="mt-1 text-2xl font-bold">
            {showWeek ? "Próximos 7 días con agenda" : data?.focus.title}
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            {showWeek ? "Consultá tus horarios y confirmá tu asistencia." : data?.focus.subtitle}
          </p>
        </div>
        <button
          onClick={() => setShowWeek((value) => !value)}
          className="self-start rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-yellow-400/50 hover:text-yellow-300 sm:self-auto"
        >
          {showWeek ? "Ver próximo día" : "Ver próximos 7 días"}
        </button>
      </header>
      <details className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
        <summary className="cursor-pointer list-none text-sm font-bold text-yellow-300">
          Mis horarios semanales ({data?.scheduleLabels.length ?? 0})
        </summary>
        {data?.scheduleLabels.length ? (
          <ul className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
            {data.scheduleLabels.map((label) => (
              <li
                key={label}
                className="rounded-lg bg-zinc-950 px-3 py-2 text-sm text-zinc-300"
              >
                {label}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">
            No tenés horarios semanales asignados.
          </p>
        )}
        {data?.flexibleSchedule && (
          <p className="mt-3 text-sm text-zinc-400">
            Horario habitual: {data.flexibleSchedule}
          </p>
        )}
      </details>
      <Feedback error={error} notice={notice} />
      {grouped.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-zinc-500">
          {data.availability.message ?? (showWeek
            ? "No tenés clases asignadas para los próximos 7 días."
            : data.focus.subtitle)}
        </p>
      )}
      <div className="mt-6 space-y-5">
        {grouped.map(([date, items]) => (
          <section key={date}>
            <h2 className="mb-3 font-bold capitalize text-yellow-300">
              {dateLabel(date)}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((item) => (
                <ClassCard
                  key={item.id}
                  item={item}
                  saving={savingId === item.id}
                  respond={respond}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
      <section className="mt-8 rounded-2xl border border-yellow-400/15 bg-gradient-to-br from-zinc-900 to-black p-5">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-full border border-yellow-400/30 bg-yellow-400/10 text-yellow-300"
          >
            ↗
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-yellow-400">
              Mis registros
            </p>
            <h2 className="mt-1 text-lg font-bold">
              Ejercicios, cargas y marcas
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Consultá tus ejercicios, cargas y marcas registradas.
            </p>
            <Link
              href="/portal/registro"
              className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-yellow-400/35 px-4 py-2 text-sm font-bold text-yellow-300 transition hover:bg-yellow-400/10 focus:outline-none focus:ring-2 focus:ring-yellow-300"
            >
              Ver mis registros
            </Link>
          </div>
        </div>
      </section>
    </div>
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
  return (
    <article className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words font-bold">{item.name}</h3>
          <p className="mt-1 text-sm text-zinc-400">
            {item.startTime}–{item.endTime} · {item.category}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-zinc-950 px-2 py-1 text-xs text-zinc-400">
          {item.statusLabel}
        </span>
      </div>
      <p className="mt-3 text-xs text-zinc-500">
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
}: {
  item: PortalClassOccurrence;
  saving: boolean;
  respond: (
    item: PortalClassOccurrence,
    value: "GOING" | "NOT_GOING",
  ) => void;
}) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      <button
        disabled={saving}
        onClick={() => respond(item, "GOING")}
        className={`rounded-xl p-3 font-bold text-zinc-950 ${item.response === "GOING" ? "bg-emerald-400" : "bg-yellow-400"}`}
      >
        Asistiré
      </button>
      <button
        disabled={saving}
        onClick={() => respond(item, "NOT_GOING")}
        className={`rounded-xl border p-3 font-semibold ${item.response === "NOT_GOING" ? "border-red-300 text-red-200" : "border-zinc-700"}`}
      >
        No asistiré
      </button>
    </div>
  );
}
