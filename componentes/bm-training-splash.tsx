"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const SPLASH_SESSION_KEY = "bmTrainingSplashShown";
const SPLASH_DURATION_MS = 1_000;
const EXIT_DURATION_MS = 140;

type SplashPhase = "checking" | "showing" | "exiting" | "hidden";

export function BmTrainingSplash({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<SplashPhase>("checking");
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = useCallback((immediate = false) => {
    try {
      window.sessionStorage.setItem(SPLASH_SESSION_KEY, "true");
    } catch {
      // Storage can be unavailable. The presentation must still close.
    }
    if (immediate) {
      setPhase("hidden");
      return;
    }
    setPhase("exiting");
    exitTimer.current = setTimeout(() => setPhase("hidden"), EXIT_DURATION_MS);
  }, []);

  useEffect(() => {
    let alreadyShown = false;
    try {
      alreadyShown = window.sessionStorage.getItem(SPLASH_SESSION_KEY) === "true";
    } catch {
      // Continue once when storage is unavailable.
    }
    const frame = window.requestAnimationFrame(() => setPhase(alreadyShown ? "hidden" : "showing"));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (phase !== "showing") return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(() => finish(reducedMotion), SPLASH_DURATION_MS);
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      clearTimeout(timer);
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [finish, phase]);

  useEffect(() => () => {
    if (exitTimer.current) clearTimeout(exitTimer.current);
  }, []);

  const hideContent = phase === "checking" || phase === "showing";

  return <>
    {phase !== "hidden" && <div
      role="status"
      aria-label="Presentación de BM Training"
      className={`fixed inset-0 z-[200] grid h-[100dvh] w-screen place-items-center overflow-hidden bg-black p-6 transition-opacity duration-150 sm:p-10 ${phase === "exiting" ? "opacity-0" : "opacity-100"}`}
    >
      {phase !== "checking" && <Image
        src="/bm-training-splash.png"
        alt="BM Training — Gestión, entrenamiento y seguimiento"
        width={1536}
        height={1024}
        priority
        sizes="(max-width: 640px) 82vw, 520px"
        onError={() => finish(true)}
        className="h-auto max-h-[70dvh] w-full max-w-[520px] object-contain"
      />}
    </div>}
    <div className="contents" style={{ visibility: hideContent ? "hidden" : undefined }}>{children}</div>
  </>;
}
