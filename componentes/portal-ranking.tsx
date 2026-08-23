"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { DEFAULT_PROFILE_AVATAR } from "@/lib/profile-avatars";

type RankingEntry = {
  studentId: string;
  studentName: string;
  profileImageUrl: string;
  total: number;
};

type PortalRankingResponse = {
  currentStudentId: string;
  currentPosition: number | null;
  currentPoints: number;
  ranking: RankingEntry[];
};

type RankedEntry = RankingEntry & { position: number };

const FEATURED_RANKING_SIZE = 5;

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reducedMotion;
}

function useAnimatedPoints(value: number, reducedMotion: boolean) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;

    let frame = 0;
    const duration = 780;
    const startedAt = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion, value]);

  return reducedMotion ? value : shown;
}

function SummaryShield() {
  return <svg viewBox="0 0 84 94" aria-hidden="true" className="h-[62px] w-[56px] drop-shadow-[0_0_14px_rgba(250,204,21,.38)] sm:h-[78px] sm:w-[70px]">
    <defs>
      <linearGradient id="ranking-shield" x1="0" x2="1" y1="0" y2="1">
        <stop stopColor="#fff3a3" />
        <stop offset=".42" stopColor="#facc15" />
        <stop offset="1" stopColor="#a65f00" />
      </linearGradient>
    </defs>
    <path d="M42 4 76 17v28c0 21-13 35-34 45C21 80 8 66 8 45V17L42 4Z" fill="rgba(250,204,21,.12)" stroke="url(#ranking-shield)" strokeWidth="4" />
    <path d="m42 25 5.4 11 12.1 1.7-8.8 8.5 2.1 12.1L42 52.6l-10.8 5.7 2.1-12.1-8.8-8.5L36.6 36 42 25Z" fill="url(#ranking-shield)" />
  </svg>;
}

function CrownIcon() {
  return <svg viewBox="0 0 32 22" aria-hidden="true" className="absolute -top-3 left-1/2 h-5 w-7 -translate-x-1/2 text-yellow-300 drop-shadow-[0_0_7px_rgba(250,204,21,.65)]">
    <path d="m3 5 7 5 6-8 6 8 7-5-3 14H6L3 5Z" fill="currentColor" />
  </svg>;
}

function RankBadge({ position }: { position: number }) {
  const podium = position <= 3;
  const palette = position === 1
    ? "border-yellow-200/80 bg-gradient-to-br from-yellow-200 via-yellow-500 to-amber-800 text-black shadow-[0_0_22px_rgba(250,204,21,.35)]"
    : position === 2
      ? "border-zinc-200/65 bg-gradient-to-br from-white via-zinc-300 to-zinc-600 text-zinc-950 shadow-[0_0_15px_rgba(228,228,231,.18)]"
      : position === 3
        ? "border-orange-200/65 bg-gradient-to-br from-orange-200 via-orange-500 to-amber-900 text-black shadow-[0_0_15px_rgba(251,146,60,.2)]"
        : "border-white/[.07] bg-zinc-800/85 text-zinc-200";

  return <span className="relative grid size-10 shrink-0 place-items-center sm:size-12">
    {position === 1 && <CrownIcon />}
    <span className={`grid size-9 place-items-center rounded-full border text-sm font-black sm:size-10 sm:text-base ${palette}`}>{position}</span>
    {podium && <span aria-hidden="true" className="absolute -bottom-1 h-px w-9 bg-gradient-to-r from-transparent via-current to-transparent opacity-60" />}
  </span>;
}

function RankingRow({ entry, currentStudentId, delay, reducedMotion }: {
  entry: RankedEntry;
  currentStudentId: string;
  delay: number;
  reducedMotion: boolean;
}) {
  const isCurrent = entry.studentId === currentStudentId;
  const isWinner = entry.position === 1;
  const style = reducedMotion ? undefined : { "--ranking-delay": `${delay}ms` } as CSSProperties;
  const surface = isCurrent
    ? "border-yellow-400/60 bg-[radial-gradient(circle_at_80%_50%,rgba(250,204,21,.12),transparent_48%),linear-gradient(100deg,rgba(250,204,21,.09),rgba(24,24,27,.8))] shadow-[0_12px_36px_rgba(0,0,0,.3)]"
    : isWinner
      ? "border-yellow-400/45 bg-[radial-gradient(circle_at_20%_50%,rgba(250,204,21,.16),transparent_44%),rgba(24,24,27,.78)] shadow-[0_0_26px_rgba(250,204,21,.08)]"
      : "border-white/[.08] bg-zinc-900/65";

  return <li value={entry.position} style={style} className={`portal-ranking-enter-item relative grid min-h-[70px] grid-cols-[2.5rem_2.65rem_minmax(0,1fr)_auto] items-center gap-2 overflow-visible rounded-2xl border px-2.5 py-3 sm:min-h-[82px] sm:grid-cols-[3rem_3.2rem_minmax(0,1fr)_auto] sm:gap-3 sm:px-4 ${surface}`}>
    {isWinner && <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      <i className="portal-ranking-sparkle left-[8%] top-[18%]" />
      <i className="portal-ranking-sparkle left-[42%] top-[72%] [animation-delay:260ms]" />
      <i className="portal-ranking-sparkle right-[9%] top-[22%] [animation-delay:520ms]" />
    </span>}
    {isCurrent && <span className="absolute -top-3 right-4 rounded-md border border-yellow-400/25 bg-[#261b03] px-3 py-1 text-[9px] font-black uppercase tracking-[.15em] text-yellow-300">Tú</span>}
    <RankBadge position={entry.position} />
    <Image src={entry.profileImageUrl || DEFAULT_PROFILE_AVATAR.src} alt="" width={52} height={52} unoptimized className="size-10 rounded-full border border-white/10 object-cover sm:size-12" />
    <span className="min-w-0 truncate text-[13px] font-bold text-zinc-100 min-[390px]:text-sm sm:text-base">{entry.studentName}</span>
    <strong className="shrink-0 whitespace-nowrap text-[13px] text-yellow-300 min-[390px]:text-sm sm:text-base">{entry.total.toLocaleString("es-AR")} pts</strong>
  </li>;
}

function RankingSkeleton() {
  return <div className="mt-5 space-y-3" aria-label="Cargando ranking">
    <div className="h-32 animate-pulse rounded-3xl bg-zinc-900" />
    <div className="h-[70px] animate-pulse rounded-2xl bg-zinc-900/75" />
    <div className="h-[70px] animate-pulse rounded-2xl bg-zinc-900/55" />
  </div>;
}

export function PortalRanking() {
  const [ranking, setRanking] = useState<PortalRankingResponse | null>(null);
  const [error, setError] = useState("");
  const reducedMotion = useReducedMotion();
  const shownPoints = useAnimatedPoints(ranking?.currentPoints ?? 0, reducedMotion);

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

  const entries = useMemo(() => ranking?.ranking.map((entry, index) => ({ ...entry, position: index + 1 })) ?? [], [ranking]);
  const featured = entries.slice(0, FEATURED_RANKING_SIZE);
  const current = entries.find((entry) => entry.studentId === ranking?.currentStudentId);
  const pinnedCurrent = current && current.position > FEATURED_RANKING_SIZE ? current : null;
  const remainder = entries.slice(FEATURED_RANKING_SIZE).filter((entry) => entry.studentId !== pinnedCurrent?.studentId);
  const currentOnPodium = Boolean(ranking?.currentPosition && ranking.currentPosition <= 3);

  return <div className="mx-auto w-full max-w-3xl overflow-x-clip px-0.5 sm:px-0">
    <Link href="/portal/puntos" className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-zinc-950/55 px-4 text-sm font-semibold text-zinc-300 transition hover:border-yellow-400/30 hover:text-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300" aria-label="Volver a Puntos y logros">← Volver</Link>
    <header className="portal-ranking-enter-item mt-6 [--ranking-delay:40ms]"><p className="text-[11px] font-black uppercase tracking-[.22em] text-yellow-400">Puntos del mes</p><h1 className="mt-1 text-[2rem] font-black leading-none tracking-tight sm:text-4xl">Ranking mensual</h1><p className="mt-2 text-sm leading-relaxed text-zinc-500 sm:text-base">Tu posición y la tabla completa del mes actual.</p></header>

    {error ? <p role="alert" className="mt-5 rounded-xl border border-red-400/20 bg-red-400/[.06] p-4 text-sm text-red-200">{error}</p> : !ranking ? <RankingSkeleton /> : <>
      <section className="portal-ranking-summary portal-ranking-enter-item relative mt-6 grid min-h-[128px] grid-cols-[minmax(0,1fr)_56px_minmax(0,1fr)] items-center gap-2 overflow-hidden rounded-3xl border border-yellow-400/65 px-4 py-5 shadow-[0_18px_50px_rgba(0,0,0,.38),0_0_24px_rgba(250,204,21,.08)] [--ranking-delay:110ms] sm:grid-cols-[1fr_74px_1fr] sm:px-8" aria-label="Tu resumen mensual">
        <span aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(250,204,21,.18),transparent_28%),radial-gradient(circle_at_85%_10%,rgba(250,204,21,.08),transparent_30%)]" />
        {currentOnPodium && !reducedMotion && <span aria-hidden="true" className="pointer-events-none absolute inset-0">
          <i className="portal-ranking-celebration left-[18%] top-[25%]" />
          <i className="portal-ranking-celebration left-[68%] top-[18%] [animation-delay:160ms]" />
          <i className="portal-ranking-celebration left-[78%] top-[70%] [animation-delay:320ms]" />
          <i className="portal-ranking-celebration left-[31%] top-[76%] [animation-delay:480ms]" />
        </span>}
        <div className="relative min-w-0"><p className="text-[8px] uppercase leading-tight tracking-[.11em] text-zinc-400 min-[390px]:text-[9px] sm:text-[11px]">Tu posición</p><strong className="mt-2 block text-3xl font-black leading-none text-white sm:text-5xl">{ranking.currentPosition ? `#${ranking.currentPosition}` : "—"}</strong></div>
        <span className="relative grid place-items-center"><SummaryShield /></span>
        <div className="relative min-w-0 text-right"><p className="text-[8px] uppercase leading-tight tracking-[.08em] text-zinc-400 min-[390px]:text-[9px] sm:text-[11px]">Tus puntos del mes</p><strong aria-label={`${ranking.currentPoints} puntos del mes`} className="mt-2 block text-3xl font-black leading-none text-yellow-300 sm:text-5xl">{shownPoints.toLocaleString("es-AR")}</strong></div>
      </section>

      {entries.length === 0 ? <p className="mt-4 rounded-2xl border border-white/[.07] bg-zinc-900/55 p-6 text-center text-sm text-zinc-500">Todavía no hay posiciones para mostrar este mes.</p> : <>
        <ol className="mt-5 space-y-3" aria-label="Ranking mensual destacado">
          {featured.map((entry, index) => <RankingRow key={entry.studentId} entry={entry} currentStudentId={ranking.currentStudentId} delay={190 + index * 85} reducedMotion={reducedMotion} />)}
        </ol>

        {pinnedCurrent && <section className="mt-6" aria-label="Tu posición en el ranking">
          <ol start={pinnedCurrent.position}>
            <RankingRow entry={pinnedCurrent} currentStudentId={ranking.currentStudentId} delay={620} reducedMotion={reducedMotion} />
          </ol>
        </section>}

        {remainder.length > 0 && <section className="mt-7" aria-labelledby="ranking-completo-title">
          <h2 id="ranking-completo-title" className="mb-3 text-[10px] font-black uppercase tracking-[.2em] text-zinc-500">Ranking completo</h2>
          <ol className="space-y-2" start={FEATURED_RANKING_SIZE + 1}>
            {remainder.map((entry, index) => <RankingRow key={entry.studentId} entry={entry} currentStudentId={ranking.currentStudentId} delay={Math.min(700 + index * 70, 1050)} reducedMotion={reducedMotion} />)}
          </ol>
        </section>}
      </>}

      <p className="mt-6 text-center text-[11px] leading-relaxed text-zinc-500">ⓘ Los puntos se actualizan en tiempo real.</p>
    </>}
  </div>;
}
