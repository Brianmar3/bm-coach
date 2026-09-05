import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { blockTimerView, elapsedBlockSeconds, formatTimerClock, initialBlockTimer, intervalSegments, parseBlockTimer, reduceBlockTimer, serializeBlockTimer, type BlockTimerConfiguration } from "../lib/block-timer.ts";
import { BLOCK_TIMER_AUDIO, phaseTransitionSound } from "../lib/block-timer-sounds.ts";

const timerComponent = readFileSync(new URL("../componentes/workout-block-timer.tsx", import.meta.url), "utf8");
const timerAudioHook = readFileSync(new URL("../componentes/use-workout-timer-audio.ts", import.meta.url), "utf8");
const portal = readFileSync(new URL("../componentes/portal-section.tsx", import.meta.url), "utf8");

const exercises = [
  { exerciseId: "a", name: "Sentadilla", order: 1 },
  { exerciseId: "b", name: "Flexiones", order: 2 },
];

const configuration: BlockTimerConfiguration = {
  rounds: 2,
  durationSeconds: 600,
  workSeconds: 40,
  restSeconds: 20,
  restBetweenRoundsSeconds: 30,
  exercises,
};

test("iniciar, pausar y continuar conserva el tiempo exacto", () => {
  const initial = initialBlockTimer("block", "AMRAP");
  const running = reduceBlockTimer(initial, "START", 1_000);
  assert.equal(running.status, "running");
  assert.equal(elapsedBlockSeconds(running, 6_900), 5);
  const paused = reduceBlockTimer(running, "PAUSE", 7_000);
  assert.equal(paused.status, "paused");
  assert.equal(paused.elapsedSeconds, 6);
  assert.equal(elapsedBlockSeconds(paused, 20_000), 6);
  const resumed = reduceBlockTimer(paused, "RESUME", 20_000);
  assert.equal(elapsedBlockSeconds(resumed, 24_000), 10);
});

test("reiniciar limpia el estado y finalizar congela el resultado", () => {
  const running = reduceBlockTimer(initialBlockTimer("block", "FOR_TIME"), "START", 1_000);
  const finished = reduceBlockTimer(running, "FINISH", 12_000);
  assert.equal(finished.status, "finished");
  assert.equal(finished.elapsedSeconds, 11);
  assert.equal(elapsedBlockSeconds(finished, 40_000), 11);
  const reset = reduceBlockTimer(finished, "RESET", 41_000);
  assert.equal(reset.status, "idle");
  assert.equal(reset.elapsedSeconds, 0);
});

test("un doble toque de la misma acción no produce dos transiciones", () => {
  const initial = initialBlockTimer("block", "INTERVAL");
  const first = reduceBlockTimer(initial, "START", 1_000);
  assert.equal(reduceBlockTimer(first, "START", 1_100), first);
  const paused = reduceBlockTimer(first, "PAUSE", 2_000);
  assert.equal(reduceBlockTimer(paused, "PAUSE", 2_100), paused);
});

test("INTERVAL alterna trabajo, descanso, ejercicio y ronda", () => {
  const segments = intervalSegments(configuration);
  assert.deepEqual(segments.map((segment) => [segment.kind, segment.round, segment.exerciseIndex, segment.durationSeconds]), [
    ["WORK", 1, 0, 40], ["REST", 1, 0, 20], ["WORK", 1, 1, 40], ["ROUND_REST", 1, 1, 30],
    ["WORK", 2, 0, 40], ["REST", 2, 0, 20], ["WORK", 2, 1, 40],
  ]);
  const timer = { ...initialBlockTimer("block", "INTERVAL"), status: "paused" as const };
  assert.equal(blockTimerView({ ...timer, elapsedSeconds: 0 }, configuration, 0).segment.kind, "WORK");
  assert.equal(blockTimerView({ ...timer, elapsedSeconds: 40 }, configuration, 0).segment.kind, "REST");
  assert.equal(blockTimerView({ ...timer, elapsedSeconds: 60 }, configuration, 0).segment.exerciseIndex, 1);
  assert.equal(blockTimerView({ ...timer, elapsedSeconds: 130 }, configuration, 0).segment.round, 2);
});

test("EMOM reinicia cada minuto y rota el ejercicio", () => {
  const timer = { ...initialBlockTimer("block", "EMOM"), status: "paused" as const, elapsedSeconds: 61 };
  const view = blockTimerView(timer, { ...configuration, durationSeconds: 180 }, 0);
  assert.equal(view.minute, 2);
  assert.equal(view.minuteRemaining, 59);
  assert.equal(view.exerciseIndex, 1);
});

test("AMRAP usa cuenta regresiva y termina al completar la duración", () => {
  const timer = { ...initialBlockTimer("block", "AMRAP"), status: "paused" as const, elapsedSeconds: 599 };
  assert.equal(blockTimerView(timer, configuration, 0).remainingSeconds, 1);
  assert.equal(blockTimerView({ ...timer, elapsedSeconds: 600 }, configuration, 0).finished, true);
});

test("FOR_TIME es ascendente y solo termina por acción del alumno", () => {
  const running = reduceBlockTimer(initialBlockTimer("block", "FOR_TIME"), "START", 1_000);
  const view = blockTimerView(running, configuration, 91_000);
  assert.equal(view.elapsedSeconds, 90);
  assert.equal(view.remainingSeconds, null);
  assert.equal(view.finished, false);
  assert.equal(formatTimerClock(view.elapsedSeconds), "01:30");
});

test("la persistencia temporal restaura bloque, tipo, estado y ancla", () => {
  const state = reduceBlockTimer(initialBlockTimer("block", "EMOM"), "START", 5_000);
  const restored = parseBlockTimer(serializeBlockTimer(state), "block", "EMOM");
  assert.deepEqual(restored, state);
  assert.equal(parseBlockTimer(serializeBlockTimer(state), "other", "EMOM"), null);
  assert.equal(parseBlockTimer("dato inválido", "block", "EMOM"), null);
});

test("cada tipo usa su cronómetro y guarda el resultado en el bloque", () => {
  for (const type of ["INTERVAL", "EMOM", "AMRAP", "FOR_TIME"]) assert.match(timerComponent, new RegExp(`"${type}"`));
  assert.match(timerComponent, /update\(result\)/);
  assert.match(timerComponent, /roundsCompleted/);
  assert.match(timerComponent, /minutesCompleted/);
  assert.match(timerComponent, /extraRepetitions/);
  assert.match(timerComponent, /durationSeconds/);
  assert.match(portal, /updateBlockResult/);
});

test("finalizar INTERVAL actualiza estado local y permite continuar sin persisitir en servidor", () => {
  assert.match(timerComponent, /finishingRef\.current/);
  assert.match(timerComponent, /update\(result\)/);
  assert.match(portal, /updateBlockResult/);
});

test("INTERVAL no se marca completo antes de confirmar y revierte a pausa si falla", () => {
  assert.match(timerComponent, /setTimer\(finishedTimer\)/);
  assert.match(portal, /autosaveAbortRef\.current\?\.abort\(\)/);
  assert.doesNotMatch(portal, /autosaveSignature\.current = signature;\s*setDraft\(next\)/);
});

test("los sonidos usan los tres archivos de audio finales", () => {
  assert.deepEqual(BLOCK_TIMER_AUDIO, {
    work: "/audio/workout-start.mp4",
    rest: "/audio/rest-start.m4a",
    finish: "/audio/workout-finish.m4a",
  });
  assert.match(timerComponent, /feedback\("work"\)/);
  assert.match(timerComponent, /feedback\("finish"\)/);
  assert.match(timerComponent, /phaseTransitionSound/);
});

test("precarga, reproduce y limpia los audios sin bloquear el cronómetro", () => {
  assert.match(timerComponent, /useWorkoutTimerAudio/);
  assert.match(timerAudioHook, /new Audio\(BLOCK_TIMER_AUDIO\[typedSound\]\)/);
  assert.match(timerAudioHook, /item\.preload = "auto"/);
  assert.match(timerAudioHook, /selected\.play\(\)\.catch/);
  assert.match(timerAudioHook, /item\.removeAttribute\("src"\)/);
  assert.match(timerComponent, /clearTimeout\(noticeTimerRef\.current\)/);
  assert.match(timerAudioHook, /catch \{/);
});

test("cada cambio real de fase dispara una sola señal", () => {
  assert.equal(phaseTransitionSound("0", "1", true), "rest");
  assert.equal(phaseTransitionSound("1", "2", false), "work");
  assert.equal(phaseTransitionSound("2", "2", false), null);
  assert.equal(phaseTransitionSound("", "0", false), null);
});

test("pausa, reanudación y renders extra no vuelven a disparar inicio", () => {
  assert.equal(phaseTransitionSound("3", "3", false), null);
  assert.match(timerComponent, /if \(timer\.status !== "running"\) return/);
  assert.match(timerComponent, /previousStepRef\.current = step/);
  assert.doesNotMatch(timerComponent, /action === "RESUME"[^\n]+feedback/);
});

test("terminar una fase no usa el audio final; finalizar el timer sí", () => {
  assert.equal(phaseTransitionSound("4", "5", true), "rest");
  const finishBody = timerComponent.slice(timerComponent.indexOf("const finish = useCallback"), timerComponent.indexOf("useEffect(() =>", timerComponent.indexOf("const finish = useCallback")));
  assert.match(finishBody, /finishingRef\.current/);
  assert.match(finishBody, /feedback\("finish"\)/);
  assert.equal((finishBody.match(/feedback\("finish"\)/g) ?? []).length, 1);
});

test("simulación 10 s trabajo, 5 s descanso y 2 vueltas conserva la secuencia pedida", () => {
  const shortTimer = { ...configuration, rounds: 2, workSeconds: 10, restSeconds: 5, restBetweenRoundsSeconds: 5, exercises: [exercises[0]] };
  const segments = intervalSegments(shortTimer);
  assert.deepEqual(segments.map((segment) => [segment.kind, segment.durationSeconds]), [["WORK", 10], ["ROUND_REST", 5], ["WORK", 10]]);
  const phaseSounds = segments.slice(1).map((segment, index) => phaseTransitionSound(String(index), String(index + 1), segment.kind !== "WORK"));
  assert.deepEqual(["work", ...phaseSounds, "finish"], ["work", "rest", "work", "finish"]);
});

test("3 ejercicios de 30 s, 3 rondas y descanso no duplican el último ejercicio", () => {
  const exact = { ...configuration, rounds: 3, workSeconds: 30, restSeconds: 0, restBetweenRoundsSeconds: 15, exercises: [...exercises, { exerciseId: "c", name: "Dead bug", order: 3 }] };
  const sequence = intervalSegments(exact).map((segment) => `${segment.kind}:R${segment.round}:E${segment.exerciseIndex + 1}`);
  assert.deepEqual(sequence, [
    "WORK:R1:E1", "WORK:R1:E2", "WORK:R1:E3", "ROUND_REST:R1:E3",
    "WORK:R2:E1", "WORK:R2:E2", "WORK:R2:E3", "ROUND_REST:R2:E3",
    "WORK:R3:E1", "WORK:R3:E2", "WORK:R3:E3",
  ]);
  assert.equal(sequence.some((step, index) => step === "WORK:R1:E3" && sequence[index + 1] === "WORK:R1:E3"), false);

  const paused = { ...initialBlockTimer("exact", "INTERVAL"), status: "paused" as const };
  const endRoundOne = blockTimerView({ ...paused, elapsedSeconds: 90 }, exact, 0);
  assert.equal(endRoundOne.segment.kind, "ROUND_REST");
  assert.equal(endRoundOne.segment.exerciseIndex, 2);
  const startRoundTwo = blockTimerView({ ...paused, elapsedSeconds: 105 }, exact, 0);
  assert.equal(startRoundTwo.segment.kind, "WORK");
  assert.equal(startRoundTwo.segment.round, 2);
  assert.equal(startRoundTwo.segment.exerciseIndex, 0);
  assert.equal(blockTimerView({ ...paused, elapsedSeconds: 300 }, exact, 0).finished, true);
});

test("fin de ronda usa descanso, nueva ronda usa trabajo y el final total usa finish", () => {
  assert.equal(phaseTransitionSound("2", "3", true), "rest");
  assert.equal(phaseTransitionSound("3", "4", false), "work");
  assert.match(timerComponent, /window\.setTimeout\(\(\) => finish\(true\), 0\)/);
  assert.match(timerComponent, /const currentExercise = resting \? null/);
  assert.match(timerComponent, /resting \? "Descanso"/);
  assert.match(timerComponent, /const current = !resting && index === exerciseIndex/);
});

test("casos borde mantienen una secuencia sin rondas ni ejercicios extra", () => {
  const oneExercise = [exercises[0]];
  assert.deepEqual(intervalSegments({ ...configuration, rounds: 1, exercises: oneExercise }).map((item) => item.kind), ["WORK"]);
  assert.deepEqual(intervalSegments({ ...configuration, rounds: 3, exercises: oneExercise, restBetweenRoundsSeconds: 5 }).map((item) => item.kind), ["WORK", "ROUND_REST", "WORK", "ROUND_REST", "WORK"]);
  assert.deepEqual(intervalSegments({ ...configuration, rounds: 1, restSeconds: 0, restBetweenRoundsSeconds: 0 }).map((item) => item.kind), ["WORK", "WORK"]);
  assert.deepEqual(intervalSegments({ ...configuration, rounds: 3, exercises: oneExercise, restSeconds: 0, restBetweenRoundsSeconds: 0 }).map((item) => item.kind), ["WORK", "WORK", "WORK"]);
});

test("el ejercicio actual, objetivo, siguiente y lista tienen jerarquía móvil", () => {
  for (const text of ["Ejercicio actual", "Ejercicio {exerciseIndex + 1} de", "Siguiente:", "Ejercicios del circuito", "data-exercise-state"]) assert.match(timerComponent, new RegExp(text.replace(/[{}+]/g, "\\$&")));
  assert.match(timerComponent, /text-2xl/);
  assert.match(timerComponent, /break-words/);
  assert.match(timerComponent, /truncate text-xs text-zinc-500/);
});

test("la vista móvil evita overflow y deja controles fuera de la navegación inferior", () => {
  for (const value of ["min-w-0", "overscroll-contain", "max-[340px]:text-4xl", "max-[340px]:grid-cols-1", "min-h-11", "touch-manipulation"]) assert.match(timerComponent, new RegExp(value.replace(/[\[\]]/g, "\\$&")));
  assert.doesNotMatch(timerComponent, /position:\s*fixed|className="fixed|sticky|bottom-0/);
});

test("avisos, sonido y vibración son progresivos y no usan APIs experimentales", () => {
  assert.match(timerComponent, /role="status"/);
  assert.match(timerAudioHook, /new Audio/);
  assert.match(timerAudioHook, /navigator\.vibrate\?\./);
  assert.match(timerAudioHook, /catch \{/);
  assert.doesNotMatch(timerComponent, /wakeLock|Notification|serviceWorker|PushManager/);
});
