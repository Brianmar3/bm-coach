"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type PortalRankingResponse = {
  currentStudentId: string;
  currentPosition: number | null;
  currentPoints: number;
  ranking: Array<{ studentId: string; studentName: string; total: number }>;
};

export function PortalRanking() {
  const [ranking, setRanking] = useState<PortalRankingResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/portal/ranking", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as PortalRankingResponse & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "No se pudo cargar el ranking.");
        return body;
      })
      .then(setRanking)
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name !== "AbortError") setError(reason.message);
      });
    return () => controller.abort();
  }, []);

  return <div className="mx-auto w-full max-w-2xl">
    <Link href="/portal/puntos" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-semibold text-zinc-300 transition hover:border-yellow-400/30 hover:text-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300" aria-label="Volver a Puntos y logros">← Volver</Link>
    <header className="mt-5"><p className="text-[10px] font-black uppercase tracking-[.18em] text-yellow-400">Puntos del mes</p><h1 className="mt-1 text-2xl font-black">Ranking mensual</h1><p className="mt-1 text-sm text-zinc-500">Tu posición y la tabla completa del mes actual.</p></header>

    {error ? <p role="alert" className="mt-5 rounded-xl border border-red-400/20 bg-red-400/[.06] p-4 text-sm text-red-200">{error}</p> : !ranking ? <div className="mt-5 space-y-3" aria-label="Cargando ranking"><div className="h-24 animate-pulse rounded-2xl bg-zinc-900" /><div className="h-16 animate-pulse rounded-xl bg-zinc-900/70" /><div className="h-16 animate-pulse rounded-xl bg-zinc-900/50" /></div> : <>
      <section className="mt-5 grid grid-cols-2 gap-3 rounded-2xl border border-yellow-400/15 bg-yellow-400/[.04] p-4" aria-label="Tu resumen mensual">
        <div><p className="text-[9px] uppercase tracking-[.12em] text-zinc-500">Tu posición</p><strong className="mt-1 block text-2xl text-white">{ranking.currentPosition ? `#${ranking.currentPosition}` : "—"}</strong></div>
        <div className="text-right"><p className="text-[9px] uppercase tracking-[.12em] text-zinc-500">Tus puntos del mes</p><strong className="mt-1 block text-2xl text-yellow-300">{ranking.currentPoints.toLocaleString("es-AR")}</strong></div>
      </section>
      <ol className="mt-4 space-y-2">{ranking.ranking.map((entry, index) => <li key={entry.studentId} className={`flex min-h-16 items-center gap-3 rounded-xl border px-3 py-2.5 ${entry.studentId === ranking.currentStudentId ? "border-yellow-400/25 bg-yellow-400/[.05]" : "border-white/[.06] bg-zinc-900/55"}`}><span className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-black ${index < 3 ? "bg-yellow-400/10 text-yellow-300" : "bg-zinc-800 text-zinc-400"}`}>{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">{entry.studentName}</span><strong className="shrink-0 text-sm text-yellow-300">{entry.total.toLocaleString("es-AR")} pts</strong></li>)}</ol>
      <p className="mt-5 text-center text-[11px] leading-relaxed text-zinc-500">El ranking se calcula con los puntos obtenidos durante el mes actual.</p>
    </>}
  </div>;
}
