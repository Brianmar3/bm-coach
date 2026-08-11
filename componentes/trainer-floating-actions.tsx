"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export type TrainerFloatingAction = {
  label: string;
  symbol: ReactNode;
  href?: string;
  onSelect?: () => void;
};

export function TrainerFloatingActions({
  actions,
  enabled = true,
  mode = "menu",
  title = "Acciones rápidas",
  description = "Elegí una acción para continuar.",
}: {
  actions: TrainerFloatingAction[];
  enabled?: boolean;
  mode?: "direct" | "menu";
  title?: string;
  description?: string;
}) {
  const [open, setOpen] = useState(false);
  const dialogId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstActionRef = useRef<HTMLElement | null>(null);

  function close(restoreFocus = true) {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => firstActionRef.current?.focus());
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  if (!enabled || actions.length === 0) return null;
  const directAction = actions[0];
  const floatingClassName = "fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 z-[65] grid h-14 w-14 place-items-center rounded-full border border-yellow-100/30 bg-yellow-400 text-3xl font-light text-zinc-950 shadow-[0_10px_35px_rgba(250,204,21,.28)] transition hover:bg-yellow-300 active:scale-95 md:bottom-6 md:right-6 md:h-16 md:w-16";
  if (mode === "direct") return <>
    <div className="h-20" aria-hidden="true" />
    {directAction.href
      ? <Link href={directAction.href} data-trainer-floating-trigger aria-label={directAction.label} className={floatingClassName}><span aria-hidden="true">+</span></Link>
      : <button type="button" data-trainer-floating-trigger aria-label={directAction.label} onClick={directAction.onSelect} className={floatingClassName}><span aria-hidden="true">+</span></button>}
  </>;
  return <>
    <div className="h-20" aria-hidden="true" />
    <button ref={triggerRef} type="button" data-trainer-floating-trigger aria-label={open ? "Cerrar acciones rápidas" : "Abrir acciones rápidas"} aria-expanded={open} aria-controls={dialogId} onClick={() => setOpen((value) => !value)} className={floatingClassName}>
      <span aria-hidden="true" className={`transition-transform ${open ? "rotate-45" : ""}`}>+</span>
    </button>
    {open && <div className="fixed inset-0 z-[60] flex items-end bg-black/70 backdrop-blur-sm md:items-center md:justify-center md:p-6" onPointerDown={() => close()}>
      <section id={dialogId} role="dialog" aria-modal="true" aria-labelledby={`${dialogId}-title`} className="w-full rounded-t-3xl border border-yellow-400/15 bg-zinc-950 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl md:max-w-lg md:rounded-3xl md:p-5" onPointerDown={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-zinc-700 md:hidden" />
        <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-yellow-400">BM Training</p><h2 id={`${dialogId}-title`} className="mt-1 text-lg font-bold">{title}</h2><p className="mt-1 text-xs text-zinc-500">{description}</p></div><button type="button" onClick={() => close()} className="grid h-10 w-10 place-items-center rounded-xl text-xl text-zinc-400 hover:bg-zinc-800" aria-label="Cerrar acciones rápidas">×</button></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">{actions.map((action, index) => {
          const className = "flex min-h-16 items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-left text-sm font-semibold transition hover:border-yellow-400/35 hover:bg-yellow-400/5";
          const content = <><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-yellow-400/10 font-black text-yellow-300">{action.symbol}</span><span>{action.label}</span></>;
          const ref = index === 0 ? (node: HTMLElement | null) => { firstActionRef.current = node; } : undefined;
          return action.href
            ? <Link ref={ref} key={action.label} href={action.href} onClick={() => close(false)} className={className}>{content}</Link>
            : <button ref={ref} key={action.label} type="button" onClick={() => { close(false); action.onSelect?.(); }} className={className}>{content}</button>;
        })}</div>
      </section>
    </div>}
  </>;
}
