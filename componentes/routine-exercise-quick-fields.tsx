"use client";
import { memo } from "react";
import type { RoutineExerciseDraft } from "@/lib/routine-exercise-draft";

export const RoutineExerciseQuickFields = memo(function RoutineExerciseQuickFields({ exercise, update }: { exercise: RoutineExerciseDraft; update: <K extends keyof RoutineExerciseDraft>(key: K, value: RoutineExerciseDraft[K]) => void }) {
  return <div className="routine-exercise-quick" data-routine-exercise={exercise.clientId}>
    <label>Ejercicio<input aria-label="Ejercicio" value={exercise.name} onChange={event => update("name", event.target.value)}/></label>
    <label>Series<input aria-label="Series" type="number" min={1} max={100} value={exercise.sets || ""} onChange={event => update("sets", event.target.value ? Number(event.target.value) : 0)}/></label>
    <label>Reps<input aria-label="Reps" value={exercise.repetitions} onChange={event => update("repetitions", event.target.value)}/></label>
    <label>Kg<input aria-label="Peso inicial (kg)" type="number" min={0} step="0.25" value={exercise.weight ?? ""} onChange={event => update("weight", event.target.value === "" ? null : Number(event.target.value))}/></label>
    <label>Pausa (s)<input aria-label="Descanso (seg.)" type="number" min={0} value={exercise.restSeconds ?? ""} onChange={event => update("restSeconds", event.target.value === "" ? null : Number(event.target.value))}/></label>
    <label>{exercise.effortType}<input aria-label="RIR/RPE objetivo" type="number" min={0} max={10} step="0.5" value={exercise.effortValue ?? ""} onChange={event => update("effortValue", event.target.value === "" ? null : Number(event.target.value))}/></label>
  </div>;
});
