"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const actions = [
  { label: "Nuevo alumno", href: "/alumnos?accion=nuevo", symbol: "+" },
  { label: "Registrar pago", href: "/pagos", symbol: "$" },
  { label: "Tomar asistencia", href: "/asistencias", symbol: "✓" },
  { label: "Crear clase", href: "/clases", symbol: "C" },
  { label: "Nueva evaluación", href: "/evaluaciones", symbol: "E" },
  { label: "Agregar evento", href: "/eventos", symbol: "●" },
] as const;

export function DashboardFloatingActions({ enabled = true }: { enabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  if (!enabled) return null;
  return <>
    <button type="button" aria-label={open ? "Cerrar acciones rápidas" : "Abrir acciones rápidas"} aria-expanded={open} aria-controls="dashboard-quick-actions" onClick={() => setOpen((value) => !value)} className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 z-[65] grid h-14 w-14 place-items-center rounded-full border border-yellow-100/30 bg-yellow-400 text-3xl font-light text-zinc-950 shadow-[0_10px_35px_rgba(250,204,21,.28)] transition hover:bg-yellow-300 active:scale-95 md:bottom-6 md:right-6 md:h-16 md:w-16">
      <span aria-hidden="true" className={`transition-transform ${open ? "rotate-45" : ""}`}>+</span>
    </button>
    {open && <div className="fixed inset-0 z-[60] flex items-end bg-black/70 backdrop-blur-sm md:items-center md:justify-center md:p-6" onPointerDown={() => setOpen(false)}>
      <section ref={dialogRef} id="dashboard-quick-actions" role="dialog" aria-modal="true" aria-labelledby="quick-actions-title" className="w-full rounded-t-3xl border border-yellow-400/15 bg-zinc-950 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl md:max-w-lg md:rounded-3xl md:p-5" onPointerDown={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-zinc-700 md:hidden" />
        <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-yellow-400">BM Training</p><h2 id="quick-actions-title" className="mt-1 text-lg font-bold">Agregar rápido</h2><p className="mt-1 text-xs text-zinc-500">Elegí una acción para continuar.</p></div><button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl text-xl text-zinc-400 hover:bg-zinc-800" aria-label="Cerrar acciones rápidas">×</button></div>
        <div className="mt-4 grid grid-cols-2 gap-2">{actions.map((action) => <Link key={action.label} href={action.href} onClick={() => setOpen(false)} className="flex min-h-16 items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm font-semibold transition hover:border-yellow-400/35 hover:bg-yellow-400/5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-yellow-400/10 font-black text-yellow-300">{action.symbol}</span><span>{action.label}</span></Link>)}</div>
      </section>
    </div>}
  </>;
}
