"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CelebrationAchievement = {
  notificationId: string;
  id: string;
  icon: string;
  name: string;
  description: string;
  exercise: string | null;
  previousValue: string | null;
  newValue: string | null;
  unlockedAt: string;
  points: number;
};

export function announceNewAchievements(items: CelebrationAchievement[] | undefined) {
  if (!items?.length || typeof window === "undefined") return;
  window.queueMicrotask(() => {
    window.dispatchEvent(new CustomEvent("bm:new-achievements", { detail: items }));
  });
}

const particles = [
  ["8%", "22%", "0ms"], ["22%", "8%", "180ms"], ["43%", "12%", "80ms"],
  ["68%", "9%", "260ms"], ["84%", "20%", "120ms"], ["92%", "58%", "320ms"],
] as const;

export function AchievementCelebration() {
  const [queue, setQueue] = useState<CelebrationAchievement[]>([]);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"enter" | "visible" | "exit">("enter");
  const completed = useRef(new Set<string>());
  const completedAchievements = useRef(new Set<string>());
  const saving = useRef(false);
  const current = queue[0] ?? null;

  const enqueue = useCallback((items: CelebrationAchievement[]) => {
    setQueue((existing) => {
      const notificationIds = new Set(existing.map((item) => item.notificationId));
      const achievementIds = new Set(existing.map((item) => item.id));
      const additions = items.filter((item) => (
        !notificationIds.has(item.notificationId)
        && !achievementIds.has(item.id)
        && !completed.current.has(item.notificationId)
        && !completedAchievements.current.has(item.id)
      ));
      return additions.length ? [...existing, ...additions] : existing;
    });
  }, []);

  const check = useCallback(async () => {
    const response = await fetch("/api/portal/achievements/celebration", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) return;
    const body = await response.json() as { achievement?: CelebrationAchievement | null };
    if (body.achievement) enqueue([body.achievement]);
  }, [enqueue]);

  useEffect(() => {
    const initial = window.setTimeout(() => void check(), 0);
    const interval = window.setInterval(() => void check(), 10000);
    const onFocus = () => void check();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void check();
    };
    const onAchievements = (event: Event) => {
      const detail = (event as CustomEvent<CelebrationAchievement[]>).detail;
      if (Array.isArray(detail)) enqueue(detail);
    };
    const onServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === "BM_ACHIEVEMENT_AVAILABLE") void check();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("bm:achievement-check", onFocus);
    window.addEventListener("bm:new-achievements", onAchievements);
    navigator.serviceWorker?.addEventListener("message", onServiceWorkerMessage);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("bm:achievement-check", onFocus);
      window.removeEventListener("bm:new-achievements", onAchievements);
      navigator.serviceWorker?.removeEventListener("message", onServiceWorkerMessage);
    };
  }, [check, enqueue]);

  const complete = useCallback(async (item: CelebrationAchievement) => {
    if (saving.current) return;
    saving.current = true;
    setError("");
    const response = await fetch("/api/portal/achievements/celebration", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: item.notificationId }),
    }).catch(() => null);
    if (!response?.ok) {
      setError("No pudimos guardar la confirmación. Intentá nuevamente.");
      setPhase("visible");
      saving.current = false;
      return;
    }
    completed.current.add(item.notificationId);
    completedAchievements.current.add(item.id);
    setQueue((items) => items.filter((queued) => queued.notificationId !== item.notificationId));
    saving.current = false;
    window.dispatchEvent(new Event("bm:portal-data-refresh"));
    window.setTimeout(() => void check(), 0);
  }, [check]);

  useEffect(() => {
    if (!current) return;
    const prepare = window.setTimeout(() => {
      setError("");
      setPhase("enter");
    }, 0);
    const reveal = window.setTimeout(() => setPhase("visible"), 20);
    const leave = window.setTimeout(() => setPhase("exit"), 1540);
    const acknowledge = window.setTimeout(() => void complete(current), 1780);
    return () => {
      window.clearTimeout(prepare);
      window.clearTimeout(reveal);
      window.clearTimeout(leave);
      window.clearTimeout(acknowledge);
    };
  }, [complete, current]);

  if (!current) return null;
  return (
    <div className="pointer-events-none fixed inset-x-4 top-[calc(env(safe-area-inset-top)+5.25rem)] z-[120] mx-auto max-w-sm">
      <section
        role="status"
        aria-live="polite"
        aria-labelledby="achievement-celebration-title"
        className={`relative overflow-hidden rounded-2xl border border-yellow-400/35 bg-gradient-to-r from-[#19150a] via-zinc-950 to-black p-4 transition-opacity duration-200 motion-safe:transition-[opacity,transform,box-shadow] motion-safe:duration-200 ${phase === "visible" ? "opacity-100 motion-safe:translate-y-0 motion-safe:scale-100 motion-safe:shadow-[0_0_38px_rgba(250,204,21,.16)]" : "opacity-0 motion-safe:-translate-y-2 motion-safe:scale-[.98]"}`}
      >
        {particles.map(([left, top, delay], index) => (
          <span key={`${left}-${top}`} aria-hidden="true" className={`absolute hidden h-1 w-1 rotate-45 bg-yellow-400 motion-safe:block motion-safe:animate-ping ${index % 3 === 0 ? "opacity-50" : "opacity-80"}`} style={{ left, top, animationDelay: delay, animationDuration: "1.4s" }} />
        ))}
        <div className="relative flex items-start gap-3">
          <div aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-yellow-300/40 bg-yellow-400/10 text-xl motion-safe:shadow-[0_0_20px_rgba(250,204,21,.2)]">{current.icon || "◆"}</div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-yellow-400">¡Nuevo logro desbloqueado!</p>
            <h2 id="achievement-celebration-title" className="mt-1 text-lg font-black leading-tight text-white">{current.name}</h2>
            {current.exercise && <p className="mt-1 truncate text-sm font-semibold text-yellow-200">{current.exercise}</p>}
            {(current.previousValue || current.newValue) && <p className="mt-1 text-xs text-zinc-400">{current.previousValue ? `${current.previousValue} → ` : ""}<strong className="text-yellow-300">{current.newValue}</strong></p>}
          </div>
          {current.points > 0 && <p className="shrink-0 text-sm font-black text-emerald-300">+{current.points} pts</p>}
        </div>
        {queue.length > 1 && <p className="relative mt-2 text-right text-[10px] text-zinc-500">Siguiente logro en cola: {queue.length - 1}</p>}
        {error && <div className="pointer-events-auto relative mt-3 flex items-center justify-between gap-3"><p role="alert" className="text-xs text-red-300">{error}</p><button type="button" onClick={() => void complete(current)} className="min-h-9 shrink-0 rounded-lg border border-yellow-400/30 px-3 text-xs font-bold text-yellow-200">Reintentar</button></div>}
      </section>
    </div>
  );
}
