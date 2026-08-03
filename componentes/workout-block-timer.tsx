"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PortalWorkoutBlock } from "@/types/portal";
import type { TrainingRoutineBlock } from "@/types/gestion";
import { blockTimerView, elapsedBlockSeconds, formatTimerClock, initialBlockTimer, parseBlockTimer, reduceBlockTimer, serializeBlockTimer, type BlockTimerAction, type BlockTimerState, type TimedTrainingBlockType } from "@/lib/block-timer";
import { bellStrikes, type BlockTimerSound } from "@/lib/block-timer-sounds";

type TimerProps = {
  block: PortalWorkoutBlock;
  programmed: TrainingRoutineBlock;
  persistenceKey: string;
  update: (changes: Partial<PortalWorkoutBlock["result"]>) => void;
  complete: (changes: Partial<PortalWorkoutBlock["result"]>) => Promise<void>;
};

function stateFromResult(block: PortalWorkoutBlock): BlockTimerState {
  const initial = initialBlockTimer(block.blockId, block.blockType as TimedTrainingBlockType);
  if (!block.result.completed) return initial;
  return { ...initial, status: "finished", elapsedSeconds: block.result.durationSeconds ?? (block.result.minutesCompleted ?? 0) * 60 };
}

export function WorkoutBlockTimer({ block, programmed, persistenceKey, update, complete: _complete }: TimerProps) {
  const [timer, setTimer] = useState(() => stateFromResult(block));
  const [nowMs, setNowMs] = useState(Date.now);
  const [notice, setNotice] = useState("");
  const audioRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef(false);
  const previousStepRef = useRef("");
  const finishingRef = useRef(false);
  const roundTapRef = useRef(0);
  const noticeTimerRef = useRef<number | null>(null);
  const configuration = useMemo(() => ({
    rounds: programmed.rounds,
    durationSeconds: programmed.durationSeconds,
    workSeconds: programmed.workSeconds,
    restSeconds: programmed.restSeconds,
    restBetweenRoundsSeconds: programmed.restBetweenRoundsSeconds,
    exercises: block.exercises.map(({ exerciseId, name, order }) => ({ exerciseId, name, order })),
  }), [block.exercises, programmed.durationSeconds, programmed.restBetweenRoundsSeconds, programmed.restSeconds, programmed.rounds, programmed.workSeconds]);
  const view = blockTimerView(timer, configuration, nowMs);

  useEffect(() => {
    const restored = parseBlockTimer(window.localStorage.getItem(persistenceKey), block.blockId, block.blockType as TimedTrainingBlockType);
    if (!restored) return;
    const timeout = window.setTimeout(() => setTimer(restored), 0);
    return () => window.clearTimeout(timeout);
  }, [block.blockId, block.blockType, persistenceKey]);

  useEffect(() => { window.localStorage.setItem(persistenceKey, serializeBlockTimer(timer)); }, [persistenceKey, timer]);
  useEffect(() => {
    if (timer.status !== "running") return;
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(intervalId);
  }, [timer.status]);
  useEffect(() => () => {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    const context = audioRef.current;
    audioRef.current = null;
    if (context && context.state !== "closed") void context.close().catch(() => undefined);
  }, []);

  const feedback = useCallback((sound: BlockTimerSound) => {
    try {
      const context = audioRef.current;
      if (audioUnlockedRef.current && context?.state === "running") {
        for (const strike of bellStrikes(sound)) {
          const start = context.currentTime + strike.delaySeconds;
          const master = context.createGain();
          master.gain.setValueAtTime(strike.volume, start);
          master.gain.exponentialRampToValueAtTime(0.001, start + strike.durationSeconds);
          master.connect(context.destination);
          const harmonics = [[880, 1], [1320, 0.42], [1760, 0.18]] as const;
          harmonics.forEach(([frequency, level], harmonicIndex) => {
            const oscillator = context.createOscillator();
            const harmonic = context.createGain();
            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(frequency, start);
            harmonic.gain.setValueAtTime(level, start);
            oscillator.connect(harmonic); harmonic.connect(master);
            oscillator.start(start); oscillator.stop(start + strike.durationSeconds);
            oscillator.addEventListener("ended", () => { oscillator.disconnect(); harmonic.disconnect(); if (harmonicIndex === harmonics.length - 1) master.disconnect(); }, { once: true });
          });
        }
      }
    } catch { /* El cronómetro funciona aunque el navegador rechace audio. */ }
    try { navigator.vibrate?.(sound === "finish" ? [45, 250, 45] : sound === "work" ? 45 : 25); } catch { /* La vibración es opcional. */ }
  }, []);

  useEffect(() => {
    if (timer.status !== "running") return;
    const step = timer.blockType === "INTERVAL" && "segment" in view ? `${view.segmentIndex}` : timer.blockType === "EMOM" && "minute" in view ? `${view.minute}` : "";
    if (previousStepRef.current && step && previousStepRef.current !== step) {
      const isInterval = timer.blockType === "INTERVAL" && "segment" in view;
      setNotice(isInterval ? view.segment.kind === "WORK" ? `Ronda ${view.segment.round}: empieza ${configuration.exercises[view.segment.exerciseIndex]?.name ?? "el trabajo"}` : view.segment.kind === "ROUND_REST" ? "Cambio de ronda" : "Descanso" : `Minuto ${"minute" in view ? view.minute : ""}`);
      feedback(isInterval && view.segment.kind !== "WORK" ? "rest" : "work");
      if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = window.setTimeout(() => setNotice(""), 1800);
    }
    previousStepRef.current = step;
  }, [configuration.exercises, feedback, timer.blockType, timer.status, view]);

  const finish = useCallback((automatic = false) => {
    if (finishingRef.current || timer.status === "finished") return;
    finishingRef.current = true;
    const actionTime = Date.now();
    const elapsed = elapsedBlockSeconds(timer, actionTime);
    const finishedTimer = reduceBlockTimer(timer, "FINISH", actionTime);
    const base = { completed: true, durationSeconds: elapsed };
    const result = timer.blockType === "INTERVAL"
      ? { ...base, roundsCompleted: programmed.rounds ?? 1, completedExerciseIds: block.exercises.map((exercise) => exercise.exerciseId) }
      : timer.blockType === "EMOM"
        ? { ...base, minutesCompleted: Math.ceil(elapsed / 60), roundsCompleted: block.exercises.length ? Math.floor(Math.ceil(elapsed / 60) / block.exercises.length) : null, completedExerciseIds: block.exercises.map((exercise) => exercise.exerciseId) }
        : base;
    // No persistir en servidor al finalizar bloque: solo actualizar estado local y marcar como completado.
    update(result);
    setTimer(finishedTimer);
    setNowMs(actionTime);
    setNotice(automatic ? "Bloque completado" : "Resultado guardado");
    feedback("finish");
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(""), 1800);
  }, [block.exercises, feedback, programmed.rounds, timer, update]);

  useEffect(() => {
    if (timer.status !== "running" || !view.finished) return;
    // Cuando termina el tiempo, no guardar automáticamente: informar al alumno y permitir que presione "Finalizar bloque".
    const scheduled = window.setTimeout(() => {
      setNotice("Tiempo finalizado. Presioná 'Finalizar bloque' para confirmar.");
      if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = window.setTimeout(() => setNotice(""), 3000);
    }, 0);
    return () => window.clearTimeout(scheduled);
  }, [timer.status, view.finished]);

  async function prepareAudio() {
    try {
      const AudioConstructor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioConstructor) return false;
      audioRef.current ??= new AudioConstructor();
      audioUnlockedRef.current = true;
      await audioRef.current.resume();
      return true;
    } catch { return false; /* Sin audio sigue funcionando. */ }
  }

  function act(action: BlockTimerAction) {
    if (action === "FINISH") { finish(false); return; }
    const audioReady = prepareAudio();
    const actionTime = Date.now();
    const next = reduceBlockTimer(timer, action, actionTime);
    if (next === timer) return;
    setTimer(next); setNowMs(actionTime);
    if (action === "START") void audioReady.then((ready) => { if (ready) feedback("work"); });
    if (action === "RESET") {
      finishingRef.current = false;
      previousStepRef.current = "";
      update({ completed: false, roundsCompleted: null, minutesCompleted: null, extraRepetitions: null, durationSeconds: null, completedExerciseIds: [] });
    }
  }

  function addRound() {
    const now = Date.now();
    if (now - roundTapRef.current < 350 || timer.status === "finished") return;
    roundTapRef.current = now;
    update({ roundsCompleted: (block.result.roundsCompleted ?? 0) + 1 });
  }

  const interval = timer.blockType === "INTERVAL" && "segment" in view ? view : null;
  const emom = timer.blockType === "EMOM" && "minute" in view ? view : null;
  const exerciseIndex = interval ? interval.segment.exerciseIndex : emom?.exerciseIndex ?? 0;
  const currentExercise = configuration.exercises[exerciseIndex] ?? null;
  const nextExercise = interval && interval.nextExerciseIndex !== null ? configuration.exercises[interval.nextExerciseIndex] : null;
  const exerciseTarget = block.exercises[exerciseIndex]?.targetLabel ?? (programmed.workSeconds ? `${programmed.workSeconds} segundos` : "Objetivo libre");
  const clock = timer.blockType === "FOR_TIME" ? view.elapsedSeconds : interval ? interval.segmentRemaining : emom ? emom.minuteRemaining ?? 0 : view.remainingSeconds ?? 0;

  return <section aria-label={`Cronómetro ${timer.blockType}`} data-timer-status={timer.status} className="mt-3 min-w-0 touch-manipulation select-none overscroll-contain rounded-2xl border border-yellow-400/25 bg-[radial-gradient(circle_at_top,rgba(250,204,21,.1),transparent_55%),#090909] p-3.5 text-center shadow-inner">
    <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-[.16em]"><span className="text-yellow-300">{interval ? interval.segment.kind === "WORK" ? "Trabajo" : "Descanso" : timer.blockType === "EMOM" ? `Minuto ${emom?.minute ?? 1}` : timer.blockType === "AMRAP" ? "Tiempo restante" : "Tiempo total"}</span><span className={timer.status === "running" ? "text-emerald-300" : "text-zinc-500"}>{timer.status === "running" ? "En marcha" : timer.status === "paused" ? "Pausado" : timer.status === "finished" ? "Finalizado" : "Preparado"}</span></div>
    <output aria-live="off" className="my-2 block font-mono text-5xl font-black tabular-nums tracking-tight text-white max-[340px]:text-4xl">{formatTimerClock(clock ?? 0)}</output>
    {interval && <div className="min-w-0"><div className="rounded-2xl border border-yellow-400/20 bg-zinc-950/90 px-3 py-4"><p className="text-[9px] font-black uppercase tracking-[.2em] text-zinc-500">Ejercicio actual</p><h3 className="mt-1 break-words text-center text-2xl font-black leading-tight text-white max-[340px]:text-xl">{currentExercise?.name ?? "Trabajo"}</h3><p className="mt-2 text-sm font-black text-yellow-300">{exerciseTarget}</p><p className="mt-1 text-xs text-zinc-400">Ejercicio {exerciseIndex + 1} de {block.exercises.length}</p></div><p className="mt-2 text-xs font-bold text-zinc-300">Ronda {interval.segment.round} de {programmed.rounds ?? 1}</p><p className="mt-1 truncate text-xs text-zinc-500">Siguiente: {nextExercise?.name ?? (interval.finished ? "Finalizar" : "Descanso")}</p><p className="mt-1 text-[10px] text-zinc-600">Total restante: {formatTimerClock(interval.remainingSeconds)}</p></div>}
    {emom && <div className="grid min-w-0 grid-cols-2 gap-2 text-left text-xs"><TimerDatum label="Duración total" value={formatTimerClock(emom.totalSeconds ?? 0)} /><TimerDatum label="Minuto actual" value={`${emom.minute ?? 1}`} /><div className="col-span-2"><TimerDatum label="Ejercicio" value={currentExercise?.name ?? "Tarea del minuto"} /></div></div>}
    {timer.blockType === "AMRAP" && <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={timer.status === "idle" || timer.status === "finished"} onClick={addRound} className="min-h-11 rounded-xl bg-yellow-400 px-3 text-sm font-black text-zinc-950 disabled:opacity-50">+ Vuelta</button><label className="text-left text-[10px] font-bold uppercase text-zinc-500">Vueltas<input readOnly value={block.result.roundsCompleted ?? 0} className="mt-1 min-h-8 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-center text-base font-black text-white" /></label><label className="col-span-2 text-left text-[10px] font-bold uppercase text-zinc-500">Repeticiones adicionales<input type="number" min="0" value={block.result.extraRepetitions ?? ""} onChange={(event) => update({ extraRepetitions: event.target.value === "" ? null : Number(event.target.value) })} className="mt-1 min-h-10 w-full rounded-lg border border-zinc-700 bg-black px-3 text-sm text-white" /></label></div>}
    {notice && <p role="status" aria-live="polite" className="mt-3 rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-3 py-2 text-xs font-bold text-yellow-200">{notice}</p>}
    <div className="mt-3 grid grid-cols-2 gap-2 max-[340px]:grid-cols-1 sm:grid-cols-4">
      {timer.status === "idle" && <button type="button" onClick={() => act("START")} className="min-h-11 rounded-xl bg-yellow-400 px-3 text-sm font-black text-zinc-950 sm:col-span-2">Iniciar</button>}
      {timer.status === "running" && <button type="button" onClick={() => act("PAUSE")} className="min-h-11 rounded-xl border border-yellow-400/40 px-3 text-sm font-bold text-yellow-200">Pausar</button>}
      {timer.status === "paused" && <button type="button" onClick={() => act("RESUME")} className="min-h-11 rounded-xl bg-yellow-400 px-3 text-sm font-black text-zinc-950">Continuar</button>}
      <button type="button" disabled={timer.status === "idle"} onClick={() => act("RESET")} className="min-h-11 rounded-xl border border-zinc-700 px-3 text-sm font-bold text-zinc-300 disabled:opacity-40">Reiniciar</button>
      <button type="button" disabled={timer.status === "idle" || timer.status === "finished"} onClick={() => act("FINISH")} className="min-h-11 rounded-xl bg-emerald-400/10 px-3 text-sm font-bold text-emerald-300 disabled:opacity-40 sm:col-span-2">Finalizar bloque</button>
    </div>
    {(interval || emom) && <ol aria-label="Ejercicios del circuito" className="mt-3 min-w-0 space-y-1.5 text-left">{block.exercises.map((exercise, index) => { const done = index < exerciseIndex || (interval?.segment.kind !== "WORK" && index === exerciseIndex); const current = index === exerciseIndex; return <li key={exercise.exerciseId} data-exercise-state={current ? "current" : done ? "done" : "next"} className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 ${current ? "border-yellow-400/35 bg-yellow-400/10 text-white" : done ? "border-emerald-400/15 bg-emerald-400/[.05] text-emerald-200" : "border-zinc-800 bg-zinc-950/70 text-zinc-600"}`}><span className="grid size-6 shrink-0 place-items-center rounded-lg text-[10px] font-black">{done ? "✓" : exercise.order}</span><span className="min-w-0 flex-1 truncate text-xs font-bold">{exercise.name}</span><span className="shrink-0 text-[10px]">{exercise.targetLabel}</span></li>; })}</ol>}
  </section>;
}

function TimerDatum({ label, value }: { label: string; value: string }) {
  return <p className="min-w-0 rounded-xl bg-zinc-950 px-3 py-2"><span className="block text-[9px] font-bold uppercase tracking-wider text-zinc-600">{label}</span><strong className="mt-1 block truncate text-zinc-200">{value}</strong></p>;
}
