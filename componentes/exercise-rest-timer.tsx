"use client";

import { BmTimerIcon } from "@/componentes/icons";
import { useExerciseRestTimer } from "@/componentes/rest-timer-provider";
import { exerciseRestDurationLabel, exerciseRestSeconds, formatExerciseRestTime, initialExerciseRestTimer } from "@/lib/exercise-rest-timer";

export { useExerciseRestTimer } from "@/componentes/rest-timer-provider";

type ExerciseRestTimerProps = ReturnType<typeof useExerciseRestTimer> & {
  exerciseId: string;
  durationSeconds: number;
};

export function ExerciseRestTimer({ exerciseId, durationSeconds, timer, nowMs, primaryAction, reset }: ExerciseRestTimerProps) {
  const current = timer?.exerciseId === exerciseId ? timer : initialExerciseRestTimer(exerciseId, durationSeconds);
  const remaining = exerciseRestSeconds(current, nowMs);
  const ariaLabel = current.status === "ready"
    ? `Iniciar descanso de ${exerciseRestDurationLabel(durationSeconds)}`
    : current.status === "running" ? "Pausar descanso"
      : current.status === "paused" ? "Continuar descanso"
        : "Reiniciar descanso";
  const progress = durationSeconds ? remaining / durationSeconds * 100 : 0;
  const urgent = current.status === "running" && remaining <= 10;

  return <div data-exercise-rest-timer data-timer-status={current.status} className="absolute right-10 top-2.5 z-10 flex items-center gap-1">
    <button type="button" aria-label={ariaLabel} onClick={(event) => { event.stopPropagation(); primaryAction(exerciseId, durationSeconds); }} className={`relative flex min-h-11 min-w-[4.6rem] touch-manipulation items-center justify-center gap-1.5 overflow-hidden rounded-xl border bg-zinc-950/95 px-2 font-mono text-xs font-black tabular-nums outline-none transition motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-yellow-300 ${current.status === "finished" ? "border-yellow-300 text-yellow-200 shadow-[0_0_16px_rgba(250,204,21,.25)] motion-safe:animate-[pulse_700ms_ease-out_1]" : urgent ? "border-yellow-300/70 text-yellow-200" : current.status === "running" ? "border-yellow-400/45 text-white" : "border-zinc-700 text-zinc-300"}`}>
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-yellow-400/70 transition-[width] motion-reduce:transition-none" style={{ width: `${progress}%` }} />
      <BmTimerIcon size={15} className="shrink-0 text-yellow-300" />
      <span>{formatExerciseRestTime(remaining)}</span>
    </button>
    {current.status !== "ready" && <button type="button" aria-label="Reiniciar descanso" onClick={(event) => { event.stopPropagation(); reset(exerciseId, durationSeconds); }} className="grid min-h-11 w-7 touch-manipulation place-items-center rounded-lg text-sm text-zinc-500 outline-none transition hover:text-yellow-300 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-yellow-300">↻</button>}
  </div>;
}
