"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import type { PortalWorkoutExercise } from "@/types/portal";
import { BmBarbellIcon, BmChevronRightIcon, BmCloseIcon, BmHistoryIcon, BmTimerIcon } from "@/componentes/icons";
import { useExerciseRestTimer } from "@/componentes/rest-timer-provider";
import { exerciseRestSeconds, formatExerciseRestTime, initialExerciseRestTimer } from "@/lib/exercise-rest-timer";
import { resolveManualVideoPlayback, resolveRoutineExerciseMedia } from "@/lib/routine-exercise-media";
import { RoutineExerciseMediaButton } from "@/componentes/routine-exercise-media";

export function WorkoutFocusHeader({ index, total, onExit }: { index: number; total: number; onExit: () => void }) {
  return <header className="workout-focus-heading"><p>Ejercicio <strong>{index + 1}</strong> de {total}</p><button type="button" onClick={onExit} className="workout-focus-button" aria-label="Salir del modo enfoque"><BmCloseIcon size={20} />Salir</button></header>;
}

export function WorkoutFocusIdentity({ name, muscles, previous }: { name: string; muscles?: string; previous: PortalWorkoutExercise["previous"] }) {
  return <div className="workout-focus-identity"><div className="flex items-center gap-3"><span className="workout-focus-emblem"><BmBarbellIcon size={24} /></span><div className="min-w-0"><h2 className="break-words text-xl font-black leading-tight sm:text-2xl">{name}</h2>{muscles && <p className="mt-1 text-sm text-[var(--foreground-muted)]">{muscles}</p>}</div></div>{previous && <div className="workout-focus-mark"><BmHistoryIcon size={20} /><div><p className="text-xs text-[var(--foreground-muted)]">Última marca</p><p className="mt-1 font-bold">{[previous.weight !== null ? `${previous.weight} kg` : "", previous.repetitions !== null ? `${previous.repetitions} reps` : ""].filter(Boolean).join(" × ") || "Registro anterior"}<span className="ml-2 text-xs font-normal text-[var(--foreground-muted)]">{new Intl.DateTimeFormat("es-AR", { timeZone: "UTC" }).format(new Date(previous.date))}</span></p></div></div>}</div>;
}

// Optional presentation only: media failure must never block an offline workout.
export function WorkoutFocusMedia({ exercise, libraryMediaEnabled }: { exercise: { name: string; videoUrl?: string }; libraryMediaEnabled: boolean }) {
  const [failed, setFailed] = useState(false);
  const media = resolveRoutineExerciseMedia(exercise.videoUrl, libraryMediaEnabled);
  if (!media.hasMedia || failed) return null;
  const playback = resolveManualVideoPlayback(media.mediaUrl);
  if (media.source === "LIBRARY" && media.mediaUrl) return <div className="workout-focus-media"><Image src={media.mediaUrl} alt={exercise.name} width={320} height={200} unoptimized onError={() => setFailed(true)} className="max-h-48 w-full object-contain" /><RoutineExerciseMediaButton exercise={exercise} libraryMediaEnabled={libraryMediaEnabled} compact label="Ver ejercicio" /></div>;
  if (playback.kind === "VIDEO") return <div className="workout-focus-media"><video src={playback.url ?? undefined} controls playsInline preload="metadata" onError={() => setFailed(true)} className="max-h-48 w-full object-contain" /></div>;
  return <RoutineExerciseMediaButton exercise={exercise} libraryMediaEnabled={libraryMediaEnabled} compact />;
}

export function WorkoutFocusList({ exercises, activeId, onSelect }: { exercises: PortalWorkoutExercise[]; activeId: string; onSelect: (id: string) => void }) {
  const currentIndex = exercises.findIndex((item) => item.exerciseId === activeId);
  return <details className="workout-focus-list"><summary>Lista de ejercicios ({exercises.length})<BmChevronRightIcon size={20} /></summary><ol>{exercises.map((exercise, index) => {
    const completed = exercise.sets.length > 0 && exercise.sets.every((set) => set.completed);
    const status = completed ? "Completado" : index === currentIndex ? "En ejecución" : index === currentIndex + 1 ? "Siguiente" : "Pendiente";
    return <li key={exercise.exerciseId}><button type="button" onClick={() => onSelect(exercise.exerciseId)} aria-current={index === currentIndex ? "step" : undefined}><span className="workout-focus-number">{index + 1}</span><span className="min-w-0 flex-1 break-words">{exercise.exerciseName}</span><span className="workout-focus-status" data-completed={completed}>{status}</span></button></li>;
  })}</ol></details>;
}

export function WorkoutFocusControls({ exercise, durationSeconds, index, total, onPrevious, onNext }: { exercise: PortalWorkoutExercise; durationSeconds: number | null; index: number; total: number; onPrevious: () => void; onNext: () => void }) {
  const { timer, nowMs, primaryAction, reset } = useExerciseRestTimer();
  const duration = durationSeconds ?? 0;
  const current = timer?.exerciseId === exercise.exerciseId ? timer : initialExerciseRestTimer(exercise.exerciseId, duration);
  const remaining = exerciseRestSeconds(current, nowMs);
  const active = current.status === "running" || current.status === "paused";
  const nextSet = exercise.sets.find((set) => !set.completed);
  const label = current.status === "running" ? "Pausar descanso" : current.status === "paused" ? "Continuar descanso" : current.status === "finished" ? "Reiniciar descanso" : "Iniciar descanso";
  return <section className="workout-focus-controls" aria-label="Control del entrenamiento">
    {duration > 0 && <div className={`workout-focus-rest ${active ? "is-active" : ""}`} data-timer-status={current.status}>
      <button type="button" className="workout-focus-clock" aria-label={label} onClick={() => primaryAction(exercise.exerciseId, duration, exercise.exerciseName)} style={{ "--focus-rest-progress": `${duration ? remaining / duration * 360 : 0}deg` } as CSSProperties}><span><BmTimerIcon size={20} /><strong>{formatExerciseRestTime(remaining)}</strong><small>{current.status === "paused" ? "En pausa · Reanudar" : current.status === "running" ? "Descanso · Pausar" : current.status === "finished" ? "Descanso terminado" : "Iniciar descanso"}</small></span></button>
      <div className="min-w-0 flex-1"><p className="mb-1 truncate text-xs text-[var(--foreground-muted)]">{exercise.exerciseName}</p>{nextSet ? <><p className="text-xs text-[var(--foreground-muted)]">Siguiente serie</p><p className="mt-1 text-sm font-semibold">{[`Serie ${nextSet.setNumber}`, nextSet.repetitions !== null ? `${nextSet.repetitions} reps` : "", nextSet.weight !== null ? `${nextSet.weight} kg` : ""].filter(Boolean).join(" · ")}</p></> : <p className="text-sm font-semibold">Series completadas</p>}{current.status !== "ready" && <button type="button" className="workout-focus-button mt-1" onClick={() => reset(exercise.exerciseId, duration)} aria-label="Reiniciar descanso">Reiniciar</button>}</div>
    </div>}
    <div className="workout-focus-navigation"><button type="button" disabled={index <= 0} onClick={onPrevious} className="workout-focus-button"><BmChevronRightIcon size={20} className="rotate-180" />Anterior</button><button type="button" disabled={index >= total - 1} onClick={onNext} className="workout-focus-button is-primary">Siguiente<BmChevronRightIcon size={20} /></button></div>
  </section>;
}
