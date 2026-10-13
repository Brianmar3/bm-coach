"use client";

import { useEffect, useState, type ReactNode, type CSSProperties } from "react";
import Image from "next/image";
import type { BMExercise } from "@/types/exercise-library";
import { currentFocusSet, focusSetValidation } from "@/lib/workout-focus-flow";
import type { PortalWorkoutExercise } from "@/types/portal";
import { BmBarbellIcon, BmChevronRightIcon, BmCloseIcon, BmHistoryIcon } from "@/componentes/icons";
import { useExerciseRestTimer } from "@/componentes/rest-timer-provider";
import { exerciseRestSeconds, formatExerciseRestTime, initialExerciseRestTimer } from "@/lib/exercise-rest-timer";
import { resolveManualVideoPlayback, resolveRoutineExerciseMedia } from "@/lib/routine-exercise-media";
import { RoutineExerciseMediaButton } from "@/componentes/routine-exercise-media";

export function WorkoutFocusHeader({ index, total, progress, elapsed, onExit }: { index: number; total: number; progress: { complete: number; total: number; percentage: number }; elapsed: number | null; onExit: () => void }) {
  return <header className="workout-focus-heading"><div className="min-w-0 flex-1"><div className="workout-focus-overview"><p>Ejercicio <strong>{index + 1}</strong> de {total}</p><span>{elapsed === null ? "Sin comenzar" : `En curso · ${formatExerciseRestTime(elapsed)}`}</span></div><div role="progressbar" aria-label="Progreso del entrenamiento" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.complete} className="workout-focus-track"><span style={{ width: `${progress.percentage}%` }} /></div></div><button type="button" onClick={onExit} className="workout-focus-button" aria-label="Salir del modo enfoque"><BmCloseIcon size={20} />Salir</button></header>;
}

export function WorkoutFocusIdentity({ name, muscles, previous }: { name: string; muscles?: string; previous: PortalWorkoutExercise["previous"] }) {
  return <div className="workout-focus-identity"><div className="flex items-center gap-3"><span className="workout-focus-emblem"><BmBarbellIcon size={24} /></span><div className="min-w-0"><h2 className="break-words text-xl font-black leading-tight sm:text-2xl">{name}</h2>{muscles && <p className="mt-1 text-sm text-[var(--foreground-muted)]">{muscles}</p>}</div></div>{previous && <div className="workout-focus-mark"><BmHistoryIcon size={20} /><div><p className="text-xs text-[var(--foreground-muted)]">Última marca</p><p className="mt-1 font-bold">{[previous.weight !== null ? `${previous.weight} kg` : "", previous.repetitions !== null ? `${previous.repetitions} reps` : ""].filter(Boolean).join(" × ") || "Registro anterior"}<span className="ml-2 text-xs font-normal text-[var(--foreground-muted)]">{new Intl.DateTimeFormat("es-AR", { timeZone: "UTC" }).format(new Date(previous.date))}</span></p></div></div>}</div>;
}

// Optional context: network/media failures never block an offline workout.
export function WorkoutFocusMedia({ exercise, libraryMediaEnabled, children }: { children?: ReactNode; exercise: { name: string; videoUrl?: string; equipment?: string }; libraryMediaEnabled: boolean }) {
  const [failed, setFailed] = useState(false);
  const [detail, setDetail] = useState<BMExercise | null>(null);
  const media = resolveRoutineExerciseMedia(exercise.videoUrl, libraryMediaEnabled);
  useEffect(() => {
    if (!media.libraryExerciseId) return;
    const controller = new AbortController();
    fetch(`/api/exercise-library/${encodeURIComponent(media.libraryExerciseId)}`, { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(body => { if (!controller.signal.aborted) setDetail(body?.exercise ?? null); })
      .catch(() => {});
    return () => controller.abort();
  }, [media.libraryExerciseId]);
  const playback = resolveManualVideoPlayback(media.mediaUrl);
  const instructions = detail?.instructionStepsEs?.length ? detail.instructionStepsEs : detail?.instructionsEs ? [detail.instructionsEs] : [];
  const available = media.source === "LIBRARY" ? Boolean(detail && (detail.gifPath || detail.thumbnailPath) && libraryMediaEnabled) : media.hasMedia;
  const src = detail?.gifPath ? media.mediaUrl : media.thumbnailUrl;
  return <>
    {available && !failed && (media.source === "LIBRARY" && src ? <div className="workout-focus-media"><Image src={src} alt={exercise.name} width={360} height={200} unoptimized onError={() => setFailed(true)} className="max-h-48 w-full object-contain" /></div> : playback.kind === "VIDEO" ? <div className="workout-focus-media"><video src={playback.url ?? undefined} controls playsInline preload="metadata" onError={() => setFailed(true)} className="max-h-48 w-full object-contain" /></div> : <RoutineExerciseMediaButton exercise={exercise} libraryMediaEnabled={libraryMediaEnabled} compact />)}
    {children}
    {(instructions.length > 0 || detail?.equipmentLabelEs || exercise.equipment) && <div className="workout-focus-technique">{(detail?.equipmentLabelEs || exercise.equipment) && <p className="workout-focus-eyebrow">{[detail?.targetMuscleLabelEs, detail?.equipmentLabelEs || exercise.equipment].filter(Boolean).join(" · ")}</p>}{instructions.length > 0 && <><p className="workout-focus-tip">{instructions[0]}</p><details><summary>Ver técnica</summary><ol>{instructions.map((step, index) => <li key={index}>{step}</li>)}</ol></details></>}</div>}
  </>;
}

export function WorkoutFocusList({ exercises, activeId, onSelect }: { exercises: PortalWorkoutExercise[]; activeId: string; onSelect: (id: string) => void }) {
  const currentIndex = exercises.findIndex((item) => item.exerciseId === activeId);
  return <details className="workout-focus-list"><summary>Lista de ejercicios ({exercises.length})<BmChevronRightIcon size={20} /></summary><ol>{exercises.map((exercise, index) => {
    const completed = exercise.sets.length > 0 && exercise.sets.every((set) => set.completed);
    const status = completed ? "Completado" : index === currentIndex ? "En ejecución" : index === currentIndex + 1 ? "Siguiente" : "Pendiente";
    return <li key={exercise.exerciseId}><button type="button" onClick={() => onSelect(exercise.exerciseId)} aria-current={index === currentIndex ? "step" : undefined}><span className="workout-focus-number">{index + 1}</span><span className="min-w-0 flex-1 break-words">{exercise.exerciseName}</span><span className="workout-focus-status" data-completed={completed}>{status}</span></button></li>;
  })}</ol></details>;
}

export function WorkoutFocusControls({ exercise, currentExercise, durationSeconds, index, total, started, nextExerciseName, pending, remainingBlocks, onReviewRemaining, onStart, onComplete, onPrevious, onNext }: { exercise: PortalWorkoutExercise; currentExercise: PortalWorkoutExercise; durationSeconds: number | null; index: number; total: number; started: boolean; nextExerciseName?: string; pending: boolean; remainingBlocks: boolean; onReviewRemaining: () => void; onStart: () => void; onComplete: () => void; onPrevious: () => void; onNext: () => void }) {
  const { timer, nowMs, primaryAction, reset, start } = useExerciseRestTimer();
  const duration = durationSeconds ?? 0;
  const current = timer?.exerciseId === exercise.exerciseId ? timer : initialExerciseRestTimer(exercise.exerciseId, duration);
  const remaining = exerciseRestSeconds(current, nowMs);
  const active = started && (current.status === "running" || current.status === "paused");
  const nextSetIndex = currentFocusSet(currentExercise);
  const nextSet = currentExercise.sets[nextSetIndex];
  const validation = nextSet ? focusSetValidation(nextSet) : null;
  return <section className="workout-focus-controls" aria-label="Control del entrenamiento">
    {!started ? <><p className="workout-focus-start-copy">Tu entrenamiento empieza cuando vos decidís.</p><button type="button" className="workout-focus-button is-primary workout-focus-main-action" onClick={onStart}>Iniciar entrenamiento</button></> : active ? <div className="workout-focus-rest is-active" data-timer-status={current.status}>
      <div className="workout-focus-clock" style={{ "--focus-rest-progress": `${duration ? remaining / duration * 360 : 0}deg` } as CSSProperties}><span><strong>{formatExerciseRestTime(remaining)}</strong></span></div>
      <div className="min-w-0 flex-1"><p className="workout-focus-rest-state">{current.status === "paused" ? "En pausa" : "Descanso"}</p><p className="workout-focus-rest-owner">{exercise.exerciseName}</p><p className="workout-focus-up-next">{nextExerciseName ? `Después: ${nextExerciseName}` : nextSet ? `Después: serie ${nextSet.setNumber} de ${currentExercise.sets.length}` : "Ejercicio completado"}</p><div className="workout-focus-rest-actions"><button type="button" className="workout-focus-button" onClick={() => primaryAction(exercise.exerciseId, duration, exercise.exerciseName)}>{current.status === "paused" ? "Reanudar" : "Pausar"}</button><button type="button" className="workout-focus-button" onClick={() => start(exercise.exerciseId, duration, exercise.exerciseName)}>Reiniciar</button><button type="button" className="workout-focus-button" onClick={() => reset(exercise.exerciseId, duration)}>Saltar descanso</button></div></div>
    </div> : nextSet ? <><p className="workout-focus-action-copy">Serie {nextSet.setNumber} de {currentExercise.sets.length}<span>{[nextSet.weight !== null ? `${nextSet.weight} kg` : "", nextSet.repetitions !== null ? `${nextSet.repetitions} reps` : ""].filter(Boolean).join(" · ")}</span></p><p id="focus-set-validation" className="workout-focus-validation" aria-live="polite">{validation || "Revisá o editá los valores antes de confirmar."}<span>Kg, reps y esfuerzo son opcionales; registrá al menos uno.</span></p><button type="button" disabled={pending || Boolean(validation)} aria-describedby="focus-set-validation" className="workout-focus-button is-primary workout-focus-main-action" onClick={onComplete}>Confirmar serie {nextSet.setNumber}</button></> : <><p role="status" className="workout-focus-action-copy">Ejercicio completado<span>{pending ? "Preparando el siguiente paso…" : remainingBlocks ? "Todavía quedan bloques en tu recorrido." : "Podés revisar tus series."}</span></p>{!pending && remainingBlocks && <button type="button" className="workout-focus-button is-primary workout-focus-main-action" onClick={onReviewRemaining}>Continuar con los bloques</button>}</>}
    <div className="workout-focus-navigation"><button type="button" disabled={index <= 0} onClick={onPrevious} className="workout-focus-button"><BmChevronRightIcon size={18} className="rotate-180" />Anterior</button><button type="button" disabled={index >= total - 1} onClick={onNext} className="workout-focus-button">Siguiente<BmChevronRightIcon size={18} /></button></div>
  </section>;
}
