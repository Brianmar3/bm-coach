import test from "node:test";
import assert from "node:assert/strict";
import { chronologicalMetric, comparableTestChange, deduplicateEvaluations, normalizeEvaluation, resolveEvaluationPlanningFields, selectEvaluationForPlanning, toStudentEvaluation } from "../lib/evaluation-read-model.ts";

test("prioriza mediciones estructuradas y calcula IMC", () => {
  const item = normalizeEvaluation({ id: "new", studentId: "s1", date: "2026-08-08", generalData: { height: 1.8, ageSnapshot: 32, weight: 70 }, weight: 68, measurements: [{ measurementType: "WEIGHT", side: null, value: 81, unit: "kg", notes: "" }, { measurementType: "WAIST", side: null, value: 90, unit: "cm", notes: "" }] });
  assert.equal(item.weight, 81); assert.equal(item.waist, 90); assert.equal(item.height, 1.8); assert.equal(item.age, 32); assert.equal(item.bmi, 25);
});

test("recupera datos históricos planos y alias bodyFat", () => {
  const item = normalizeEvaluation({ id: "old", studentId: "s1", date: "2025-01-01", weight: "72.5", height: "1.70", bodyFat: "22", hip: 98, source: "LEGACY_JSON" });
  assert.equal(item.weight, 72.5); assert.equal(item.bodyFatPercentage, 22); assert.equal(item.hip, 98); assert.equal(item.bmi, 25.1);
});

test("los faltantes se representan como null y nunca como cero", () => {
  const item = normalizeEvaluation({ id: "empty", weight: 0, waist: "" });
  assert.equal(item.weight, null); assert.equal(item.waist, null); assert.equal(item.bmi, null);
});

test("normaliza molestias y resultados de tests", () => {
  const item = normalizeEvaluation({ id: "structured", bodyIssues: [{ bodyZone: "Rodilla derecha", intensity: 7, hasPain: true, status: "ACTIVE", trainerObservation: "Privado" }], testResults: [{ testKey: "FRONT_PLANK", category: "PHYSICAL", status: "GOOD", numericValue: 45, unit: "s", protocol: "A", variation: "suelo" }] });
  assert.equal(item.bodyIssues[0]?.intensity, 7); assert.equal(item.testResults[0]?.numericValue, 45); assert.equal(item.testResults[0]?.status, "GOOD");
});

test("conserva versiones físicas del mismo día y elimina su duplicado legado", () => {
  const base = { studentId: "s1", studentName: "Alumno", date: "2026-08-08" };
  const items = deduplicateEvaluations([normalizeEvaluation({ ...base, id: "p1", version: 1 }), normalizeEvaluation({ ...base, id: "p2", version: 2 }), normalizeEvaluation({ ...base, id: "legacy", source: "LEGACY_JSON" })]);
  assert.deepEqual(items.map((item) => item.id), ["p2", "p1"]);
});

test("ordena puntos cronológicamente omitiendo faltantes", () => {
  const points = chronologicalMetric([normalizeEvaluation({ id: "b", date: "2026-02-01", weight: 75 }), normalizeEvaluation({ id: "a", date: "2026-01-01", weight: 77 }), normalizeEvaluation({ id: "c", date: "2026-03-01" })], "weight");
  assert.deepEqual(points.map((item) => item.value), [77, 75]);
});

test("sólo compara tests con protocolo, variante y unidad compatibles", () => {
  const current = { testKey: "FRONT_PLANK", category: "PHYSICAL" as const, status: "GOOD", numericValue: 50, unit: "s", rightValue: null, leftValue: null, rightUnit: "", leftUnit: "", pain: false, rightPain: false, leftPain: false, protocol: "A", variation: "suelo", observations: "", compensations: "", notPerformedReason: "", rawResult: {} };
  assert.equal(comparableTestChange(current, { ...current, numericValue: 40 }), 10);
  assert.equal(comparableTestChange(current, { ...current, numericValue: 40, variation: "banco" }), null);
});

test("la proyección del alumno elimina información privada", () => {
  const item = normalizeEvaluation({ id: "private", trainerName: "Coach", habits: { sleep: "mal" }, finalStrengths: "Privado", planningNotes: "Privado", bodyIssues: [{ bodyZone: "Hombro", trainerObservation: "Privado" }], testResults: [{ testKey: "DEEP_SQUAT", category: "MOBILITY", observations: "Privado", protocol: "Privado" }] });
  const student = toStudentEvaluation(item);
  assert.equal("trainerName" in student, false); assert.equal("habits" in student, false); assert.equal("planningNotes" in student, false); assert.equal(student.bodyIssues[0]?.trainerObservation, ""); assert.equal(student.testResults[0]?.observations, ""); assert.equal(student.testResults[0]?.protocol, "");
});

test("prioriza campos estructurados y recupera aliases históricos de planificación", () => {
  assert.equal(resolveEvaluationPlanningFields({ primaryGoal: "Ganancia de masa muscular", generalData: { goal: "Aumento masa muscular" } }).primaryGoal, "Ganancia de masa muscular");
  assert.deepEqual(resolveEvaluationPlanningFields({ generalData: { objective: "Fuerza", level: "Intermedio", availability: "3 días" } }), { primaryGoal: "Fuerza", secondaryGoals: [], experienceLevel: "Intermedio", weeklyAvailability: "3 días" });
});

test("regresión Brian: elige la evaluación reciente con objetivo aunque esté en progreso", () => {
  const selected = selectEvaluationForPlanning([
    { id: "v3", status: "IN_PROGRESS", primaryGoal: "Ganancia de masa muscular", experienceLevel: "Intermedio", weeklyAvailability: "3", testResults: [{ id: "t1" }], bodyIssues: [] },
    { id: "v2", status: "COMPLETED", primaryGoal: "", experienceLevel: "", weeklyAvailability: "", testResults: [], bodyIssues: [] },
  ]);
  assert.equal(selected?.id, "v3"); assert.equal(selected?.primaryGoal, "Ganancia de masa muscular");
});
