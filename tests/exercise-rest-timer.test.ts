import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { exerciseRestSeconds, finishExerciseRestTimer, formatExerciseRestTime, initialExerciseRestTimer, reduceExerciseRestTimer } from "../lib/exercise-rest-timer.ts";

const component = readFileSync(new URL("../componentes/exercise-rest-timer.tsx", import.meta.url), "utf8");
const provider = readFileSync(new URL("../componentes/rest-timer-provider.tsx", import.meta.url), "utf8");
const portal = readFileSync(new URL("../componentes/portal-section.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../componentes/portal-shell.tsx", import.meta.url), "utf8");
const audioHook = readFileSync(new URL("../componentes/use-workout-timer-audio.ts", import.meta.url), "utf8");

test("120 segundos se muestran como 2:00", () => assert.equal(formatExerciseRestTime(120), "2:00"));
test("90 segundos se muestran como 1:30", () => assert.equal(formatExerciseRestTime(90), "1:30"));

test("el descanso queda preparado y no inicia automáticamente", () => {
  const timer = initialExerciseRestTimer("a", 120);
  assert.equal(timer.status, "ready");
  assert.equal(timer.endTimestamp, null);
  assert.equal(exerciseRestSeconds(timer, 50_000), 120);
});

test("el toque manual inicia con una marca temporal absoluta", () => {
  const timer = reduceExerciseRestTimer(initialExerciseRestTimer("a", 90), "START", 1_000);
  assert.equal(timer.status, "running");
  assert.equal(timer.endTimestamp, 91_000);
});

test("un toque durante la marcha pausa en el segundo real", () => {
  const running = reduceExerciseRestTimer(initialExerciseRestTimer("a", 90), "START", 1_000);
  const paused = reduceExerciseRestTimer(running, "PAUSE", 31_000);
  assert.equal(paused.status, "paused");
  assert.equal(paused.remainingSeconds, 60);
  assert.equal(paused.endTimestamp, null);
});

test("un descanso pausado puede continuar", () => {
  const paused = { ...initialExerciseRestTimer("a", 90), status: "paused" as const, remainingSeconds: 40 };
  const resumed = reduceExerciseRestTimer(paused, "RESUME", 5_000);
  assert.equal(resumed.status, "running");
  assert.equal(resumed.endTimestamp, 45_000);
});

test("reiniciar recupera el tiempo original", () => {
  const paused = { ...initialExerciseRestTimer("a", 120), status: "paused" as const, remainingSeconds: 17 };
  assert.deepEqual(reduceExerciseRestTimer(paused, "RESET", 0), initialExerciseRestTimer("a", 120));
});

test("al llegar a cero finaliza y el provider protege un único aviso por ejecución", () => {
  const running = reduceExerciseRestTimer(initialExerciseRestTimer("a", 2), "START", 1_000);
  assert.equal(exerciseRestSeconds(running, 3_000), 0);
  assert.equal(finishExerciseRestTimer(running).status, "finished");
  assert.match(provider, /notifiedRunsRef\.current\.has\(runId\)/);
  assert.match(provider, /current\.notified/);
});

test("iniciar es silencioso y sólo prepara el audio final", () => {
  assert.match(provider, /prime\("restFinish"\)/);
  assert.equal((provider.match(/feedback\("restFinish", false\)/g) ?? []).length, 1);
  assert.doesNotMatch(provider, /feedback\("work"|navigator\.vibrate/);
});

test("el descanso usa su campanita y el workout conserva su final actual", () => {
  assert.match(audioHook, /BLOCK_TIMER_AUDIO/);
  const sounds = readFileSync(new URL("../lib/block-timer-sounds.ts", import.meta.url), "utf8");
  assert.match(sounds, /finish: "\/audio\/workout-finish\.m4a"/);
  assert.match(sounds, /restFinish: "\/audio\/rest-finish\.wav"/);
});

test("toda la rutina comparte un único timer activo", () => {
  assert.match(portal, /const exerciseRestTimer = useExerciseRestTimer\(\)/);
  assert.match(provider, /current\.exerciseId !== exerciseId/);
  assert.match(component, /initialExerciseRestTimer\(exerciseId, durationSeconds\)/);
});

test("colapsar conserva el countdown activo en la cabecera", () => {
  assert.match(portal, /open \|\| exerciseRestTimer\.timer\?\.exerciseId === exercise\.exerciseId/);
  assert.doesNotMatch(portal, /setExerciseRestTimer/);
});

test("reduced motion no cambia la lógica ni la precisión por timestamp", () => {
  assert.match(component, /motion-reduce:transition-none/);
  assert.match(component, /motion-safe:animate-/);
  assert.match(provider, /const tickTime = Date\.now\(\)/);
  assert.match(provider, /exerciseRestSeconds\(current, tickTime\)/);
  assert.match(audioHook, /BLOCK_TIMER_AUDIO/);
});

test("el provider vive en el shell persistente y sobrevive al cambio de ruta", () => {
  assert.match(shell, /<RestTimerProvider>/);
  assert.match(shell, /<main key=\{pathname\}/);
  assert.ok(shell.indexOf("<RestTimerProvider>") < shell.indexOf("<main key={pathname}"));
  assert.doesNotMatch(component, /useState<ExerciseRestTimerState/);
});

test("volver a Rutina conserva el tiempo calculado desde endTimestamp", () => {
  assert.match(provider, /timerRef\.current/);
  assert.match(provider, /exerciseRestSeconds\(current, tickTime\)/);
  assert.match(component, /exerciseRestSeconds\(current, nowMs\)/);
});

test("colapsar la card no desmonta ni reinicia el estado global", () => {
  assert.match(portal, /open \|\| exerciseRestTimer\.timer\?\.exerciseId === exercise\.exerciseId/);
  assert.match(component, /useExerciseRestTimer.*rest-timer-provider/);
});

test("background recalcula tiempo real y solicita notificación local", () => {
  assert.match(provider, /visibilitychange/);
  assert.match(provider, /document\.hidden/);
  assert.match(provider, /registration\.showNotification\("Descanso terminado", options\)/);
  assert.match(provider, /Ya podés comenzar tu próxima serie\./);
});

test("visible reproduce campanita y background no la duplica", () => {
  assert.match(provider, /if \(endedWhileHidden\) void showRestFinishedNotification\(\);\s*else feedback\("restFinish", false\)/);
  assert.match(provider, /notifiedRunsRef\.current\.add\(runId\)/);
});

test("sessionStorage restaura únicamente un descanso vigente", () => {
  assert.match(provider, /sessionStorage\.getItem\(STORAGE_KEY\)/);
  assert.match(provider, /stored\.endTimestamp <= nowMs/);
  assert.match(provider, /originalDuration: timer\.durationSeconds/);
  assert.doesNotMatch(provider, /exerciseName:/);
});

test("fuera de Rutina se muestra un indicador discreto que permite volver", () => {
  assert.match(shell, /<RestTimerIndicator \/>/);
  assert.match(provider, /href="\/portal\/rutina"/);
  assert.match(provider, /Descanso \{formatExerciseRestTime/);
});
