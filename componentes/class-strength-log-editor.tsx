"use client";

import { useEffect, useRef, useState } from "react";
import type { ClassStrengthExerciseLog } from "@/types/classes";

export type ClassStrengthEditorValue = {
  id?: string;
  notes: string;
  exercises: ClassStrengthExerciseLog[];
};

type Props = {
  title: string;
  initialValue: ClassStrengthEditorValue;
  close: () => void;
  save: (status: "DRAFT" | "COMPLETED", value: ClassStrengthEditorValue) => Promise<void>;
};

const emptySet = (setNumber: number) => ({ setNumber, weight: null, repetitions: null, effort: null, unit: "kg", notes: "" });

export function ClassStrengthLogEditor({ title, initialValue, close, save }: Props) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState<"DRAFT" | "COMPLETED" | null>(null);
  const [error, setError] = useState("");
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) close(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, saving]);

  function updateSet(exerciseIndex: number, setIndex: number, key: "weight" | "repetitions" | "effort", raw: string) {
    setValue((current) => {
      const exercises = structuredClone(current.exercises);
      exercises[exerciseIndex].sets[setIndex][key] = raw === "" ? null : Number(raw);
      return { ...current, exercises };
    });
  }

  function removeSet(exerciseIndex: number, setIndex: number) {
    setValue((current) => {
      const exercises = structuredClone(current.exercises);
      exercises[exerciseIndex].sets = exercises[exerciseIndex].sets
        .filter((_, index) => index !== setIndex)
        .map((set, index) => ({ ...set, setNumber: index + 1 }));
      return { ...current, exercises };
    });
  }

  function removeExercise(exerciseIndex: number) {
    const exercise = value.exercises[exerciseIndex];
    const hasData = exercise.exerciseName.trim() || exercise.notes.trim() || exercise.sets.some((set) => set.weight !== null || set.repetitions !== null || set.effort !== null || set.notes.trim());
    if (hasData && !window.confirm("¿Eliminar este ejercicio y todas sus series?")) return;
    setValue((current) => ({
      ...current,
      exercises: current.exercises.filter((_, index) => index !== exerciseIndex).map((item, index) => ({ ...item, order: index + 1 })),
    }));
  }

  async function submit(status: "DRAFT" | "COMPLETED") {
    setError("");
    if (status === "COMPLETED" && value.exercises.some((exercise) => !exercise.exerciseName.trim())) {
      setError("Completá el nombre de todos los ejercicios antes de finalizar.");
      return;
    }
    setSaving(status);
    try {
      await save(status, value);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar. Tus cambios permanecen en pantalla.");
    } finally {
      setSaving(null);
    }
  }

  return <div className="fixed inset-0 z-[80] flex items-end overflow-hidden bg-black/90 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Editar registro de fuerza" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) close(); }}>
    <section className="box-border max-h-[calc(100dvh-env(safe-area-inset-top))] w-full min-w-0 max-w-2xl overflow-x-hidden overflow-y-auto rounded-t-2xl border border-zinc-800 bg-zinc-900 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:mx-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl sm:p-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0"><p className="text-xs text-yellow-400">Registro de clase presencial</p><h2 className="truncate text-xl font-bold">{title}</h2></div>
        <button ref={closeButton} type="button" disabled={Boolean(saving)} onClick={close} className="shrink-0 rounded-lg px-2 py-1 text-sm text-zinc-300 focus-visible:outline-2 focus-visible:outline-yellow-400">Cerrar</button>
      </div>
      {error && <p role="alert" className="mt-3 rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
      <div className="mt-5 space-y-4">
        {value.exercises.map((exercise, exerciseIndex) => <article key={`${exercise.order}-${exerciseIndex}`} className="min-w-0 rounded-xl bg-zinc-950 p-3 sm:p-4">
          <div className="flex min-w-0 items-center gap-2">
            <input value={exercise.exerciseName} onChange={(event) => setValue((current) => { const exercises = [...current.exercises]; exercises[exerciseIndex] = { ...exercise, exerciseName: event.target.value }; return { ...current, exercises }; })} className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-900 p-2 font-bold outline-none focus:border-yellow-400" placeholder="Nombre del ejercicio" />
            <button type="button" onClick={() => removeExercise(exerciseIndex)} className="shrink-0 rounded-lg border border-red-400/30 px-2 py-2 text-xs text-red-300">Eliminar</button>
          </div>
          <input value={exercise.notes} onChange={(event) => setValue((current) => { const exercises = [...current.exercises]; exercises[exerciseIndex] = { ...exercise, notes: event.target.value }; return { ...current, exercises }; })} className="mt-2 box-border w-full min-w-0 rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-sm outline-none focus:border-yellow-400" placeholder="Observación del ejercicio (opcional)" />
          <div className="mt-3 space-y-2">
            {exercise.sets.map((set, setIndex) => <div key={`${exerciseIndex}-${setIndex}`} className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <div className="flex items-center justify-between gap-2"><p className="text-sm font-bold">Serie {setIndex + 1}</p><button type="button" onClick={() => removeSet(exerciseIndex, setIndex)} className="text-xs text-red-300">Eliminar serie</button></div>
              <div className="mt-2 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
                <label className="min-w-0 text-[11px] text-zinc-400">Peso (kg)<input inputMode="decimal" type="number" min="0" step=".1" value={set.weight ?? ""} onChange={(event) => updateSet(exerciseIndex, setIndex, "weight", event.target.value)} className="mt-1 box-border w-full min-w-0 rounded-lg border border-zinc-700 bg-zinc-950 p-2.5 text-base text-white" /></label>
                <label className="min-w-0 text-[11px] text-zinc-400">Repeticiones<input inputMode="numeric" type="number" min="0" step="1" value={set.repetitions ?? ""} onChange={(event) => updateSet(exerciseIndex, setIndex, "repetitions", event.target.value)} className="mt-1 box-border w-full min-w-0 rounded-lg border border-zinc-700 bg-zinc-950 p-2.5 text-base text-white" /></label>
                <label className="min-w-0 text-[11px] text-zinc-400">RIR<input inputMode="decimal" type="number" min="0" max="10" step=".5" value={set.effort ?? ""} onChange={(event) => updateSet(exerciseIndex, setIndex, "effort", event.target.value)} className="mt-1 box-border w-full min-w-0 rounded-lg border border-zinc-700 bg-zinc-950 p-2.5 text-base text-white" /></label>
              </div>
            </div>)}
            <button type="button" onClick={() => setValue((current) => { const exercises = [...current.exercises]; exercises[exerciseIndex] = { ...exercise, sets: [...exercise.sets, emptySet(exercise.sets.length + 1)] }; return { ...current, exercises }; })} className="rounded-lg px-2 py-2 text-sm text-yellow-400">+ Agregar serie</button>
          </div>
        </article>)}
      </div>
      <button type="button" onClick={() => setValue((current) => ({ ...current, exercises: [...current.exercises, { exerciseName: "", order: current.exercises.length + 1, notes: "", sets: [emptySet(1)] }] }))} className="mt-4 w-full rounded-xl border border-dashed border-zinc-700 p-3 text-yellow-400">+ Agregar ejercicio</button>
      <textarea value={value.notes} onChange={(event) => setValue((current) => ({ ...current, notes: event.target.value }))} placeholder="Observación general" className="mt-4 box-border w-full min-w-0 rounded-xl border border-zinc-700 bg-zinc-950 p-3" />
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" disabled={Boolean(saving)} onClick={() => submit("DRAFT")} className="rounded-xl border border-yellow-400/40 px-4 py-2.5 font-bold text-yellow-300 disabled:opacity-50">{saving === "DRAFT" ? "Guardando…" : "Guardar borrador"}</button>
        <button type="button" disabled={Boolean(saving)} onClick={() => submit("COMPLETED")} className="rounded-xl bg-yellow-400 px-4 py-2.5 font-bold text-zinc-950 disabled:opacity-50">{saving === "COMPLETED" ? "Finalizando…" : "Finalizar"}</button>
      </div>
    </section>
  </div>;
}
