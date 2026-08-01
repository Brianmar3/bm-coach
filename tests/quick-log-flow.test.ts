import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  EMPTY_QUICK_LOG_DRAFT,
  exerciseSuggestions,
  quickLogPayload,
  quickLogSummary,
  validateQuickLogDraft,
  type QuickLogDraft,
} from "../lib/quick-log-flow.ts";

const draft = (values: Partial<QuickLogDraft>): QuickLogDraft => ({ ...EMPTY_QUICK_LOG_DRAFT, ...values });
const summaryLog = (values: Partial<Parameters<typeof quickLogSummary>[0]>): Parameters<typeof quickLogSummary>[0] => ({
  type: "WORKOUT", title: "", content: "", category: "", metricType: "", exerciseName: "", sets: null,
  repetitions: null, durationMinutes: null, currentValue: null, previousValue: null, unit: "", ...values,
});

test("el registro abre con tres opciones simples", () => {
  const source = readFileSync(new URL("../componentes/quick-log.tsx", import.meta.url), "utf8");
  assert.match(source, /¿Qué querés anotar\?/);
  assert.match(source, /Ejercicio de fuerza/);
  assert.match(source, /Circuito o desafío/);
  assert.match(source, /Otro registro/);
  assert.doesNotMatch(source.slice(source.indexOf("!category &&"), source.indexOf("category === \"circuit\"")), /FOR_TIME|ROUNDS|INTERVALS|CONDITIONING/);
});

test("el autocompletado ignora acentos, prioriza recientes y limita a seis", () => {
  const options = [
    { name: "Press militar", recent: false },
    { name: "Prensa", recent: true, lastUsedAt: "2026-08-01" },
    { name: "Pájaros", recent: false },
    { name: "Plancha", recent: false },
    { name: "Peso muerto", recent: false },
    { name: "Puente de glúteos", recent: false },
    { name: "Pull over", recent: false },
  ];
  const result = exerciseSuggestions(options, "p");
  assert.equal(result.length, 6);
  assert.equal(result[0].name, "Prensa");
  assert.equal(exerciseSuggestions(options, "paj")[0].name, "Pájaros");
});

test("fuerza admite un ejercicio personalizado y peso corporal sin carga", () => {
  const input = draft({ kind: "strength", exercise: "Flexiones con pausa", sets: "4", repetitions: "8" });
  assert.deepEqual(validateQuickLogDraft(input), {});
  const payload = quickLogPayload(input, "2026-08-01");
  assert.equal(payload.type, "PROGRESS");
  assert.equal(payload.metricType, "carga");
  assert.equal(payload.currentValue, "");
  assert.equal(payload.exerciseName, "Flexiones con pausa");
});

test("fuerza conserva RIR o RPE, descanso y observación como detalles opcionales", () => {
  const payload = quickLogPayload(draft({ kind: "strength", exercise: "Sentadilla", sets: "4", repetitions: "8", weight: "40", effortType: "RIR", effort: "2", restSeconds: "90", note: "Buena técnica" }), "2026-08-01");
  assert.equal(payload.content, "RIR 2 · Descanso: 90 s · Buena técnica");
  assert.equal(quickLogSummary(summaryLog({ type: "PROGRESS", metricType: "carga", exerciseName: "Sentadilla", sets: 4, repetitions: 8, currentValue: 40, unit: "kg" })), "Sentadilla · 4 × 8 · 40 kg");
});

test("tiempo y vueltas se guardan estructurados y se leen de forma breve", () => {
  const timed = quickLogPayload(draft({ kind: "time", title: "Circuito", finalTime: "12:45" }), "2026-08-01");
  assert.equal(timed.metricType, "for_time");
  assert.equal(timed.currentValue, "765");
  assert.equal(quickLogSummary(summaryLog({ title: "Circuito", metricType: "for_time", currentValue: 765 })), "Circuito · 12:45");
  const rounds = quickLogPayload(draft({ kind: "rounds", title: "Circuito", rounds: "5", extraRepetitions: "8" }), "2026-08-01");
  assert.equal(rounds.sets, "5");
  assert.equal(quickLogSummary(summaryLog({ title: "Circuito", metricType: "rounds", sets: 5, repetitions: 8 })), "Circuito · 5 vueltas + 8 repeticiones");
});

test("AMRAP y EMOM conservan duración y resultado", () => {
  const amrap = quickLogPayload(draft({ kind: "amrap", title: "AMRAP", durationMinutes: "12", rounds: "5", extraRepetitions: "8" }), "2026-08-01");
  assert.equal(amrap.metricType, "amrap");
  assert.equal(quickLogSummary(summaryLog({ metricType: "amrap", durationMinutes: 12, sets: 5, repetitions: 8 })), "AMRAP 12 min · 5 vueltas + 8");
  const emom = quickLogPayload(draft({ kind: "emom", title: "EMOM", durationMinutes: "10", completedMinutes: "10" }), "2026-08-01");
  assert.equal(emom.metricType, "emom");
  assert.equal(quickLogSummary(summaryLog({ metricType: "emom", durationMinutes: 10, sets: 10 })), "EMOM 10 min · 10/10 completados");
});

test("cardio, intervalos y nota libre usan métricas internas diferentes", () => {
  const cardio = quickLogPayload(draft({ kind: "cardio", activity: "Caminata", durationMinutes: "35", distance: "3,8" }), "2026-08-01");
  assert.equal(cardio.metricType, "cardio");
  assert.equal(quickLogSummary(summaryLog({ metricType: "cardio", exerciseName: "Caminata", durationMinutes: 35, currentValue: 3.8, unit: "km" })), "Caminata · 35 min · 3,8 km");
  const intervals = quickLogPayload(draft({ kind: "intervals", activity: "Bicicleta", rounds: "8", workSeconds: "30", restSeconds: "30" }), "2026-08-01");
  assert.equal(intervals.metricType, "intervals");
  assert.equal(intervals.previousValue, "30");
  assert.equal(quickLogPayload(draft({ kind: "note", note: "Hoy me sentí con energía" }), "2026-08-01").metricType, "free_note");
});

test("las validaciones breves se asocian al campo mínimo faltante", () => {
  assert.equal(validateQuickLogDraft(draft({ kind: "strength" })).exercise, "Elegí o escribí un ejercicio.");
  assert.equal(validateQuickLogDraft(draft({ kind: "time", title: "Circuito" })).finalTime, "Ingresá el tiempo.");
  assert.equal(validateQuickLogDraft(draft({ kind: "rounds", title: "Circuito" })).rounds, "Ingresá las vueltas.");
});

test("volver conserva el borrador y la barra móvil respeta safe area", () => {
  const source = readFileSync(new URL("../componentes/quick-log.tsx", import.meta.url), "utf8");
  const back = source.slice(source.indexOf("function back()"), source.indexOf("async function save"));
  assert.doesNotMatch(back, /setDraft/);
  assert.match(source, /sticky bottom-0/);
  assert.match(source, /env\(safe-area-inset-bottom\)/);
  assert.match(source, /pb-36/);
});

test("el doble toque queda cubierto por bloqueo local e idempotencia persistida", () => {
  const component = readFileSync(new URL("../componentes/quick-log.tsx", import.meta.url), "utf8");
  const api = readFileSync(new URL("../app/api/portal/quick-logs/route.ts", import.meta.url), "utf8");
  assert.match(component, /savingLock\.current/);
  assert.match(component, /crypto\.randomUUID/);
  assert.match(api, /idempotencyKey/);
  assert.match(api, /TransactionIsolationLevel\.Serializable/);
});

test("los registros antiguos mantienen un resumen compatible", () => {
  assert.equal(quickLogSummary(summaryLog({ type: "NOTE", title: "Nota anterior", content: "Texto histórico", category: "general" })), "Nota anterior");
  assert.equal(quickLogSummary(summaryLog({ type: "WORKOUT", content: "Entrenamiento histórico" })), "Entrenamiento histórico");
});

test("las sugerencias y registros derivan el alumno desde la sesión", () => {
  const suggestions = readFileSync(new URL("../app/api/portal/quick-logs/exercises/route.ts", import.meta.url), "utf8");
  const records = readFileSync(new URL("../app/api/portal/quick-logs/route.ts", import.meta.url), "utf8");
  assert.match(suggestions, /getPortalSession/);
  assert.match(suggestions, /studentId: session\.studentId/);
  assert.doesNotMatch(suggestions, /searchParams\.get\("studentId"\)/);
  assert.match(records, /studentId: session\.studentId/);
});
