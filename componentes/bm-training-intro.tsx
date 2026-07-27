"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const INTRO_SESSION_KEY = "bmTrainingIntroShown";
const SAFETY_TIMEOUT_MS = 4_000;
const SKIP_DELAY_MS = 650;
const EXIT_DURATION_MS = 180;

type IntroPhase = "checking" | "playing" | "exiting" | "hidden";

export function BmTrainingIntro({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [phase, setPhase] = useState<IntroPhase>(enabled ? "checking" : "hidden");
  const [canSkip, setCanSkip] = useState(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const finish = useCallback((immediate = false) => {
    try {
      window.sessionStorage.setItem(INTRO_SESSION_KEY, "true");
    } catch {
      // Storage can be unavailable in private browsing. The intro must still close.
    }
    videoRef.current?.pause();
    if (immediate) {
      setPhase("hidden");
      return;
    }
    setPhase("exiting");
    exitTimer.current = setTimeout(() => setPhase("hidden"), EXIT_DURATION_MS);
  }, []);

  useEffect(() => {
    if (!enabled) {
      const frame = window.requestAnimationFrame(() => setPhase("hidden"));
      return () => window.cancelAnimationFrame(frame);
    }
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let alreadyShown = false;
    try {
      alreadyShown = window.sessionStorage.getItem(INTRO_SESSION_KEY) === "true";
    } catch {
      // Continue once when storage is unavailable.
    }
    if (reducedMotion || alreadyShown) {
      if (reducedMotion) {
        try {
          window.sessionStorage.setItem(INTRO_SESSION_KEY, "true");
        } catch {
          // The reduced-motion preference is still honored without storage.
        }
      }
      const frame = window.requestAnimationFrame(() => setPhase("hidden"));
      return () => window.cancelAnimationFrame(frame);
    }
    const frame = window.requestAnimationFrame(() => setPhase("playing"));
    return () => window.cancelAnimationFrame(frame);
  }, [enabled]);

  useEffect(() => {
    if (phase !== "playing") return;
    const skipTimer = setTimeout(() => setCanSkip(true), SKIP_DELAY_MS);
    const safetyTimer = setTimeout(() => finish(true), SAFETY_TIMEOUT_MS);
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      clearTimeout(skipTimer);
      clearTimeout(safetyTimer);
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [finish, phase]);

  useEffect(() => () => {
    if (exitTimer.current) clearTimeout(exitTimer.current);
  }, []);

  return <>
    {phase !== "hidden" && <div
      role="dialog"
      aria-modal="true"
      aria-label="Presentación de BM Training"
      className={`fixed inset-0 z-[200] grid h-[100dvh] w-screen place-items-center overflow-hidden bg-black transition-opacity duration-200 ${phase === "exiting" ? "opacity-0" : "opacity-100"}`}
    >
      {phase !== "checking" && <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        preload="auto"
        controls={false}
        disablePictureInPicture
        aria-hidden="true"
        onEnded={() => finish()}
        onError={() => finish(true)}
        className="h-full w-full object-contain"
      >
        <source src="/bm-training-intro.mp4" type="video/mp4" />
      </video>}
      {canSkip && phase === "playing" && <button
        type="button"
        aria-label="Omitir presentación de BM Training"
        onClick={() => finish()}
        className="absolute right-[calc(env(safe-area-inset-right)+1rem)] top-[calc(env(safe-area-inset-top)+1rem)] min-h-11 rounded-full border border-white/25 bg-black/65 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
      >
        Omitir
      </button>}
    </div>}
    {children}
  </>;
}
