"use client";

import { useEffect, useState } from "react";
import type { StudentRankingEntry } from "@/types/points";
import { DEFAULT_PROFILE_AVATAR } from "@/lib/profile-avatars";

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
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/ranking?period=${period}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as { ranking?: StudentRankingEntry[] };
        if (!response.ok) throw new Error();
        setRanking(body.ranking ?? []);
        setExpanded(false);
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
    if (!window.confirm("¿Recalcular los puntos de todos los alumnos activos? El proceso puede demorar unos segundos.")) return;
    setRebuilding(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/ranking", { method: "POST" });
      const body = await response.json() as {
        message?: string;
        eventsCreated?: number;
        eventsOmitted?: number;
        quickLogsProcessed?: number;
        attendancesProcessed?: number;
        achievementsProcessed?: number;
        historicalClassExercisesIgnored?: number;
        studentsWithoutActivity?: number;
        errors?: Array<unknown>;
        error?: string;
      };
      if (!response.ok) {
        setNotice(body.error ?? "No se pudo recalcular el ranking.");
        return;
      }
      setNotice(`${body.message ?? "Ranking recalculado."} ${body.quickLogsProcessed ?? 0} registros rápidos · ${body.attendancesProcessed ?? 0} asistencias · ${body.achievementsProcessed ?? 0} logros e hitos · ${body.historicalClassExercisesIgnored ?? 0} ejercicios presenciales históricos conservados sin reprocesar · ${body.eventsCreated ?? 0} eventos reconstruidos · ${body.eventsOmitted ?? 0} ya existentes · ${body.studentsWithoutActivity ?? 0} alumnos sin actividad · ${body.errors?.length ?? 0} errores.`);
      setLoading(true);
      setRevision((value) => value + 1);
    } catch {
      setNotice("No se pudo recalcular el ranking.");
    } finally {
      setRebuilding(false);
    }
  }

  const visibleRanking = expanded ? ranking : ranking.slice(0, 5);

  return (
    <section className="rounded-2xl border border-yellow-400/15 bg-gradient-to-br from-zinc-900 to-[#0b0b0b] p-4 shadow-[0_14px_35px_rgba(0,0,0,.22)] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-yellow-400">Ranking por puntos</p>
          <p className="mt-1 text-sm text-zinc-500">Compromiso, constancia y progreso registrado.</p>
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-1 rounded-xl bg-zinc-950 p-1">
          {periods.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => { setLoading(true); setPeriod(value); }}
              className={`rounded-lg px-2.5 py-2 text-xs font-semibold ${period === value ? "bg-yellow-400 text-zinc-950" : "text-zinc-400"}`}
            >
              {label}
            </button>
          ))}
          <button type="button" disabled={rebuilding} onClick={rebuild} className="rounded-lg border border-zinc-800 px-2.5 py-2 text-xs font-semibold text-zinc-400 disabled:opacity-50">
            {rebuilding ? "Recalculando…" : "Recalcular"}
          </button>
        </div>
      </div>
      {notice && <p role="status" className="mt-3 rounded-xl border border-yellow-400/15 bg-yellow-400/[.05] px-3 py-2 text-xs text-yellow-100">{notice}</p>}
      {loading ? (
        <p className="mt-4 rounded-xl bg-zinc-950 p-5 text-center text-sm text-zinc-500">Calculando ranking…</p>
      ) : ranking.length ? (
        <ol className="mt-4 space-y-2">
          {visibleRanking.map((student, index) => {
            const participation = student.serviceType === "PERSONALIZED"
              ? "Personalizado"
              : student.serviceType === "MIXED"
                ? `Mixto · ${student.attendanceThisMonth} asistencias`
                : `${student.attendanceThisMonth} asistencias este mes`;
            return (
              <li key={student.studentId} className="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-zinc-800/80 bg-black/35 p-3 sm:gap-3">
                <span className="w-5 text-center text-sm font-black text-yellow-300">{index + 1}</span>
                {/* eslint-disable-next-line @next/next/no-img-element -- validated profile URL or bundled avatar */}
                <img src={student.profileImageUrl || DEFAULT_PROFILE_AVATAR.src} alt="" className="h-9 w-9 rounded-full border border-yellow-400/20 object-cover" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{student.studentName}</p>
                  <p className="truncate text-[10px] text-zinc-500">{student.level} · {student.achievementCount} logros · {participation} · {student.recordCount} registros</p>
                </div>
                <span className="text-right">
                  <strong className="block whitespace-nowrap text-sm text-yellow-300">{student.total.toLocaleString("es-AR")} pts</strong>
                  <small className="block whitespace-nowrap text-[9px] text-zinc-600">{student.historicalTotal.toLocaleString("es-AR")} históricos</small>
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">No hay alumnos activos para mostrar.</p>
      )}
      {!loading && ranking.length > 5 && (
        <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-3 min-h-10 w-full rounded-xl border border-zinc-800 text-xs font-bold text-yellow-300 hover:border-yellow-400/30">
          {expanded ? "Ver Top 5" : `Ver ranking completo (${ranking.length})`}
        </button>
      )}
    </section>
  );
}
