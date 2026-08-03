import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { blockTimerView, elapsedBlockSeconds, formatTimerClock, initialBlockTimer, intervalSegments, parseBlockTimer, reduceBlockTimer, serializeBlockTimer, type BlockTimerConfiguration } from "../lib/block-timer.ts";
import { bellStrikes } from "../lib/block-timer-sounds.ts";

const timerComponent = readFileSync(new URL("../componentes/workout-block-timer.tsx", import.meta.url), "utf8");
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

test("los sonidos diferencian trabajo, descanso y final doble", () => {
  const work = bellStrikes("work");
  const rest = bellStrikes("rest");
  const finish = bellStrikes("finish");
  assert.equal(work.length, 1);
  assert.equal(rest.length, 1);
  assert.ok(rest[0].volume < work[0].volume);
  assert.ok(work[0].durationSeconds >= 0.5 && work[0].durationSeconds <= 0.8);
  assert.ok(rest[0].durationSeconds >= 0.3 && rest[0].durationSeconds <= 0.5);
  assert.equal(finish.length, 2);
  assert.ok(finish[1].delaySeconds >= 0.25 && finish[1].delaySeconds <= 0.4);
  assert.match(timerComponent, /feedback\("work"\)/);
  assert.match(timerComponent, /feedback\("finish"\)/);
});

test("sin Web Audio continúa y limpia contexto y avisos", () => {
  assert.match(timerComponent, /if \(!AudioConstructor\) return/);
  assert.match(timerComponent, /context\.close\(\)\.catch/);
  assert.match(timerComponent, /clearTimeout\(noticeTimerRef\.current\)/);
  assert.match(timerComponent, /catch \{/);
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
  assert.match(timerComponent, /AudioContext/);
  assert.match(timerComponent, /navigator\.vibrate\?\./);
  assert.match(timerComponent, /catch \{/);
  assert.doesNotMatch(timerComponent, /wakeLock|Notification|serviceWorker|PushManager/);
});
