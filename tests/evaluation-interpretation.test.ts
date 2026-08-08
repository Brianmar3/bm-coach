import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { contextualExerciseSuggestions, interpretEvaluation, uncoveredPriorityReminders } from "../lib/evaluation-interpretation.ts";
import type { EvaluationWorkflow } from "../types/evaluation-workflow.ts";

function evaluation(overrides: Partial<EvaluationWorkflow> = {}): EvaluationWorkflow {
  return { id: "e1", studentId: "s1", studentName: "Alumno", version: 1, status: "COMPLETED", date: "2026-08-08", currentStep: 8, completionPercentage: 100, trainerName: "Coach", primaryGoal: "Fuerza", secondaryGoals: [], experienceLevel: "Intermedio", weeklyAvailability: "3 días", generalData: {}, habits: {}, trainingObservations: {}, trainerNotes: "", finalStrengths: "", finalPriorities: "", finalLimitations: "", planningNotes: "", finalComment: "", reassessmentDate: "2026-11-08", completedAt: "2026-08-08", createdAt: "2026-08-08", updatedAt: "2026-08-08", measurements: [{ measurementType: "WEIGHT", side: null, value: 70, unit: "kg", notes: "" }], bodyIssues: [], testResults: [], ...overrides };
}

function testResult(testKey: string, status = "CORRECT") {
  return { testKey, category: "MOBILITY" as const, status, numericValue: null, unit: "cm", rightValue: null, leftValue: null, rightUnit: "cm", leftUnit: "cm", pain: false, rightPain: false, leftPain: false, protocol: "estándar", variation: "", observations: "", compensations: "", notPerformedReason: "", rawResult: {} };
}

test("movilidad de tobillo reducida genera prioridad sin bloquear sentadilla", () => {
  const result = interpretEvaluation(evaluation({ testResults: [testResult("KNEE_TO_WALL", "IMPROVABLE")] }), "2026-08-10");
  assert.ok(result.priorities.some((item) => item.id === "ankle-mobility" && item.recommendation.includes("sin bloquearla")));
  assert.match(contextualExerciseSuggestions("Sentadilla goblet", "Cuádriceps", result)[0] ?? "", /adaptar profundidad/);
});

test("asimetría relevante informa diferencia, porcentaje y lado menor", () => {
  const result = interpretEvaluation(evaluation({ testResults: [{ ...testResult("KNEE_TO_WALL"), rightValue: 8, leftValue: 12 }] }), "2026-08-10");
  assert.equal(result.asymmetries[0]?.relevant, true); assert.equal(result.asymmetries[0]?.lowerSide, "RIGHT");
  assert.ok(result.priorities.some((item) => item.category === "asimetría" && item.evidence.includes("33.3%")));
});

test("zona media mejorable genera recomendación de estabilidad", () => {
  const result = interpretEvaluation(evaluation({ testResults: [{ ...testResult("FRONT_PLANK", "IMPROVABLE"), category: "PHYSICAL" }] }), "2026-08-10");
  assert.ok(result.priorities.some((item) => item.id === "core-endurance" && item.recommendation.includes("estabilidad")));
});

test("dolor genera alerta visible sin diagnóstico ni tratamiento", () => {
  const result = interpretEvaluation(evaluation({ bodyIssues: [{ bodyZone: "Hombro derecho", side: "RIGHT", intensity: 7, hasPain: true, status: "CURRENT", studentDescription: "Molestia", trainerObservation: "", approximateDate: "" }] }), "2026-08-10");
  assert.ok(result.alerts.some((item) => item.message.includes("Hombro derecho")));
  assert.ok(result.recommendations.every((item) => !/diagnóstico|tratamiento recomendado/i.test(item)));
});

test("test prioritario se ordena antes que uno mejorable y no duplica prioridades", () => {
  const result = interpretEvaluation(evaluation({ testResults: [testResult("DEEP_SQUAT", "PRIORITY"), testResult("KNEE_TO_WALL", "IMPROVABLE"), testResult("KNEE_TO_WALL", "IMPROVABLE")] }), "2026-08-10");
  assert.equal(result.priorities[0]?.level, "prioritaria");
  assert.equal(new Set(result.priorities.map((item) => item.id)).size, result.priorities.length);
});

test("reevaluación vencida cambia vigencia y crea alerta", () => {
  const result = interpretEvaluation(evaluation({ reassessmentDate: "2026-08-01" }), "2026-08-10");
  assert.equal(result.validity, "REASSESSMENT_RECOMMENDED"); assert.ok(result.alerts.some((item) => item.id === "reassessment"));
});

test("datos insuficientes evitan conclusiones fuertes", () => {
  const result = interpretEvaluation(evaluation({ completionPercentage: 60, primaryGoal: "", measurements: [], testResults: [] }), "2026-08-10");
  assert.equal(result.sufficientData, false); assert.ok(result.missingData.length >= 2); assert.ok(result.alerts.some((item) => item.id === "incomplete"));
});

test("sugerencias contextuales y recordatorios son no bloqueantes", () => {
  const result = interpretEvaluation(evaluation({ bodyIssues: [{ bodyZone: "Hombro derecho", side: "RIGHT", intensity: 5, hasPain: true, status: "CURRENT", studentDescription: "", trainerObservation: "", approximateDate: "" }], testResults: [{ ...testResult("KNEE_TO_WALL"), rightValue: 8, leftValue: 12 }] }), "2026-08-10");
  assert.match(contextualExerciseSuggestions("Press militar", "Hombros", result)[0] ?? "", /tolerancia/);
  assert.ok(uncoveredPriorityReminders(result.priorities, [{ name: "Sentadilla", muscleGroup: "Piernas" }]).some((item) => item.id.startsWith("asymmetry:")));
});

test("Rutinas integra evaluación sólo para servicios elegibles y simplifica el panel", () => {
  const page = readFileSync(new URL("../app/rutinas/page.tsx", import.meta.url), "utf8");
  const panel = readFileSync(new URL("../componentes/routine-evaluation-panel.tsx", import.meta.url), "utf8");
  assert.match(page, /RoutineEvaluationPanel/); assert.match(panel, /student\.serviceType === "CLASSES"/);
  assert.match(panel, /Ver evaluación completa/); assert.match(panel, /Esto no bloquea/); assert.match(panel, /Ignorar/);
  assert.doesNotMatch(page, /Ejercicios planificados|Alumnos con rutina|Crear borrador y revisar/);
  assert.match(page, /status: mode === "saveAsTemplate" \? "borrador" : "activa"/);
  assert.match(page, /Activar rutina/);
});

test("el creador exige alumno, conserva evaluación y oculta la interfaz de IA", () => {
  const page = readFileSync(new URL("../app/rutinas/page.tsx", import.meta.url), "utf8");
  const panel = readFileSync(new URL("../componentes/routine-evaluation-panel.tsx", import.meta.url), "utf8");
  const modernEditor = page.slice(page.indexOf("function RoutineEditor"), page.indexOf("function BlockEditor"));
  assert.match(panel, /slice\(0, 2\)/); assert.match(panel, /p-3/); assert.match(panel, /evaluation\.primaryGoal/);
  assert.match(page, /¿Para quién es esta rutina\?/); assert.match(modernEditor, /form\.studentIds\.length === 0/);
  assert.match(page, /Alumno seleccionado/); assert.match(page, /Cambiar alumno/);
  assert.doesNotMatch(page, /RoutineAIProposalPanel|applyAIProposal|\/api\/admin\/rutinas\/propuesta/);
  assert.match(modernEditor, /min-h-14 w-28/); assert.match(modernEditor, /sm:w-32/); assert.match(modernEditor, /border-zinc-700 bg-zinc-800/);
  assert.doesNotMatch(page, /Crear borrador y revisar/);
});

test("el portal usa selector de métrica y tres tarjetas superiores", () => {
  const insights = readFileSync(new URL("../componentes/evaluation-insights.tsx", import.meta.url), "utf8");
  const portal = readFileSync(new URL("../componentes/portal-evaluations-dashboard.tsx", import.meta.url), "utf8");
  assert.match(insights, /aria-label="Métrica de evolución"/); assert.match(insights, /onChange=\{\(event\) => setMetricKey/);
  assert.doesNotMatch(insights, /metrics\.map\(\(item\) => <button/);
  const cards = portal.slice(portal.indexOf('className="grid grid-cols-3'), portal.indexOf("<details open"));
  assert.match(cards, /Peso/); assert.match(cards, /IMC/); assert.match(cards, /Grasa corporal/); assert.doesNotMatch(cards, /Cintura/);
});

test("Evaluaciones del entrenador no contiene Vista Global y presenta buscador, filtros y lista", () => {
  const dashboard = readFileSync(new URL("../componentes/professional-evaluations-dashboard.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(dashboard, /EvaluationGlobalDashboard|Vista global|Seguimiento de evaluaciones/);
  assert.match(dashboard, /Buscar alumno/); assert.match(dashboard, /Estado evaluación/); assert.match(dashboard, /Vigencia/);
  assert.match(dashboard, /Resultados de alumnos/); assert.match(dashboard, /Ver evaluación/);
  assert.match(dashboard, /Seleccioná un alumno para abrir su dashboard profesional/);
});
