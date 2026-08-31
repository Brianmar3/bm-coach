"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, type AnimationEvent, type ReactNode, type TransitionEvent } from "react";

const SPLASH_DURATION_MS = 1_450;
const REDUCED_MOTION_DURATION_MS = 120;

type SplashPhase = "showing" | "exiting" | "hidden";

export function BmTrainingSplash({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<SplashPhase>("showing");
  const [animationStarted, setAnimationStarted] = useState(false);

  const finish = useCallback((immediate = false) => {
    if (immediate) {
      setPhase("hidden");
      return;
    }
    setPhase("exiting");
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setAnimationStarted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (phase !== "showing" || !animationStarted) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = reducedMotion ? setTimeout(() => finish(), REDUCED_MOTION_DURATION_MS) : null;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      if (timer) clearTimeout(timer);
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [animationStarted, finish, phase]);

  const completeVisibleAnimation = (event: AnimationEvent<HTMLImageElement>) => {
    if (event.animationName === "bm-splash-logo-finish") finish();
  };

  const completeExit = (event: TransitionEvent<HTMLDivElement>) => {
    if (phase === "exiting" && event.propertyName === "opacity") setPhase("hidden");
  };

  const hideContent = phase === "showing";

  return <>
    {phase !== "hidden" && <div
      role="status"
      data-animation-duration={SPLASH_DURATION_MS}
      onTransitionEnd={completeExit}
      aria-label="Presentación de BM Training"
      className={`bm-app-splash fixed inset-0 z-[200] grid h-[100dvh] w-screen place-items-center overflow-hidden bg-black p-6 sm:p-10 ${animationStarted ? "bm-app-splash--playing" : ""} ${phase === "exiting" ? "bm-app-splash--exiting" : ""}`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "grid",
        width: "100vw",
        height: "100dvh",
        placeItems: "center",
        overflow: "hidden",
        padding: "clamp(1.5rem, 4vw, 2.5rem)",
        backgroundColor: "#000000",
      }}
    >
      <div
        className="bm-app-splash-stage relative grid aspect-square place-items-center"
        style={{
          position: "relative",
          display: "grid",
          width: "min(88vw, 74dvh, 42rem)",
          maxWidth: "calc(100vw - 2rem)",
          aspectRatio: "1 / 1",
          placeItems: "center",
        }}
      >
        <svg
          className="bm-app-splash-ring absolute inset-0 size-full overflow-visible"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          viewBox="0 0 200 200"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="bm-splash-ring-gold" x1="30" y1="28" x2="170" y2="172" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#f59e0b" />
              <stop offset="0.5" stopColor="#fde68a" />
              <stop offset="1" stopColor="#d97706" />
            </linearGradient>
            <linearGradient id="bm-splash-ring-glint" x1="70.95" y1="10.6" x2="100" y2="6" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#f59e0b" stopOpacity="0" />
              <stop offset="0.52" stopColor="#facc15" stopOpacity="0.68" />
              <stop offset="0.82" stopColor="#fde68a" />
              <stop offset="1" stopColor="#fffbea" />
            </linearGradient>
          </defs>
          <circle className="bm-splash-ring-base" cx="100" cy="100" r="94" fill="none" stroke="url(#bm-splash-ring-gold)" strokeWidth="0.9" vectorEffect="non-scaling-stroke" />
          <g className="bm-splash-orbit">
            <path d="M 70.95 10.6 A 94 94 0 0 1 100 6" fill="none" stroke="url(#bm-splash-ring-glint)" strokeWidth="1.9" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <circle className="bm-splash-orbit-spark" cx="100" cy="6" r="1.65" fill="#fffbea" />
          </g>
        </svg>
        <div
          className="bm-app-splash-logo relative z-10 w-[96%]"
          style={{ position: "relative", zIndex: 10, width: "96%" }}
        >
          <Image
            src="/bm-training-splash.png"
            alt="BM Training — Gestión, entrenamiento y seguimiento"
            width={1536}
            height={1024}
            preload
            sizes="(max-width: 640px) 84vw, 645px"
            onError={() => finish(true)}
            onAnimationEnd={completeVisibleAnimation}
            className="bm-app-splash-logo-image h-auto w-full object-contain"
            style={{ display: "block", width: "100%", height: "auto", objectFit: "contain" }}
          />
        </div>
      </div>
    </div>}
    <div
      className={`contents ${phase === "exiting" ? "bm-splash-content-enter" : ""}`}
      style={{ visibility: hideContent ? "hidden" : undefined }}
    >
      {children}
    </div>
  </>;
}
