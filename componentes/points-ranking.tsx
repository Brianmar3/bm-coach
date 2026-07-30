"use client";

import { useEffect, useState } from "react";
import type { StudentRankingEntry } from "@/types/points";

const periods = [
  ["month", "Este mes"],
  ["30d", "Últimos 30 días"],
  ["total", "Histórico"],
] as const;

export function PointsRanking() {
  const [period, setPeriod] = useState<(typeof periods)[number][0]>("month");
  const [ranking, setRanking] = useState<StudentRankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/ranking?period=${period}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          ranking?: StudentRankingEntry[];
        };
        if (!response.ok) throw new Error();
        setRanking(body.ranking ?? []);
      })
      .catch(() => {
        if (!controller.signal.aborted) setRanking([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [period, revision]);

  async function rebuild() {
    setRebuilding(true);
    try {
      const response = await fetch("/api/admin/ranking", { method: "POST" });
      if (response.ok) {
        setLoading(true);
        setRevision((value) => value + 1);
      }
    } finally {
      setRebuilding(false);
    }
  }

  return (
    <section className="rounded-2xl border border-yellow-400/15 bg-gradient-to-br from-zinc-900 to-[#0b0b0b] p-4 shadow-[0_14px_35px_rgba(0,0,0,.22)] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-yellow-400">
            Ranking por puntos
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Compromiso, constancia y progreso registrado.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-xl bg-zinc-950 p-1">
          {periods.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setLoading(true);
                setPeriod(value);
              }}
              className={`rounded-lg px-2.5 py-2 text-xs font-semibold ${
                period === value
                  ? "bg-yellow-400 text-zinc-950"
                  : "text-zinc-400"
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            disabled={rebuilding}
            onClick={rebuild}
            className="rounded-lg border border-zinc-800 px-2.5 py-2 text-xs font-semibold text-zinc-400 disabled:opacity-50"
          >
            {rebuilding ? "Recalculando…" : "Recalcular"}
          </button>
        </div>
      </div>
      {loading ? (
        <p className="mt-4 rounded-xl bg-zinc-950 p-5 text-center text-sm text-zinc-500">
          Calculando ranking…
        </p>
      ) : ranking.length ? (
        <ol className="mt-4 space-y-2">
          {ranking.map((student, index) => {
            const initials = student.studentName
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0])
              .join("")
              .toUpperCase();
            return (
              <li
                key={student.studentId}
                className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-zinc-800/80 bg-black/35 p-3"
              >
                <span className="w-5 text-center text-sm font-black text-yellow-300">
                  {index + 1}
                </span>
                {student.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- validated profile URL
                  <img
                    src={student.profileImageUrl}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover"
                  />
                ) : (
                  <span className="grid h-9 w-9 place-items-center rounded-full border border-yellow-400/20 bg-yellow-400/[.06] text-xs font-bold text-yellow-200">
                    {initials}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">
                    {student.studentName}
                  </p>
                  <p className="truncate text-[10px] text-zinc-500">
                    {student.achievementCount} logros ·{" "}
                    {student.attendanceThisMonth} asistencias este mes ·{" "}
                    {student.recordCount} registros
                  </p>
                </div>
                <strong className="text-sm text-yellow-300">
                  {student.total.toLocaleString("es-AR")} pts
                </strong>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">
          Todavía no hay movimientos de puntos para este período.
        </p>
      )}
    </section>
  );
}
