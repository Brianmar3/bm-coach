"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { BmTimerIcon } from "@/componentes/icons";
import { useWorkoutTimerAudio } from "@/componentes/use-workout-timer-audio";
import { useNativeTimerNotification } from "@/componentes/use-native-timer-notification";
import { exerciseRestSeconds, finishExerciseRestTimer, formatExerciseRestTime, initialExerciseRestTimer, reduceExerciseRestTimer, type ExerciseRestTimerState } from "@/lib/exercise-rest-timer";

const FINISH_SOUND = ["restFinish"] as const;
const STORAGE_KEY = "bm-portal-rest-timer-v2";
const LEGACY_STORAGE_KEY = "bm-portal-rest-timer-v1";

type RestTimerContextValue = {
  timer: ExerciseRestTimerState | null;
  nowMs: number;
  primaryAction: (exerciseId: string, durationSeconds: number, exerciseName: string) => void;
  reset: (exerciseId: string, durationSeconds: number) => void;
};

type StoredRestTimer = {
  exerciseId: string;
  originalDuration: number;
  endTimestamp: number;
  status: "running";
};

const RestTimerContext = createContext<RestTimerContextValue | null>(null);

function restoreRunningTimer(raw: string | null, nowMs: number): ExerciseRestTimerState | null {
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as Partial<StoredRestTimer>;
    if (stored.status !== "running" || typeof stored.exerciseId !== "string" || !stored.exerciseId || typeof stored.originalDuration !== "number" || stored.originalDuration <= 0 || typeof stored.endTimestamp !== "number" || stored.endTimestamp <= nowMs) return null;
    return {
      ...initialExerciseRestTimer(stored.exerciseId, stored.originalDuration),
      remainingSeconds: Math.ceil((stored.endTimestamp - nowMs) / 1_000),
      endTimestamp: stored.endTimestamp,
      status: "running",
    };
  } catch {
    return null;
  }
}

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [timer, setTimer] = useState<ExerciseRestTimerState | null>(null);
  const [nowMs, setNowMs] = useState(Date.now);
  const [hydrated, setHydrated] = useState(false);
  const timerRef = useRef<ExerciseRestTimerState | null>(null);
  const notifiedRunsRef = useRef(new Set<number>());
  const { feedback, prime } = useWorkoutTimerAudio(FINISH_SOUND);

  const updateTimer = useCallback((next: ExerciseRestTimerState | null) => {
    timerRef.current = next;
    setTimer(next);
  }, []);

  const tick = useCallback(() => {
    const current = timerRef.current;
    if (current?.status !== "running" || current.endTimestamp === null) return;
    const tickTime = Date.now();
    setNowMs(tickTime);
    if (exerciseRestSeconds(current, tickTime) > 0) return;
    const runId = current.endTimestamp;
    updateTimer(finishExerciseRestTimer(current));
    localStorage.removeItem(STORAGE_KEY);
    if (current.notified || notifiedRunsRef.current.has(runId)) return;
    notifiedRunsRef.current.add(runId);
    if (document.visibilityState === "visible") feedback("restFinish", false);
  }, [feedback, updateTimer]);

  const { cancelNativeNotification, prepareNativeNotification, startNativeNotification } = useNativeTimerNotification({
    key: `rest:${timer?.exerciseId ?? "none"}`,
    title: "BM Training · Descanso",
    body: "Ejercicio en curso",
    endAt: timer?.endTimestamp ?? 0,
    type: "REST",
    completionTitle: "Descanso terminado",
    completionBody: "Ya podés comenzar tu próxima serie.",
    running: timer?.status === "running" && timer.endTimestamp !== null,
    onForeground: (active) => {
      const current = timerRef.current;
      if (current?.status === "running" && active?.active && active.timerId === `rest:${current.exerciseId}` && typeof active.endAt === "number" && active.endAt > Date.now() && active.endAt !== current.endTimestamp) {
        updateTimer({ ...current, endTimestamp: active.endAt, remainingSeconds: Math.ceil((active.endAt - Date.now()) / 1_000) });
      }
      tick();
    },
  });

  useEffect(() => {
    const restoreId = window.setTimeout(() => {
      const raw = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(LEGACY_STORAGE_KEY);
      const restored = restoreRunningTimer(raw, Date.now());
      sessionStorage.removeItem(LEGACY_STORAGE_KEY);
      timerRef.current = restored;
      setTimer(restored);
      setNowMs(Date.now());
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(restoreId);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (timer?.status === "running" && timer.endTimestamp !== null && timer.endTimestamp > Date.now()) {
      const stored: StoredRestTimer = { exerciseId: timer.exerciseId, originalDuration: timer.durationSeconds, endTimestamp: timer.endTimestamp, status: "running" };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [hydrated, timer]);

  useEffect(() => {
    if (timer?.status !== "running") return;
    tick();
    const intervalId = window.setInterval(tick, 250);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [tick, timer?.status]);

  const primaryAction = useCallback((exerciseId: string, durationSeconds: number, exerciseName: string) => {
    const actionTime = Date.now();
    setNowMs(actionTime);
    const current = timerRef.current;
    let next: ExerciseRestTimerState;
    if (!current || current.exerciseId !== exerciseId || current.durationSeconds !== durationSeconds) {
      prime("restFinish");
      next = reduceExerciseRestTimer(initialExerciseRestTimer(exerciseId, durationSeconds), "START", actionTime);
    } else if (current.status === "ready") {
      prime("restFinish");
      next = reduceExerciseRestTimer(current, "START", actionTime);
    } else if (current.status === "running") next = reduceExerciseRestTimer(current, "PAUSE", actionTime);
    else if (current.status === "paused") next = reduceExerciseRestTimer(current, "RESUME", actionTime);
    else next = reduceExerciseRestTimer(current, "RESET", actionTime);
    if (next.status === "running" && next.endTimestamp !== null) {
      prepareNativeNotification();
      void startNativeNotification({ key: `rest:${exerciseId}`, title: "BM Training · Descanso", body: exerciseName, endAt: next.endTimestamp, type: "REST", completionTitle: "Descanso terminado", completionBody: `Terminó el descanso de ${exerciseName}.` });
    }
    else void cancelNativeNotification();
    updateTimer(next);
  }, [cancelNativeNotification, prepareNativeNotification, prime, startNativeNotification, updateTimer]);

  const reset = useCallback((exerciseId: string, durationSeconds: number) => {
    void cancelNativeNotification();
    const current = timerRef.current;
    updateTimer(current?.exerciseId === exerciseId
      ? reduceExerciseRestTimer(current, "RESET", Date.now())
      : initialExerciseRestTimer(exerciseId, durationSeconds));
  }, [cancelNativeNotification, updateTimer]);

  return <RestTimerContext.Provider value={{ timer, nowMs, primaryAction, reset }}>{children}</RestTimerContext.Provider>;
}

export function useExerciseRestTimer() {
  const context = useContext(RestTimerContext);
  if (!context) throw new Error("useExerciseRestTimer debe usarse dentro de RestTimerProvider");
  return context;
}

export function RestTimerIndicator() {
  const pathname = usePathname();
  const { timer, nowMs } = useExerciseRestTimer();
  if (!timer || !["running", "paused"].includes(timer.status) || pathname.startsWith("/portal/rutina") || pathname.startsWith("/portal/entrenamiento")) return null;
  return <Link href="/portal/rutina" aria-label="Volver a la rutina para ver el descanso" className="fixed bottom-[calc(env(safe-area-inset-bottom)+var(--portal-bottom-nav-offset)+var(--portal-bottom-nav-height)+.5rem)] right-5 z-40 flex min-h-11 items-center gap-2 rounded-full border border-yellow-400/35 bg-zinc-950/95 px-3 text-xs font-bold text-yellow-200 shadow-xl backdrop-blur md:bottom-6 md:right-6">
    <BmTimerIcon size={16} aria-hidden="true" />
    <span>Descanso {formatExerciseRestTime(exerciseRestSeconds(timer, nowMs))}</span>
  </Link>;
}
