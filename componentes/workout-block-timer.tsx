"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PortalWorkoutBlock } from "@/types/portal";
import type { TrainingRoutineBlock } from "@/types/gestion";
import { blockTimerView, elapsedBlockSeconds, formatTimerClock, initialBlockTimer, parseBlockTimer, reduceBlockTimer, serializeBlockTimer, type BlockTimerAction, type BlockTimerState, type TimedTrainingBlockType } from "@/lib/block-timer";

type TimerProps = {
  block: PortalWorkoutBlock;
  programmed: TrainingRoutineBlock;
  persistenceKey: string;
  update: (changes: Partial<PortalWorkoutBlock["result"]>) => void;
};

function stateFromResult(block: PortalWorkoutBlock): BlockTimerState {
  const initial = initialBlockTimer(block.blockId, block.blockType as TimedTrainingBlockType);
  if (!block.result.completed) return initial;
  return { ...initial, status: "finished", elapsedSeconds: block.result.durationSeconds ?? (block.result.minutesCompleted ?? 0) * 60 };
}

export function WorkoutBlockTimer({ block, programmed, persistenceKey, update }: TimerProps) {
  const [timer, setTimer] = useState(() => stateFromResult(block));
  const [nowMs, setNowMs] = useState(Date.now);
  const [notice, setNotice] = useState("");
  const audioRef = useRef<AudioContext | null>(null);
  const previousStepRef = useRef("");
  const finishingRef = useRef(false);
  const roundTapRef = useRef(0);
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

  useEffect(() => {
    window.localStorage.setItem(persistenceKey, serializeBlockTimer(timer));
  }, [persistenceKey, timer]);

  useEffect(() => {
    if (timer.status !== "running") return;
    const interval = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [timer.status]);

  const feedback = useCallback(() => {
    try {
      if (audioRef.current?.state === "running") {
        const oscillator = audioRef.current.createOscillator();
        const gain = audioRef.current.createGain();
        oscillator.frequency.value = 660;
        gain.gain.setValueAtTime(0.025, audioRef.current.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioRef.current.currentTime + 0.12);
        oscillator.connect(gain); gain.connect(audioRef.current.destination);
        oscillator.start(); oscillator.stop(audioRef.current.currentTime + 0.12);
      }
    } catch { /* El cronómetro funciona aunque el navegador rechace audio. */ }
    try { navigator.vibrate?.(35); } catch { /* La vibración es opcional. */ }
  }, []);

  useEffect(() => {
    if (timer.status !== "running") return;
    const step = timer.blockType === "INTERVAL" && "segment" in view ? `${view.segmentIndex}` : timer.blockType === "EMOM" && "minute" in view ? `${view.minute}` : "";
    if (previousStepRef.current && step && previousStepRef.current !== step) {
      setNotice(timer.blockType === "INTERVAL" && "segment" in view ? view.segment.kind === "WORK" ? `Ronda ${view.segment.round}: empieza ${configuration.exercises[view.segment.exerciseIndex]?.name ?? "el trabajo"}` : view.segment.kind === "ROUND_REST" ? "Cambio de ronda" : "Descanso" : `Minuto ${"minute" in view ? view.minute : ""}`);
      feedback();
      const timeout = window.setTimeout(() => setNotice(""), 1800);
      previousStepRef.current = step;
      return () => window.clearTimeout(timeout);
    }
    previousStepRef.current = step;
  }, [configuration.exercises, feedback, timer.blockType, timer.status, view]);

  const finish = useCallback((automatic = false) => {
    if (finishingRef.current || timer.status === "finished") return;
    finishingRef.current = true;
    const actionTime = Date.now();
    const elapsed = elapsedBlockSeconds(timer, actionTime);
    const finished = reduceBlockTimer(timer, "FINISH", actionTime);
    setTimer(finished); setNowMs(actionTime);
    const base = { completed: true, durationSeconds: elapsed };
    if (timer.blockType === "INTERVAL") update({ ...base, roundsCompleted: programmed.rounds ?? 1, completedExerciseIds: block.exercises.map((exercise) => exercise.exerciseId) });
    else if (timer.blockType === "EMOM") update({ ...base, minutesCompleted: Math.ceil(elapsed / 60), roundsCompleted: block.exercises.length ? Math.floor(Math.ceil(elapsed / 60) / block.exercises.length) : null, completedExerciseIds: block.exercises.map((exercise) => exercise.exerciseId) });
    else update(base);
    setNotice(automatic ? "Bloque completado" : "Resultado guardado");
    feedback();
    window.setTimeout(() => { finishingRef.current = false; setNotice(""); }, 1200);
  }, [block.exercises, feedback, programmed.rounds, timer, update]);

  useEffect(() => {
    if (timer.status === "running" && view.finished) finish(true);
  }, [finish, timer.status, view.finished]);

  function prepareAudio() {
    try {
      audioRef.current ??= new AudioContext();
      void audioRef.current.resume();
    } catch { /* Sin audio sigue funcionando. */ }
  }

  function act(action: BlockTimerAction) {
    if (action === "FINISH") { finish(false); return; }
    prepareAudio();
    const actionTime = Date.now();
    const next = reduceBlockTimer(timer, action, actionTime);
    if (next === timer) return;
    setTimer(next); setNowMs(actionTime);
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
  const currentExercise = interval ? configuration.exercises[interval.segment.exerciseIndex] : emom && typeof emom.exerciseIndex === "number" ? configuration.exercises[emom.exerciseIndex] : null;
  const nextExercise = interval && interval.nextExerciseIndex !== null ? configuration.exercises[interval.nextExerciseIndex] : null;
  const clock = timer.blockType === "FOR_TIME" ? view.elapsedSeconds : interval ? interval.segmentRemaining : emom ? emom.minuteRemaining ?? 0 : view.remainingSeconds ?? 0;

  return <section aria-label={`Cronómetro ${timer.blockType}`} data-timer-status={timer.status} className="mt-3 min-w-0 touch-manipulation select-none overscroll-contain rounded-2xl border border-yellow-400/25 bg-[radial-gradient(circle_at_top,rgba(250,204,21,.1),transparent_55%),#090909] p-3.5 text-center shadow-inner">
    <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-[.16em]"><span className="text-yellow-300">{timer.blockType === "INTERVAL" && interval ? interval.segment.kind === "WORK" ? "Trabajo" : "Descanso" : timer.blockType === "EMOM" ? `Minuto ${emom?.minute ?? 1}` : timer.blockType === "AMRAP" ? "Tiempo restante" : "Tiempo total"}</span><span className={timer.status === "running" ? "text-emerald-300" : "text-zinc-500"}>{timer.status === "running" ? "En marcha" : timer.status === "paused" ? "Pausado" : timer.status === "finished" ? "Finalizado" : "Preparado"}</span></div>
    <output aria-live="off" className="my-2 block font-mono text-5xl font-black tabular-nums tracking-tight text-white max-[340px]:text-4xl">{formatTimerClock(clock ?? 0)}</output>
    {timer.blockType === "INTERVAL" && interval && <div className="grid min-w-0 grid-cols-2 gap-2 text-left text-xs"><TimerDatum label="Ronda" value={`${interval.segment.round}/${programmed.rounds ?? 1}`} /><TimerDatum label="Ejercicio" value={currentExercise?.name ?? "Trabajo"} /><TimerDatum label="Siguiente" value={nextExercise?.name ?? (interval.finished ? "Finalizar" : "Descanso")} /><TimerDatum label="Total restante" value={formatTimerClock(interval.remainingSeconds)} /></div>}
    {timer.blockType === "EMOM" && emom && <div className="grid min-w-0 grid-cols-2 gap-2 text-left text-xs"><TimerDatum label="Duración total" value={formatTimerClock(emom.totalSeconds ?? 0)} /><TimerDatum label="Minuto actual" value={`${emom.minute ?? 1}`} /><div className="col-span-2"><TimerDatum label="Ejercicio" value={currentExercise?.name ?? "Tarea del minuto"} /></div></div>}
    {timer.blockType === "AMRAP" && <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={timer.status === "idle" || timer.status === "finished"} onClick={addRound} className="min-h-11 rounded-xl bg-yellow-400 px-3 text-sm font-black text-zinc-950 disabled:opacity-50">+ Vuelta</button><label className="text-left text-[10px] font-bold uppercase text-zinc-500">Vueltas<input readOnly value={block.result.roundsCompleted ?? 0} className="mt-1 min-h-8 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-center text-base font-black text-white" /></label><label className="col-span-2 text-left text-[10px] font-bold uppercase text-zinc-500">Repeticiones adicionales<input type="number" min="0" value={block.result.extraRepetitions ?? ""} onChange={(event) => update({ extraRepetitions: event.target.value === "" ? null : Number(event.target.value) })} className="mt-1 min-h-10 w-full rounded-lg border border-zinc-700 bg-black px-3 text-sm text-white" /></label></div>}
    {notice && <p role="status" aria-live="polite" className="mt-3 rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-3 py-2 text-xs font-bold text-yellow-200">{notice}</p>}
    <div className="mt-3 grid grid-cols-2 gap-2 max-[340px]:grid-cols-1 sm:grid-cols-4">
      {timer.status === "idle" && <button type="button" onClick={() => act("START")} className="min-h-11 rounded-xl bg-yellow-400 px-3 text-sm font-black text-zinc-950 sm:col-span-2">Iniciar</button>}
      {timer.status === "running" && <button type="button" onClick={() => act("PAUSE")} className="min-h-11 rounded-xl border border-yellow-400/40 px-3 text-sm font-bold text-yellow-200">Pausar</button>}
      {timer.status === "paused" && <button type="button" onClick={() => act("RESUME")} className="min-h-11 rounded-xl bg-yellow-400 px-3 text-sm font-black text-zinc-950">Continuar</button>}
      <button type="button" disabled={timer.status === "idle"} onClick={() => act("RESET")} className="min-h-11 rounded-xl border border-zinc-700 px-3 text-sm font-bold text-zinc-300 disabled:opacity-40">Reiniciar</button>
      <button type="button" disabled={timer.status === "idle" || timer.status === "finished"} onClick={() => act("FINISH")} className="min-h-11 rounded-xl bg-emerald-400/10 px-3 text-sm font-bold text-emerald-300 disabled:opacity-40 sm:col-span-2">Finalizar bloque</button>
    </div>
  </section>;
}

function TimerDatum({ label, value }: { label: string; value: string }) {
  return <p className="min-w-0 rounded-xl bg-zinc-950 px-3 py-2"><span className="block text-[9px] font-bold uppercase tracking-wider text-zinc-600">{label}</span><strong className="mt-1 block truncate text-zinc-200">{value}</strong></p>;
}
