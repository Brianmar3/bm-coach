"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function RoutineOverlay({ open, onClose, labelledBy, children, maxWidth = "max-w-lg", closeOnBackdrop = true }: { open: boolean; onClose: () => void; labelledBy: string; children: ReactNode; maxWidth?: "max-w-lg" | "max-w-xl"; closeOnBackdrop?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open]);

  if (!open) return null;
  return createPortal(
    <div role="presentation" onPointerDown={(event) => { if (closeOnBackdrop && event.target === event.currentTarget) onClose(); }} className="fixed inset-0 z-[210] flex items-center justify-center overflow-hidden bg-black/80 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby={labelledBy} className={`flex max-h-[min(90dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem))] w-full ${maxWidth} flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-[#0b0b0b] text-white shadow-2xl`}>
        {children}
      </section>
    </div>,
    document.body,
  );
}
