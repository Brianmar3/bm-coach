"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { inputClass } from "@/componentes/module-shell";
import { routineCreationClasses, routineCreationSources } from "@/lib/routine-creation";
import type { TrainingRoutine } from "@/types/gestion";

type Step = "origin" | "class" | "routine";

function exerciseCount(routine: TrainingRoutine) {
  return routine.days.reduce((total, day) => total + (day.blocks.length ? day.blocks.reduce((sum, block) => sum + block.exercises.length, 0) : day.exercises.length), 0);
}
function duration(routine: TrainingRoutine) {
  const minutes = routine.days.reduce((total, day) => total + (day.estimatedMinutes ?? 0), 0);
  return minutes ? `${minutes} min` : "Sin duración";
}
function studentCount(routine: TrainingRoutine) {
  return new Set([...routine.studentIds, ...routine.historicalStudents.map((student) => student.id)]).size;
}

export function RoutineCreationDialog({ routines, busyId, close, createFromScratch, createFromClass, copyRoutine }: {
  routines: TrainingRoutine[]; busyId: string; close: () => void; createFromScratch: () => void;
  createFromClass: (routine: TrainingRoutine) => void; copyRoutine: (routine: TrainingRoutine) => Promise<void>;
}) {
  const [step, setStep] = useState<Step>("origin");
  const [search, setSearch] = useState("");
  const [objective, setObjective] = useState("todos");
  const dialogRef = useRef<HTMLElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const actionInFlight = useRef(false);
  const closeRef = useRef(close);
  const busyRef = useRef(busyId);
  const objectives = useMemo(() => [...new Set(routines.map((routine) => routine.objective).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")), [routines]);
  const options = step === "class" ? routineCreationClasses(routines, search, objective) : routineCreationSources(routines, search, objective);
  function goTo(nextStep: Step) { setSearch(""); setObjective("todos"); setStep(nextStep); }

  useEffect(() => { closeRef.current = close; }, [close]);
  useEffect(() => { busyRef.current = busyId; }, [busyId]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    requestAnimationFrame(() => firstActionRef.current?.focus());
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busyRef.current) { event.preventDefault(); closeRef.current(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); previousFocus?.focus(); };
  }, []);

  useEffect(() => { requestAnimationFrame(() => step === "origin" ? firstActionRef.current?.focus() : searchRef.current?.focus()); }, [step]);

  return <div className="fixed inset-0 z-[90] flex items-end bg-black/80 sm:items-center sm:justify-center sm:p-4" onPointerDown={(event) => { if (event.target === event.currentTarget && !busyId) close(); }}>
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="routine-creation-title" className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-[#121212] p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] text-white shadow-2xl sm:max-w-2xl sm:rounded-2xl sm:p-6">
      <header className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-yellow-300">Rutinas</p><h2 id="routine-creation-title" className="mt-2 text-xl font-black">{step === "origin" ? "Crear rutina" : step === "class" ? "Desde clase completa" : "Desde rutina existente"}</h2><p className="mt-1 text-sm text-zinc-400">{step === "origin" ? "Elegí un punto de partida." : "Seleccioná una base para abrirla en el editor."}</p></div><button type="button" onClick={close} disabled={Boolean(busyId)} aria-label="Cerrar creación de rutina" className="grid size-10 shrink-0 place-items-center rounded-xl border border-zinc-700 text-lg text-zinc-300 disabled:opacity-50">×</button></header>
      {step === "origin" ? <div className="mt-6 grid gap-3">
        <button ref={firstActionRef} type="button" onClick={createFromScratch} className="min-h-16 rounded-2xl border border-yellow-400/30 bg-yellow-400/[.06] px-4 py-3 text-left transition hover:bg-yellow-400/[.1]"><strong className="block text-sm text-yellow-200">Desde cero</strong><span className="mt-1 block text-xs text-zinc-400">Crear una planificación nueva.</span></button>
        <button type="button" onClick={() => goTo("class")} className="min-h-16 rounded-2xl border border-zinc-700 px-4 py-3 text-left transition hover:bg-white/[.04]"><strong className="block text-sm">Desde clase completa</strong><span className="mt-1 block text-xs text-zinc-400">Usar una clase guardada como punto de partida.</span></button>
        <button type="button" onClick={() => goTo("routine")} className="min-h-16 rounded-2xl border border-zinc-700 px-4 py-3 text-left transition hover:bg-white/[.04]"><strong className="block text-sm">Desde rutina existente</strong><span className="mt-1 block text-xs text-zinc-400">Crear una copia editable de otro plan.</span></button>
      </div> : <>
        <div className="mt-5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]"><input ref={searchRef} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={step === "class" ? "Buscar clase…" : "Buscar rutina o alumno…"} aria-label={step === "class" ? "Buscar clase completa" : "Buscar rutina existente"} className={inputClass}/><select value={objective} onChange={(event) => setObjective(event.target.value)} aria-label="Filtrar por objetivo" className={inputClass}><option value="todos">Todos los objetivos</option>{objectives.map((item) => <option key={item}>{item}</option>)}</select></div>
        <div className="mt-4 grid max-h-[48dvh] gap-2 overflow-y-auto pr-1">{options.length ? options.map((routine) => <article key={routine.id} className="rounded-2xl border border-zinc-800 bg-black/20 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><strong className="block truncate text-sm text-zinc-100">{routine.name}</strong><p className="mt-1 text-xs text-zinc-400">{routine.objective || "Sin objetivo"} · {step === "class" ? `${duration(routine)} · ${exerciseCount(routine)} ejercicios` : `${routine.status === "archivada" ? "Archivada" : "Activa"} · ${routine.days.length} días · ${studentCount(routine)} alumnos`}</p></div><button type="button" disabled={Boolean(busyId)} onClick={() => { if (actionInFlight.current) return; actionInFlight.current = true; if (step === "class") createFromClass(routine); else void copyRoutine(routine).finally(() => { actionInFlight.current = false; }); }} className="min-h-10 shrink-0 rounded-xl border border-yellow-400/30 px-3 text-xs font-black text-yellow-200 disabled:opacity-50">{busyId === routine.id ? "Creando…" : step === "class" ? "Usar esta clase" : "Crear copia"}</button></div></article>) : <p className="rounded-2xl border border-dashed border-zinc-700 px-4 py-10 text-center text-sm text-zinc-500">No hay opciones que coincidan con los filtros.</p>}</div>
        <button type="button" onClick={() => goTo("origin")} disabled={Boolean(busyId)} className="mt-4 min-h-11 rounded-xl px-4 text-sm font-bold text-zinc-400 hover:bg-white/[.03] disabled:opacity-50">← Volver</button>
      </>}
    </section>
  </div>;
}
