"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ExerciseDetail } from "@/componentes/exercise-library";
import { BmCloseIcon } from "@/componentes/icons";
import { RoutineOverlay } from "@/componentes/routine-overlay";
import { resolveManualVideoPlayback, resolveRoutineExerciseMedia } from "@/lib/routine-exercise-media";
import type { BMExercise } from "@/types/exercise-library";

type RoutineMediaExercise = {
  name: string;
  muscleGroup?: string;
  secondaryMuscles?: string[];
  equipment?: string;
  videoUrl?: string;
  observations?: string;
};

function PlayIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current" strokeWidth="1.7"><path d="M8 5.5v13l10-6.5-10-6.5Z" /></svg>;
}

function ManualExerciseDetail({ exercise, mediaUrl }: { exercise: RoutineMediaExercise; mediaUrl: string }) {
  const playback = resolveManualVideoPlayback(mediaUrl);
  const metadata = [exercise.muscleGroup, exercise.equipment].filter(Boolean).join(" · ");
  return <div className="space-y-4">
    <div>
      <h2 className="text-xl font-black">{exercise.name}</h2>
      {metadata && <p className="mt-1 text-sm text-zinc-400">{metadata}</p>}
      {exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0 && <p className="mt-1 text-xs text-zinc-500">Secundarios: {exercise.secondaryMuscles.join(", ")}</p>}
    </div>
    {playback.kind === "VIDEO" && <video controls playsInline preload="metadata" src={playback.url ?? undefined} className="max-h-80 w-full rounded-xl bg-black">Tu navegador no puede reproducir este video.</video>}
    {playback.kind === "EMBED" && <div className="aspect-video overflow-hidden rounded-xl border border-zinc-800 bg-black"><iframe src={playback.url ?? undefined} title={`Video de ${exercise.name}`} allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="size-full border-0" /></div>}
    {playback.kind === "UNAVAILABLE" && <div role="status" className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 text-sm leading-relaxed text-zinc-400"><p className="font-semibold text-zinc-200">Este video no puede reproducirse dentro de la aplicación.</p><p className="mt-1">Pedile a tu entrenador una versión compatible.</p></div>}
    <div>
      <h3 className="text-xs font-black uppercase tracking-wider text-yellow-400">Instrucciones del ejercicio</h3>
      <p className="mt-2 text-sm text-zinc-500">No hay instrucciones generales disponibles para este ejercicio.</p>
    </div>
  </div>;
}

export function RoutineExerciseMediaButton({ exercise, libraryMediaEnabled, thumbnail = false, separated = false, compact = false, label = "Ver video" }: { exercise: RoutineMediaExercise; libraryMediaEnabled: boolean; thumbnail?: boolean; separated?: boolean; compact?: boolean; label?: string }) {
  const media = resolveRoutineExerciseMedia(exercise.videoUrl, libraryMediaEnabled);
  const [open, setOpen] = useState(false);
  const [libraryExercise, setLibraryExercise] = useState<BMExercise | null>(null);
  const activeLibraryExercise = libraryExercise?.id === media.libraryExerciseId ? libraryExercise : null;

  useEffect(() => {
    if (!open || media.source !== "LIBRARY" || !media.libraryExerciseId || libraryExercise?.id === media.libraryExerciseId) return;
    const controller = new AbortController();
    fetch(`/api/exercise-library/${encodeURIComponent(media.libraryExerciseId)}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("No disponible")))
      .then((body: { exercise: BMExercise }) => setLibraryExercise(body.exercise))
      .catch(() => setLibraryExercise(null));
    return () => controller.abort();
  }, [libraryExercise?.id, media.libraryExerciseId, media.source, open]);

  if (!media.hasMedia) return null;
  const action = thumbnail && media.thumbnailUrl
      ? <button type="button" onClick={() => setOpen(true)} aria-label={`Ver video de ${exercise.name}`} className="group relative size-16 shrink-0 overflow-hidden rounded-xl border border-zinc-800 bg-black"><Image src={media.thumbnailUrl} alt="" width={72} height={72} loading="lazy" unoptimized className="size-full object-cover opacity-90" /><span className="absolute inset-0 grid place-items-center bg-black/20 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"><PlayIcon /></span></button>
      : <button type="button" onClick={() => setOpen(true)} className={`inline-flex items-center gap-2 border border-zinc-700 bg-zinc-950/70 text-xs font-semibold text-zinc-200 outline-none transition hover:border-zinc-500 hover:bg-zinc-900 focus-visible:ring-2 focus-visible:ring-yellow-300 ${compact ? "min-h-8 rounded-lg px-2.5" : "min-h-10 rounded-xl px-3.5"}`}><PlayIcon />{label}</button>;
  return <>
    {separated ? <div data-exercise-video-action className="mt-4 border-t border-zinc-800 pt-3">{action}</div> : action}
    <RoutineOverlay open={open} onClose={() => setOpen(false)} labelledBy="routine-video-title">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 p-4"><p id="routine-video-title" className="text-[10px] font-black uppercase tracking-[.18em] text-yellow-400">Ver video</p><button type="button" onClick={() => setOpen(false)} aria-label="Cerrar video" className="grid size-10 shrink-0 place-items-center rounded-xl border border-zinc-800 text-zinc-400 outline-none hover:bg-zinc-900 hover:text-white focus-visible:ring-2 focus-visible:ring-yellow-300"><BmCloseIcon size={22} /></button></header>
        <div className="min-h-0 overflow-y-auto p-4 sm:p-5">{media.source === "LIBRARY"
          ? activeLibraryExercise
            ? <ExerciseDetail exercise={activeLibraryExercise} mediaEnabled />
            : <p className="py-12 text-center text-sm text-zinc-500">Cargando ejercicio…</p>
          : media.mediaUrl && <ManualExerciseDetail exercise={exercise} mediaUrl={media.mediaUrl} />}</div>
    </RoutineOverlay>
  </>;
}
