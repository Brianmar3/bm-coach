import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("../componentes/use-workout-timer-audio.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

function harness() {
  const items: FakeAudio[] = [];
  class FakeAudio extends EventTarget {
    src: string; plays = 0; pauses = 0; currentTime = 0; muted = false; preload = ""; volume = 1; reject = false;
    constructor(src: string) { super(); this.src = src; items.push(this); }
    load() {}
    pause() { this.pauses++; }
    removeAttribute() {}
    play() { this.plays++; return this.reject ? Promise.reject(new Error("Blocked")) : Promise.resolve(); }
  }
  const cleanup: Array<() => void> = [];
  const exported: { useWorkoutTimerAudio?: (sounds: string[]) => { feedback: (sound: string, vibrate?: boolean) => void; prime: (sound: string) => void } } = {};
  new Function("require", "exports", "Audio", "navigator", code)((name: string) => name === "react" ? {
    useRef: (current: unknown) => ({ current }), useCallback: (fn: unknown) => fn,
    useEffect: (fn: () => () => void) => cleanup.push(fn()),
  } : { BLOCK_TIMER_AUDIO: { restFinish: "/audio/rest-finish-triple.wav", work: "work", rest: "rest", finish: "finish" } }, exported, FakeAudio, { vibrate() {} });
  return { items, audio: exported.useWorkoutTimerAudio!(["restFinish", "work", "rest", "finish"]), cleanup };
}

test("el WAV contiene exactamente tres copias de la campana original separadas por 180 ms de silencio", () => {
  const original = readFileSync(new URL("../public/audio/rest-finish.wav", import.meta.url));
  const triple = readFileSync(new URL("../public/audio/rest-finish-triple.wav", import.meta.url));
  assert.equal(triple.toString("ascii", 0, 4), "RIFF");
  assert.equal(triple.readUInt32LE(4), triple.length - 8);
  assert.deepEqual(triple.subarray(20, 36), original.subarray(20, 36));
  const bell = original.subarray(44), gap = Buffer.alloc(original.readUInt32LE(28) * .18);
  assert.deepEqual(triple.subarray(44), Buffer.concat([bell, gap, bell, gap, bell]));
  assert.equal(triple.subarray(44).length / triple.readUInt32LE(28), 2.52);
});

test("un aviso reproduce una sola vez el archivo completo y descarta avisos rápidos repetidos", async () => {
  const { audio, items } = harness();
  audio.feedback("restFinish", false); audio.feedback("restFinish", false); audio.prime("restFinish");
  await Promise.resolve();
  assert.equal(items[0].plays, 1);
  items[0].dispatchEvent(new Event("ended"));
  audio.feedback("restFinish", false);
  assert.equal(items[0].plays, 2);
});

test("el rechazo de autoplay o error permite reintentar, sin afectar al temporizador", async () => {
  const { audio, items } = harness();
  items[0].reject = true; audio.feedback("restFinish", false); await Promise.resolve();
  items[0].reject = false; audio.feedback("restFinish", false); assert.equal(items[0].plays, 2);
  items[0].dispatchEvent(new Event("error")); audio.feedback("restFinish", false); assert.equal(items[0].plays, 3);
});

test("la preparación pendiente no interrumpe una secuencia que acaba de empezar", async () => {
  const { audio, items } = harness(); audio.prime("restFinish"); audio.feedback("restFinish", false);
  const pauses = items[0].pauses; await Promise.resolve(); assert.equal(items[0].pauses, pauses);
});

test("los sonidos de bloques mantienen su reproducción y pueden interrumpir como antes", () => {
  const { audio, items } = harness(); audio.feedback("work", false); audio.feedback("work", false);
  assert.equal(items[1].plays, 2); audio.feedback("restFinish", false); audio.feedback("rest", false); audio.feedback("restFinish", false);
  assert.equal(items[0].plays, 2);
});
