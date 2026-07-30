"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { PortalClassOccurrence } from "@/types/classes";

type ClassData = {
  occurrences: PortalClassOccurrence[];
  scheduleLabels: string[];
  flexibleSchedule: string;
};

const dateLabel = (value: string) =>
  new Date(`${value}T12:00:00Z`).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
const argentinaToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const addDays = (value: string, days: number) => {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export function PortalClasses({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<ClassData | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [showWeek, setShowWeek] = useState(false);
  const endpoint = compact ? "/api/portal/clases?summary=1" : "/api/portal/clases";

  async function load() {
    const response = await fetch(endpoint, { cache: "no-store" });
    const body = (await response.json()) as ClassData & { error?: string };
    if (response.status === 401) {
      window.location.href = "/portal/login";
      return;
    }
    if (!response.ok)
      throw new Error(body.error ?? "No se pudieron cargar las clases.");
    setData(body);
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as ClassData & { error?: string };
        if (response.status === 401) {
          window.location.href = "/portal/login";
          return null;
        }
        if (!response.ok)
          throw new Error(body.error ?? "No se pudieron cargar las clases.");
        return body;
      })
      .then((body) => {
        if (body) setData(body);
      })
      .catch((value: unknown) => {
        if (value instanceof Error && value.name !== "AbortError")
          setError(value.message);
      });
    return () => controller.abort();
  }, [endpoint]);

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

  const today = argentinaToday();
  const todayItems = useMemo(
    () =>
      (data?.occurrences ?? [])
        .filter((item) => item.date === today)
        .sort((left, right) => {
          const leftUpcoming =
            left.status === "SCHEDULED" && left.canRespond;
          const rightUpcoming =
            right.status === "SCHEDULED" && right.canRespond;
          return (
            Number(rightUpcoming) - Number(leftUpcoming) ||
            left.startTime.localeCompare(right.startTime)
          );
        }),
    [data, today],
  );
  const weekEnd = addDays(today, 6);
  const grouped = useMemo(() => {
    const map = new Map<string, PortalClassOccurrence[]>();
    const visible = showWeek
      ? (data?.occurrences ?? []).filter(
          (item) => item.date >= today && item.date <= weekEnd,
        )
      : todayItems;
    for (const item of visible)
      map.set(item.date, [...(map.get(item.date) ?? []), item]);
    return [...map.entries()];
  }, [data, showWeek, today, todayItems, weekEnd]);

  if (!data && !error)
    return <div className="h-44 animate-pulse rounded-2xl bg-zinc-900" />;

  if (compact)
    return (
      <section className="h-full rounded-2xl border border-yellow-400/15 bg-[linear-gradient(145deg,#181818,#0a0a0a)] p-4 shadow-[0_14px_35px_rgba(0,0,0,.28)] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-yellow-400">
              <span aria-hidden="true">▣</span>Clases de hoy
            </p>
            <h2 className="mt-2 text-xl font-black">
              {todayItems.length
                ? `${todayItems.length} ${todayItems.length === 1 ? "clase disponible" : "clases disponibles"}`
                : "Sin clases hoy"}
            </h2>
          </div>
          <Link
            href="/portal/clases"
            className="shrink-0 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-yellow-300 transition hover:border-yellow-400/40"
          >
            Ver horarios
          </Link>
        </div>
        {todayItems.length ? (
          <div className="mt-4 space-y-3">
            {todayItems.slice(0, 2).map((item) => (
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
              Hoy no hay clases programadas.
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              Podés consultar tus horarios semanales.
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
            {showWeek ? "Semana completa" : "Clases de hoy"}
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Consultá tus horarios y confirmá tu asistencia.
          </p>
        </div>
        <button
          onClick={() => setShowWeek((value) => !value)}
          className="self-start rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-yellow-400/50 hover:text-yellow-300 sm:self-auto"
        >
          {showWeek ? "Ver solo hoy" : "Ver semana completa"}
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
      {!showWeek && todayItems.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-zinc-500">
          Hoy no hay clases programadas.
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
