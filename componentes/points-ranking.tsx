"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { StudentRankingEntry } from "@/types/points";
import { DEFAULT_PROFILE_AVATAR } from "@/lib/profile-avatars";
import { RANKING_SECTION_ID, RANKING_TOP5_HREF, topFiveEntries } from "@/lib/ranking-navigation";

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
  const [loadError, setLoadError] = useState("");
  const [openedFromAnchor, setOpenedFromAnchor] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const topFiveNavigationLock = useRef(false);

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
        if (!controller.signal.aborted) {
          setRanking([]);
          setLoadError("No se pudo cargar el ranking.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [period, revision]);

  useEffect(() => {
    const syncAnchor = () => setOpenedFromAnchor(window.location.hash === `#${RANKING_SECTION_ID}`);
    syncAnchor();
    window.addEventListener("hashchange", syncAnchor);
    return () => window.removeEventListener("hashchange", syncAnchor);
  }, []);

  useEffect(() => {
    if (expanded || !topFiveNavigationLock.current) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(RANKING_SECTION_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [expanded]);

  async function rebuild() {
    if (rebuilding) return;
    if (!window.confirm("Esto volverá a validar los eventos puntuables sin duplicar movimientos. No modificará asistencias, rutinas ni evaluaciones.")) return;
    setRebuilding(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/ranking", { method: "POST" });
      const body = await response.json() as {
        message?: string;
        eventsCreated?: number;
        eventsOmitted?: number;
        quickLogsProcessed?: number;
        routineSessionsProcessed?: number;
        attendancesProcessed?: number;
        achievementsProcessed?: number;
        eventsCorrected?: number;
        processed?: number;
        individualExerciseEventsRemoved?: number;
        historicalClassExercisesIgnored?: number;
        studentsWithoutActivity?: number;
        errors?: Array<unknown>;
        error?: string;
      };
      if (!response.ok) {
        setNotice(body.error ?? "No se pudo recalcular el ranking.");
        return;
      }
      const changes = (body.eventsCreated ?? 0) + (body.eventsCorrected ?? 0);
      setNotice(changes === 0
        ? `Sin cambios. ${body.processed ?? 0} alumnos validados y ${body.errors?.length ?? 0} errores.`
        : `${body.eventsCreated ?? 0} movimientos creados y ${body.eventsCorrected ?? 0} movimientos corregidos. ${body.errors?.length ?? 0} errores.`);
      setLoading(true);
      setLoadError("");
      setRevision((value) => value + 1);
    } catch {
      setNotice("No se pudo recalcular el ranking.");
    } finally {
      setRebuilding(false);
    }
  }

  const visibleRanking = expanded ? ranking : topFiveEntries(ranking);

  function openTopFive(event: React.MouseEvent<HTMLAnchorElement>) {
    if (topFiveNavigationLock.current) {
      event.preventDefault();
      return;
    }
    topFiveNavigationLock.current = true;
    setExpanded(false);
    window.setTimeout(() => { topFiveNavigationLock.current = false; }, 500);
  }

  return (
    <section id={RANKING_SECTION_ID} tabIndex={-1} className="scroll-mt-[calc(env(safe-area-inset-top)+6rem)] rounded-2xl border border-yellow-400/15 bg-gradient-to-br from-zinc-900 to-[#0b0b0b] p-4 shadow-[0_14px_35px_rgba(0,0,0,.22)] focus:outline-none sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-yellow-400">Ranking por puntos</p>
          <p className="mt-1 text-sm text-zinc-500">Compromiso, constancia y progreso registrado.</p>
          {openedFromAnchor && <button type="button" onClick={() => window.history.back()} className="mt-2 min-h-9 text-xs font-bold text-yellow-300">← Volver</button>}
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-1 rounded-xl bg-zinc-950 p-1">
          {periods.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => { setLoading(true); setLoadError(""); setPeriod(value); }}
              className={`rounded-lg px-2.5 py-2 text-xs font-semibold ${period === value ? "bg-yellow-400 text-zinc-950" : "text-zinc-400"}`}
            >
              {label}
            </button>
          ))}
          <button type="button" disabled={rebuilding} onClick={rebuild} className="rounded-lg border border-zinc-800 px-2.5 py-2 text-xs font-semibold text-zinc-400 disabled:opacity-50">
            {rebuilding ? "Recalculando…" : "Recalcular puntos"}
          </button>
        </div>
      </div>
      {notice && <p role="status" className="mt-3 rounded-xl border border-yellow-400/15 bg-yellow-400/[.05] px-3 py-2 text-xs text-yellow-100">{notice}</p>}
      {loading ? (
        <p className="mt-4 rounded-xl bg-zinc-950 p-5 text-center text-sm text-zinc-500">Calculando ranking…</p>
      ) : loadError ? (
        <div role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[.06] p-5 text-center"><p className="text-sm text-red-200">{loadError}</p><button type="button" onClick={() => { setLoading(true); setLoadError(""); setRevision((value) => value + 1); }} className="mt-3 rounded-lg border border-red-300/30 px-3 py-2 text-xs font-bold text-red-100">Reintentar</button></div>
      ) : ranking.length ? (
        <ol className="mt-4 space-y-2">
          {visibleRanking.map((student, index) => {
            const open = selectedStudentId === student.studentId;
            return (
              <li key={student.studentId} className="min-w-0 rounded-xl border border-zinc-800/80 bg-black/35">
                <button type="button" aria-expanded={open} onClick={() => setSelectedStudentId(open ? null : student.studentId)} className="grid w-full min-w-0 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2 p-3 text-left sm:gap-3">
                  <span className="w-5 text-center text-sm font-black text-yellow-300">{index + 1}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element -- validated profile URL or bundled avatar */}
                  <img src={student.profileImageUrl || DEFAULT_PROFILE_AVATAR.src} alt="" className="h-9 w-9 rounded-full border border-yellow-400/20 object-cover" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{student.studentName}</span>
                    <span className="block truncate text-[10px] text-zinc-500">{student.level} · {student.movements.length} movimientos en el período</span>
                  </span>
                  <span className="text-right">
                    <strong className="block whitespace-nowrap text-sm text-yellow-300">{student.total.toLocaleString("es-AR")} pts</strong>
                    <small className="block whitespace-nowrap text-[9px] text-zinc-600">{open ? "Ocultar detalle" : "Ver detalle"}</small>
                  </span>
                </button>
                {open && (
                  <div className="border-t border-zinc-800 px-3 py-3">
                    {student.movements.length ? (
                      <ul className="space-y-2">
                        {student.movements.map((movement) => (
                          <li key={movement.id} className="flex items-start justify-between gap-3 rounded-lg bg-zinc-950/70 px-3 py-2">
                            <span className="min-w-0">
                              <span className="block text-xs text-zinc-200">{movement.description}</span>
                              <time className="mt-0.5 block text-[10px] text-zinc-500">{new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(movement.occurredAt))}</time>
                            </span>
                            <strong className="whitespace-nowrap text-xs text-yellow-300">+{movement.points} pts</strong>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-xs text-zinc-500">Sin movimientos puntuables en este período.</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">Todavía no hay alumnos con puntos para mostrar.</p>
      )}
      {!loading && ranking.length > 5 && (
        expanded ? <Link href={RANKING_TOP5_HREF} onClick={openTopFive} className="mt-3 grid min-h-10 w-full place-items-center rounded-xl border border-zinc-800 text-xs font-bold text-yellow-300 hover:border-yellow-400/30">Ver Top 5</Link> : <button type="button" onClick={() => setExpanded(true)} className="mt-3 min-h-10 w-full rounded-xl border border-zinc-800 text-xs font-bold text-yellow-300 hover:border-yellow-400/30">Ver ranking completo ({ranking.length})</button>
      )}
    </section>
  );
}
