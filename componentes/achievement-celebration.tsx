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
  ["12%", "16%", "0ms"], ["25%", "8%", "180ms"], ["41%", "13%", "80ms"],
  ["58%", "7%", "260ms"], ["75%", "15%", "120ms"], ["88%", "9%", "320ms"],
  ["17%", "72%", "240ms"], ["32%", "84%", "40ms"], ["51%", "78%", "300ms"],
  ["69%", "86%", "160ms"], ["82%", "73%", "360ms"], ["93%", "62%", "100ms"],
] as const;

export function AchievementCelebration() {
  const [queue, setQueue] = useState<CelebrationAchievement[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const completed = useRef(new Set<string>());
  const current = queue[0] ?? null;

  const enqueue = useCallback((items: CelebrationAchievement[]) => {
    setQueue((existing) => {
      const ids = new Set(existing.map((item) => item.notificationId));
      const additions = items.filter((item) => !ids.has(item.notificationId) && !completed.current.has(item.notificationId));
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
    const interval = window.setInterval(() => void check(), 30000);
    const onFocus = () => void check();
    const onAchievements = (event: Event) => {
      const detail = (event as CustomEvent<CelebrationAchievement[]>).detail;
      if (Array.isArray(detail)) enqueue(detail);
    };
    const onServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === "BM_ACHIEVEMENT_AVAILABLE") void check();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("bm:achievement-check", onFocus);
    window.addEventListener("bm:new-achievements", onAchievements);
    navigator.serviceWorker?.addEventListener("message", onServiceWorkerMessage);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("bm:achievement-check", onFocus);
      window.removeEventListener("bm:new-achievements", onAchievements);
      navigator.serviceWorker?.removeEventListener("message", onServiceWorkerMessage);
    };
  }, [check, enqueue]);

  async function complete(openAchievement: boolean) {
    if (!current || saving) return;
    setSaving(true);
    setError("");
    const response = await fetch("/api/portal/achievements/celebration", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: current.notificationId }),
    }).catch(() => null);
    if (!response?.ok) {
      setError("No pudimos guardar la confirmación. Intentá nuevamente.");
      setSaving(false);
      return;
    }
    completed.current.add(current.notificationId);
    setQueue((items) => items.filter((item) => item.notificationId !== current.notificationId));
    setSaving(false);
    window.dispatchEvent(new Event("bm:portal-data-refresh"));
    if (openAchievement) {
      window.location.assign("/portal#logros");
      return;
    }
    window.setTimeout(() => void check(), 0);
  }

  if (!current) return null;
  return (
    <div className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-black/80 p-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="achievement-celebration-title" className="relative w-full max-w-md overflow-hidden rounded-3xl border border-yellow-400/35 bg-gradient-to-b from-[#1a170d] via-zinc-950 to-black p-6 text-center shadow-[0_0_70px_rgba(250,204,21,.16)] sm:p-8">
        {particles.map(([left, top, delay], index) => (
          <span key={`${left}-${top}`} aria-hidden="true" className={`absolute h-1.5 w-1.5 rotate-45 animate-ping bg-yellow-400 motion-reduce:animate-none ${index % 3 === 0 ? "opacity-60" : "opacity-90"}`} style={{ left, top, animationDelay: delay, animationDuration: "1.8s" }} />
        ))}
        <div aria-hidden="true" className="relative mx-auto grid h-20 w-20 animate-pulse place-items-center rounded-full border border-yellow-300/50 bg-yellow-400/10 text-4xl shadow-[0_0_35px_rgba(250,204,21,.3)] motion-reduce:animate-none">{current.icon || "◆"}</div>
        <p className="mt-5 text-[11px] font-black uppercase tracking-[.22em] text-yellow-400">¡Nuevo logro desbloqueado!</p>
        <h2 id="achievement-celebration-title" className="mt-2 text-2xl font-black text-white">{current.name}</h2>
        {current.exercise && <p className="mt-2 font-semibold text-yellow-200">{current.exercise}</p>}
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-400">{current.description}</p>
        {(current.previousValue || current.newValue) && <p className="mt-4 rounded-xl border border-yellow-400/10 bg-black/45 px-3 py-2 text-sm text-zinc-300">{current.previousValue ? `${current.previousValue} → ` : ""}<strong className="text-yellow-300">{current.newValue}</strong></p>}
        {current.points > 0 && <p className="mt-4 text-lg font-black text-yellow-300">+{current.points} puntos</p>}
        {queue.length > 1 && <p className="mt-2 text-xs text-zinc-500">Quedan {queue.length - 1} logro{queue.length === 2 ? "" : "s"} por mostrar.</p>}
        {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button type="button" disabled={saving} onClick={() => void complete(true)} className="min-h-11 rounded-xl border border-yellow-400/30 px-3 text-sm font-bold text-yellow-200 disabled:opacity-50">Ver logro</button>
          <button type="button" disabled={saving} onClick={() => void complete(false)} className="min-h-11 rounded-xl bg-yellow-400 px-3 text-sm font-black text-zinc-950 disabled:opacity-50">{saving ? "Guardando…" : "Continuar"}</button>
        </div>
      </section>
    </div>
  );
}
