"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const actions = [
  { label: "Nuevo alumno", href: "/alumnos?accion=nuevo" },
  { label: "Registrar pago", href: "/pagos" },
  { label: "Tomar asistencia", href: "/asistencias" },
  { label: "Nueva evaluación", href: "/evaluaciones" },
  { label: "Crear rutina", href: "/rutinas" },
];

export function DashboardFloatingActions({ enabled = true }: { enabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    function closeEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, []);

  if (!enabled) return null;
  return <div ref={containerRef} className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
    <div className={`grid origin-bottom-right gap-2 transition duration-200 ${open ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`} aria-hidden={!open}>
      {actions.map((action) => <Link key={action.href} href={action.href} onClick={() => setOpen(false)} tabIndex={open ? 0 : -1} className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-right text-sm font-bold shadow-xl hover:border-yellow-400">{action.label}</Link>)}
    </div>
    <button type="button" aria-label={open ? "Cerrar acciones rápidas" : "Abrir acciones rápidas"} aria-expanded={open} onClick={() => setOpen((value) => !value)} className="grid h-14 w-14 place-items-center rounded-full bg-yellow-400 text-3xl text-zinc-950 shadow-2xl">
      <span className={`transition-transform ${open ? "rotate-45" : ""}`} aria-hidden="true">+</span>
    </button>
  </div>;
}
