"use client";
import { PortalSectionHeading } from "@/componentes/portal-section-heading";
import { BmMedalIcon } from "@/componentes/icons";
import { SportsLaurels, SportsShield } from "@/componentes/sports-shield";
import { argentinaDateKey, argentinaMonthBounds } from "@/lib/payment-dates";
import { StudentPhoto } from "@/componentes/student-photo";

import { PortalPointsBackLink } from "@/componentes/portal-points-back-link";
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

function RankBadge({ position }: { position: number }) {
  return <span className="sports-rank-number">{position}</span>;
}

function PodiumMedal({ position }: { position: number }) {
  return <span className="sports-podium-medal">
    <svg aria-hidden="true" viewBox="0 0 160 118"><SportsLaurels /></svg>
    <span>{position}</span>
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
    ? "portal-ranking-current border-yellow-400/60 bg-[radial-gradient(circle_at_80%_50%,rgba(250,204,21,.12),transparent_48%),linear-gradient(100deg,rgba(250,204,21,.09),rgba(24,24,27,.8))] shadow-[0_12px_36px_rgba(0,0,0,.3)]"
    : isWinner
      ? "portal-ranking-winner border-yellow-400/45 bg-[radial-gradient(circle_at_20%_50%,rgba(250,204,21,.16),transparent_44%),rgba(24,24,27,.78)] shadow-[0_0_26px_rgba(250,204,21,.08)]"
      : "border-white/[.08] bg-zinc-900/65";

  return <li value={entry.position} style={style} className={`portal-ranking-row portal-ranking-enter-item relative grid min-h-[70px] grid-cols-[2.5rem_2.65rem_minmax(0,1fr)_auto] items-center gap-2 overflow-visible rounded-2xl border px-2.5 py-3 sm:min-h-[82px] sm:grid-cols-[3rem_3.2rem_minmax(0,1fr)_auto] sm:gap-3 sm:px-4 ${surface}`}>
    {isWinner && <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      <i className="portal-ranking-sparkle left-[8%] top-[18%]" />
      <i className="portal-ranking-sparkle left-[42%] top-[72%] [animation-delay:260ms]" />
      <i className="portal-ranking-sparkle right-[9%] top-[22%] [animation-delay:520ms]" />
    </span>}
    <RankBadge position={entry.position} />
    <StudentPhoto src={entry.profileImageUrl || DEFAULT_PROFILE_AVATAR.src} alt="" width={52} height={52} className="size-10 rounded-full border border-white/10 object-cover sm:size-12" />
    <span className="min-w-0 truncate text-[13px] font-bold text-zinc-100 min-[390px]:text-sm sm:text-base">{entry.studentName}{isCurrent && <small className="sports-ranking-you"> (vos)</small>}</span>
    <strong className="shrink-0 whitespace-nowrap text-[13px] text-[var(--brand-text)] min-[390px]:text-sm sm:text-base">{entry.total.toLocaleString("es-AR")} pts</strong>
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
  const podium = entries.slice(0, 3);
  const featured = entries.slice(3, FEATURED_RANKING_SIZE);
  const current = entries.find((entry) => entry.studentId === ranking?.currentStudentId);
  const pinnedCurrent = current && current.position > FEATURED_RANKING_SIZE ? current : null;
  const remainder = entries.slice(FEATURED_RANKING_SIZE).filter((entry) => entry.studentId !== pinnedCurrent?.studentId);
  const today = argentinaDateKey();
  const { nextMonthStart } = argentinaMonthBounds(today);
  const remainingDays = Math.max(0, (Date.parse(nextMonthStart) - Date.parse(today)) / 86400000 - 1);
  const month = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(today));
  const currentOnPodium = Boolean(ranking?.currentPosition && ranking.currentPosition <= 3);

  return <div className="portal-ranking-page sports-ranking-page mx-auto w-full max-w-3xl">
    <PortalSectionHeading icon={BmMedalIcon} kicker="Puntos del mes" title="Ranking mensual" subtitle="Tu posición y la tabla completa del mes actual" action={<PortalPointsBackLink />} className="portal-ranking-header portal-ranking-enter-item [--ranking-delay:40ms]" />

    {error ? <p role="alert" className="mt-5 rounded-xl border border-red-400/20 bg-red-400/[.06] p-4 text-sm text-red-200">{error}</p> : !ranking ? <RankingSkeleton /> : <>
      <div className="sports-arena">
        <section className="portal-ranking-summary portal-ranking-enter-item [--ranking-delay:110ms]" aria-label="Tu resumen mensual">

          {currentOnPodium && !reducedMotion && <span aria-hidden="true" className="pointer-events-none absolute inset-0">
            <i className="portal-ranking-celebration left-[18%] top-[25%]" />
            <i className="portal-ranking-celebration left-[68%] top-[18%] [animation-delay:160ms]" />
            <i className="portal-ranking-celebration left-[78%] top-[70%] [animation-delay:320ms]" />
            <i className="portal-ranking-celebration left-[31%] top-[76%] [animation-delay:480ms]" />
          </span>}
          <div className="sports-ranking-position"><p>Tu posición</p><strong>{ranking.currentPosition ? `#${ranking.currentPosition}` : "—"}</strong></div>
          <div className="sports-ranking-emblem"><SportsShield /><span aria-hidden="true" /></div>
          <div className="sports-ranking-score"><p>Tus puntos del mes</p><strong aria-label={`${ranking.currentPoints} puntos del mes`}>{shownPoints.toLocaleString("es-AR")}</strong><span>pts</span></div>
        </section>

        {entries.length === 0 ? <p className="mt-4 rounded-2xl border border-white/[.07] bg-zinc-900/55 p-6 text-center text-sm text-zinc-500">Todavía no hay posiciones para mostrar este mes.</p> : <>
          <ol className="sports-podium" aria-label="Podio del ranking mensual">
            {podium.map(entry => <li key={entry.studentId} value={entry.position} data-position={entry.position}
              data-current={entry.studentId === ranking.currentStudentId} className="portal-ranking-enter-item sports-podium-plate">
              <PodiumMedal position={entry.position} />
              <StudentPhoto src={entry.profileImageUrl || DEFAULT_PROFILE_AVATAR.src} alt="" width={44} height={44} className="size-11 rounded-full border border-current object-cover" />
              <span className="w-full truncate text-center text-xs font-bold text-[var(--foreground)]" title={entry.studentName}>{entry.studentName}</span>
              {entry.studentId === ranking.currentStudentId && <span className="text-[10px] font-bold">Vos</span>}
              <strong className="text-sm">{entry.total.toLocaleString("es-AR")} pts</strong>
            </li>)}
          </ol>
          </>}
      </div>
      {entries.length > 0 && <>
        <ol className="sports-featured" start={4} aria-label="Posiciones destacadas">
          {featured.map((entry, index) => <RankingRow key={entry.studentId} entry={entry} currentStudentId={ranking.currentStudentId} delay={65 + index * 40} reducedMotion={reducedMotion} />)}
        </ol>

        {pinnedCurrent && <section className="mt-2" aria-label="Tu posición en el ranking">
          <ol start={pinnedCurrent.position}>
            <RankingRow entry={pinnedCurrent} currentStudentId={ranking.currentStudentId} delay={90} reducedMotion={reducedMotion} />
          </ol>
        </section>}

        {remainder.length > 0 && <section className="mt-7" aria-labelledby="ranking-completo-title">
          <h2 id="ranking-completo-title" className="mb-3 text-[10px] font-black uppercase tracking-[.2em] text-zinc-500">Ranking completo</h2>
          <ol className="space-y-2" start={FEATURED_RANKING_SIZE + 1}>
            {remainder.map((entry, index) => <RankingRow key={entry.studentId} entry={entry} currentStudentId={ranking.currentStudentId} delay={Math.min(90 + index * 25, 150)} reducedMotion={reducedMotion} />)}
          </ol>
        </section>}
      </>}

      <footer className="sports-month mt-5"><span><svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v5m8-5v5M4 11h16m-12 4h2m4 0h2m-8 3h2"/></svg>Mes actual · <strong>{month.charAt(0).toUpperCase() + month.slice(1)}</strong></span><span>{remainingDays === 0 ? "Último día" : `${remainingDays} ${remainingDays === 1 ? "día restante" : "días restantes"}`}</span></footer>
    </>}
  </div>;
}
