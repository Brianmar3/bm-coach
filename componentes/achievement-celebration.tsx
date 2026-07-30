"use client";

import { useCallback, useEffect, useState } from "react";

type Celebration = {
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

const particles = [
  ["12%", "16%", "0ms"], ["25%", "8%", "180ms"], ["41%", "13%", "80ms"],
  ["58%", "7%", "260ms"], ["75%", "15%", "120ms"], ["88%", "9%", "320ms"],
  ["17%", "72%", "240ms"], ["32%", "84%", "40ms"], ["51%", "78%", "300ms"],
  ["69%", "86%", "160ms"], ["82%", "73%", "360ms"], ["93%", "62%", "100ms"],
] as const;

export function AchievementCelebration() {
  const [achievement, setAchievement] = useState<Celebration | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const check = useCallback(async () => {
    if (achievement || saving) return;
    const response = await fetch("/api/portal/achievements/celebration", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) return;
    const body = await response.json() as { achievement?: Celebration | null };
    setAchievement(body.achievement ?? null);
  }, [achievement, saving]);

  useEffect(() => {
    const initial = window.setTimeout(() => void check(), 0);
    const interval = window.setInterval(() => void check(), 15000);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    window.addEventListener("bm:achievement-check", onFocus);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("bm:achievement-check", onFocus);
    };
  }, [check]);

  async function complete(openAchievement: boolean) {
    if (!achievement || saving) return;
    setSaving(true);
    setError("");
    const response = await fetch("/api/portal/achievements/celebration", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: achievement.notificationId }),
    }).catch(() => null);
    if (!response?.ok) {
      setError("No pudimos guardar la confirmación. Intentá nuevamente.");
      setSaving(false);
      return;
    }
    setAchievement(null);
    setSaving(false);
    if (openAchievement) {
      window.location.assign("/portal#logros");
      return;
    }
    window.setTimeout(() => void check(), 250);
  }

  if (!achievement) return null;
  return (
    <div className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-black/80 p-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="achievement-celebration-title" className="relative w-full max-w-md overflow-hidden rounded-3xl border border-yellow-400/35 bg-gradient-to-b from-[#1a170d] via-zinc-950 to-black p-6 text-center shadow-[0_0_70px_rgba(250,204,21,.16)] sm:p-8">
        {particles.map(([left, top, delay], index) => (
          <span key={`${left}-${top}`} aria-hidden="true" className={`absolute h-1.5 w-1.5 rotate-45 bg-yellow-400 animate-ping motion-reduce:animate-none ${index % 3 === 0 ? "opacity-60" : "opacity-90"}`} style={{ left, top, animationDelay: delay, animationDuration: "1.8s" }} />
        ))}
        <div aria-hidden="true" className="relative mx-auto grid h-20 w-20 place-items-center rounded-full border border-yellow-300/50 bg-yellow-400/10 text-4xl shadow-[0_0_35px_rgba(250,204,21,.3)] animate-pulse motion-reduce:animate-none">
          {achievement.icon || "◆"}
        </div>
        <p className="mt-5 text-[11px] font-black uppercase tracking-[.22em] text-yellow-400">¡Nuevo logro desbloqueado!</p>
        <h2 id="achievement-celebration-title" className="mt-2 text-2xl font-black text-white">{achievement.name}</h2>
        {achievement.exercise && <p className="mt-2 font-semibold text-yellow-200">{achievement.exercise}</p>}
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-400">{achievement.description}</p>
        {(achievement.previousValue || achievement.newValue) && (
          <p className="mt-4 rounded-xl border border-yellow-400/10 bg-black/45 px-3 py-2 text-sm text-zinc-300">
            {achievement.previousValue ? `${achievement.previousValue} → ` : ""}<strong className="text-yellow-300">{achievement.newValue}</strong>
          </p>
        )}
        {achievement.points > 0 && <p className="mt-4 text-lg font-black text-yellow-300">+{achievement.points} puntos</p>}
        {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button type="button" disabled={saving} onClick={() => void complete(true)} className="min-h-11 rounded-xl border border-yellow-400/30 px-3 text-sm font-bold text-yellow-200 disabled:opacity-50">Ver logro</button>
          <button type="button" disabled={saving} onClick={() => void complete(false)} className="min-h-11 rounded-xl bg-yellow-400 px-3 text-sm font-black text-zinc-950 disabled:opacity-50">{saving ? "Guardando…" : "Continuar"}</button>
        </div>
      </section>
    </div>
  );
}
