"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CelebrationDialog } from "@/componentes/celebration-dialog";
import { enqueueCelebrations, reconcileWeeklyCelebration, weeklyCelebrationConfirmed, weeklyCelebrationKey, type CelebratableWeeklyMission, type CelebrationAchievement, type PortalCelebration } from "@/lib/portal-celebrations";
export type { CelebrationAchievement } from "@/lib/portal-celebrations";

export function announceNewAchievements(items: CelebrationAchievement[] | undefined) {
  if (!items?.length || typeof window === "undefined") return;
  window.queueMicrotask(() => window.dispatchEvent(new CustomEvent("bm:new-achievements", { detail: items })));
}

const CelebrationContext = createContext<{ confirmed: ReadonlySet<string>; syncWeekly: (mission: CelebratableWeeklyMission | null) => void } | null>(null);

export function useWeeklyMissionCelebration(mission: CelebratableWeeklyMission | null) {
  const context = useContext(CelebrationContext);
  const sync = context?.syncWeekly;
  useEffect(() => { sync?.(mission); }, [mission, sync]);
  useEffect(() => () => sync?.(null), [sync]);
  return weeklyCelebrationConfirmed(mission, context?.confirmed ?? new Set<string>());
}

export function AchievementCelebration({ children, isHome = false, achievementsHref = "/portal/puntos" }: { children: ReactNode; isHome?: boolean; achievementsHref?: string }) {
  const router = useRouter();
  const [queue, setQueue] = useState<PortalCelebration[]>([]);
  const [confirmed, setConfirmed] = useState<ReadonlySet<string>>(new Set());
  const confirmedRef = useRef(new Set<string>());
  const [homeReady, setHomeReady] = useState(false);
  const [visible, setVisible] = useState(true);
  const checking = useRef(false);
  const alive = useRef(true);
  const [current, setCurrent] = useState<PortalCelebration | null>(null);
  const [retry, setRetry] = useState(0);
  const claiming = useRef(false);
  const activeWeeklyKey = useRef<string | null>(null);
  const candidate = visible && (!isHome || homeReady) ? queue[0] : undefined;

  const enqueue = useCallback((items: CelebrationAchievement[]) => {
    setQueue(existing => enqueueCelebrations(existing, items.map(achievement => ({ kind: "achievement", key: achievement.notificationId, achievement })), confirmedRef.current));
  }, []);
  const syncWeekly = useCallback((mission: CelebratableWeeklyMission | null) => {
    setHomeReady(true);
    if (mission) {
      activeWeeklyKey.current = weeklyCelebrationKey(mission);
      setCurrent(item => item?.kind === "weekly" && item.key !== activeWeeklyKey.current ? null : item);
    }
    setQueue(existing => reconcileWeeklyCelebration(existing, mission, confirmedRef.current));
  }, []);
  const check = useCallback(async () => {
    if (checking.current || document.visibilityState !== "visible") return;
    checking.current = true;
    try {
      const response = await fetch("/api/portal/achievements/celebration", { cache: "no-store" });
      if (!response.ok) return;
      const body = await response.json() as { achievement?: CelebrationAchievement | null };
      if (alive.current) {
        if (body.achievement) enqueue([body.achievement]);
        setRetry(value => value + 1);
      }
    } catch { /* Retry on the next existing refresh trigger. */ }
    finally { checking.current = false; }
  }, [enqueue]);

  useEffect(() => {
    alive.current = true;
    const onFocus = () => void check();
    const onVisibility = () => { setVisible(document.visibilityState === "visible"); if (document.visibilityState === "visible") void check(); };
    const onAchievements = (event: Event) => {
      const detail = (event as CustomEvent<CelebrationAchievement[]>).detail;
      if (Array.isArray(detail)) enqueue(detail);
    };
    const onMessage = (event: MessageEvent) => { if (event.data?.type === "BM_ACHIEVEMENT_AVAILABLE") void check(); };
    const initial = window.setTimeout(onVisibility, 0);
    const interval = window.setInterval(() => void check(), 10000);
    window.addEventListener("online", onFocus);
    window.addEventListener("focus", onFocus); window.addEventListener("pageshow", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("bm:achievement-check", onFocus); window.addEventListener("bm:new-achievements", onAchievements);
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      alive.current = false;
      window.clearTimeout(initial); window.clearInterval(interval);
      window.removeEventListener("online", onFocus);
      window.removeEventListener("focus", onFocus); window.removeEventListener("pageshow", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("bm:achievement-check", onFocus); window.removeEventListener("bm:new-achievements", onAchievements);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [check, enqueue]);

  const forget = useCallback((key: string) => {
    confirmedRef.current.add(key);
    setConfirmed(new Set(confirmedRef.current));
    setQueue(items => items.filter(item => item.key !== key));
    window.dispatchEvent(new Event("bm:portal-data-refresh"));
  }, []);

  useEffect(() => {
    if (!candidate || current || claiming.current || document.visibilityState !== "visible") return;
    claiming.current = true;
    void fetch("/api/portal/achievements/celebration", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(candidate.kind === "weekly"
        ? { kind: "weekly", key: candidate.key }
        : { notificationId: candidate.achievement.notificationId }),
    }).then(async response => {
      if (!response.ok) return;
      const body = await response.json() as { celebration: PortalCelebration | null };
      if (!alive.current) return;
      if (body.celebration) {
        if (body.celebration.kind !== "weekly" || body.celebration.key === activeWeeklyKey.current) {
          setCurrent(body.celebration);
        } else {
          forget(candidate.key);
        }
      } else {
        forget(candidate.key);
      }
    }).catch(() => { /* Retry after the next successful poll or reconnection. */ })
      .finally(() => { claiming.current = false; });
  }, [candidate, current, forget, retry]);

  const complete = (item: PortalCelebration, visitAchievements = false) => {
    setCurrent(null);
    forget(item.key);
    if (visitAchievements) router.push(achievementsHref);
    void check();
  };
  const context = useMemo(() => ({ confirmed, syncWeekly }), [confirmed, syncWeekly]);
  return <CelebrationContext.Provider value={context}>
    {children}
    {current && <CelebrationDialog key={current.key} item={current} remaining={Math.max(0, queue.filter(item => item.key !== current.key).length)} saving={false} error="" onContinue={() => void complete(current)} onAchievements={() => void complete(current, true)} />}
  </CelebrationContext.Provider>;
}
