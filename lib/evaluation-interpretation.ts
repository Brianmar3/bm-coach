import { TEST_DEFINITIONS } from "../lib/evaluation-workflow.ts";
import type { EvaluationWorkflow } from "../types/evaluation-workflow.ts";
import type { EvaluationAlert, EvaluationAsymmetry, EvaluationInterpretation, EvaluationPriority, EvaluationPriorityLevel, EvaluationValidity } from "../types/evaluation-interpretation.ts";

type EvaluationInterpretationInput = Pick<EvaluationWorkflow, "id" | "status" | "date" | "completionPercentage" | "primaryGoal" | "reassessmentDate" | "bodyIssues" | "testResults">;

// Umbrales deportivos conservadores para detectar diferencias, no para diagnosticar:
// se exige simultáneamente 15% y una diferencia absoluta mínima acorde a la unidad.
export const ASYMMETRY_PERCENT_THRESHOLD = 15;
export const ASYMMETRY_ABSOLUTE_THRESHOLDS: Record<string, number> = { cm: 2, s: 5, "°": 5, rep: 2 };
export const REASSESSMENT_DUE_SOON_DAYS = 21;

const levelRank: Record<EvaluationPriorityLevel, number> = { prioritaria: 0, atención: 1, informativa: 2 };
const normalize = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const testLabel = (key: string) => TEST_DEFINITIONS.find((item) => item.key === key)?.name ?? key.replaceAll("_", " ");
const rounded = (value: number) => Math.round(value * 10) / 10;

function addPriority(target: EvaluationPriority[], priority: EvaluationPriority) {
  const duplicate = target.find((item) => item.id === priority.id);
  if (!duplicate) target.push(priority);
}

function dateDiffDays(from: string, to: string) {
  const start = Date.parse(`${from}T12:00:00.000Z`); const end = Date.parse(`${to}T12:00:00.000Z`);
  return Number.isFinite(start) && Number.isFinite(end) ? Math.round((end - start) / 86400000) : null;
}

export function evaluationValidity(evaluation: Pick<EvaluationWorkflow, "reassessmentDate" | "status"> | null, today: string): EvaluationValidity {
  if (!evaluation) return "NO_EVALUATION";
  if (evaluation.status === "REASSESSMENT_RECOMMENDED") return "REASSESSMENT_RECOMMENDED";
  if (!evaluation.reassessmentDate) return "CURRENT";
  const days = dateDiffDays(today, evaluation.reassessmentDate);
  if (days === null) return "CURRENT";
  if (days < 0) return "REASSESSMENT_RECOMMENDED";
  return days <= REASSESSMENT_DUE_SOON_DAYS ? "DUE_SOON" : "CURRENT";
}

export function calculateAsymmetry(evaluation: Pick<EvaluationInterpretationInput, "testResults">): EvaluationAsymmetry[] {
  return evaluation.testResults.flatMap((test) => {
    if (test.rightValue === null || test.leftValue === null || !test.rightUnit || test.rightUnit !== test.leftUnit) return [];
    const maximum = Math.max(Math.abs(test.rightValue), Math.abs(test.leftValue));
    if (maximum === 0) return [];
    const absoluteDifference = rounded(Math.abs(test.rightValue - test.leftValue));
    const percentageDifference = rounded(absoluteDifference / maximum * 100);
    const absoluteThreshold = ASYMMETRY_ABSOLUTE_THRESHOLDS[test.rightUnit] ?? 1;
    return [{ testKey: test.testKey, label: testLabel(test.testKey), unit: test.rightUnit, rightValue: test.rightValue, leftValue: test.leftValue, absoluteDifference, percentageDifference, lowerSide: test.rightValue < test.leftValue ? "RIGHT" as const : "LEFT" as const, relevant: absoluteDifference >= absoluteThreshold && percentageDifference >= ASYMMETRY_PERCENT_THRESHOLD }];
  });
}

export function interpretEvaluation(evaluation: EvaluationInterpretationInput | null, today: string): EvaluationInterpretation {
  if (!evaluation) return { evaluationId: "", generatedAt: today, validity: "NO_EVALUATION", strengths: [], priorities: [], limitations: [], asymmetries: [], alerts: [], recommendations: [], missingData: ["Sin evaluación completada"], suggestedReassessmentDate: "", sufficientData: false };
  const priorities: EvaluationPriority[] = []; const alerts: EvaluationAlert[] = []; const strengths: string[] = []; const limitations: string[] = []; const recommendations: string[] = [];
  const performed = evaluation.testResults.filter((test) => test.status !== "NOT_PERFORMED");
  const missingData = evaluation.completionPercentage < 100 ? [`Evaluación ${evaluation.completionPercentage}% completa`] : [];
  if (!evaluation.primaryGoal) missingData.push("Objetivo principal");
  if (!performed.length) missingData.push("Tests realizados");

  for (const test of performed) {
    const label = testLabel(test.testKey); const status = normalize(test.status);
    if (status.includes("correct")) strengths.push(`${label}: resultado registrado como correcto.`);
    if (status.includes("prior")) addPriority(priorities, { id: `test:${test.testKey}`, category: test.category === "MOBILITY" ? "movilidad" : test.testKey.includes("PLANK") ? "zona media" : test.testKey.includes("BALANCE") ? "equilibrio" : "fuerza", origin: label, level: "prioritaria", message: `${label} requiere atención prioritaria.`, evidence: `Estado registrado: ${test.status}.`, recommendation: "Revisar la variante, la técnica y la progresión antes de aumentar la exigencia." });
    else if (status.includes("improv")) addPriority(priorities, { id: `test:${test.testKey}`, category: test.category === "MOBILITY" ? "movilidad" : "técnica", origin: label, level: "atención", message: `${label} aparece como mejorable.`, evidence: `Estado registrado: ${test.status}.`, recommendation: "Incluir práctica progresiva y revisar la respuesta durante la rutina." });
    if (test.testKey === "KNEE_TO_WALL" && (status.includes("improv") || status.includes("prior"))) addPriority(priorities, { id: "ankle-mobility", category: "movilidad", origin: label, level: status.includes("prior") ? "prioritaria" : "atención", message: "Movilidad de tobillo reducida.", evidence: `Estado registrado en ${label}: ${test.status}.`, recommendation: "Priorizar movilidad de tobillo y considerar adaptar profundidad o variante de sentadilla, sin bloquearla." });
    if (["FRONT_PLANK", "SIDE_PLANK", "FRONT_PLANK_CONTROL", "SIDE_PLANK_CONTROL"].includes(test.testKey) && (status.includes("improv") || status.includes("prior"))) addPriority(priorities, { id: "core-endurance", category: "zona media", origin: label, level: status.includes("prior") ? "prioritaria" : "atención", message: "La estabilidad o resistencia de zona media requiere progresión.", evidence: `Estado registrado en ${label}: ${test.status}.`, recommendation: "Progresar estabilidad y control de zona media con variantes toleradas." });
    if (test.pain || test.rightPain || test.leftPain) alerts.push({ id: `test-pain:${test.testKey}`, level: "prioritaria", origin: label, message: `Molestia informada durante ${label}. Revisar tolerancia; no implica diagnóstico.` });
  }

  for (const issue of evaluation.bodyIssues.filter((item) => item.status !== "RESOLVED")) {
    if (!issue.hasPain && issue.status !== "CURRENT" && issue.status !== "RECURRENT") continue;
    const side = issue.side === "RIGHT" ? "derecho" : issue.side === "LEFT" ? "izquierdo" : issue.side === "BOTH" ? "bilateral" : "central";
    addPriority(priorities, { id: `issue:${issue.bodyZone}:${issue.side}`, category: "molestia", origin: issue.bodyZone, level: issue.hasPain || (issue.intensity ?? 0) >= 7 ? "prioritaria" : "atención", message: `Molestia relevante en ${issue.bodyZone} (${side}).`, evidence: issue.intensity === null ? `Estado registrado: ${issue.status}.` : `Intensidad registrada: ${issue.intensity}/10.`, recommendation: "Controlar tolerancia y volumen; adaptar el ejercicio si reproduce dolor." });
    alerts.push({ id: `issue:${issue.bodyZone}:${issue.side}`, level: issue.hasPain ? "prioritaria" : "atención", origin: issue.bodyZone, message: `Molestia ${issue.status === "RECURRENT" ? "recurrente" : "actual"} en ${issue.bodyZone} (${side}).` });
  }

  const asymmetries = calculateAsymmetry(evaluation);
  for (const item of asymmetries.filter((entry) => entry.relevant)) {
    const lower = item.lowerSide === "RIGHT" ? "derecho" : "izquierdo";
    addPriority(priorities, { id: `asymmetry:${item.testKey}`, category: "asimetría", origin: item.label, level: "atención", message: `Diferencia relevante entre lados en ${item.label}.`, evidence: `${item.absoluteDifference} ${item.unit} (${item.percentageDifference}%); menor resultado: lado ${lower}.`, recommendation: "Considerar trabajo unilateral y adaptar la progresión al lado de menor resultado." });
    alerts.push({ id: `asymmetry:${item.testKey}`, level: "atención", origin: item.label, message: `Asimetría relevante: lado ${lower} con menor resultado.` });
  }

  const validity = evaluationValidity(evaluation, today);
  if (validity === "REASSESSMENT_RECOMMENDED") alerts.push({ id: "reassessment", level: "atención", origin: "Vigencia", message: "Reevaluación recomendada." });
  if (missingData.length) alerts.push({ id: "incomplete", level: "informativa", origin: "Completitud", message: `Datos insuficientes para conclusiones fuertes: falta ${missingData.join(", ")}.` });
  priorities.sort((left, right) => levelRank[left.level] - levelRank[right.level] || left.category.localeCompare(right.category, "es"));
  for (const priority of priorities) { limitations.push(priority.message); if (!recommendations.includes(priority.recommendation)) recommendations.push(priority.recommendation); }
  return { evaluationId: evaluation.id, generatedAt: today, validity, strengths: [...new Set(strengths)], priorities, limitations: [...new Set(limitations)], asymmetries, alerts: alerts.filter((alert, index) => alerts.findIndex((item) => item.id === alert.id) === index).sort((a, b) => levelRank[a.level] - levelRank[b.level]).slice(0, 5), recommendations, missingData, suggestedReassessmentDate: evaluation.reassessmentDate, sufficientData: missingData.length === 0 };
}

export function contextualExerciseSuggestions(name: string, muscleGroup: string, interpretation: EvaluationInterpretation | null) {
  if (!interpretation) return [];
  const exercise = normalize(`${name} ${muscleGroup}`); const messages: string[] = [];
  if (interpretation.priorities.some((item) => item.id === "ankle-mobility") && /sentadilla|squat|zancada|lunge/.test(exercise)) messages.push("Movilidad de tobillo limitada. Considerá adaptar profundidad o variante.");
  if (interpretation.priorities.some((item) => item.category === "molestia" && normalize(item.origin).includes("hombro")) && /press militar|overhead|sobre cabeza|hombro/.test(exercise)) messages.push("Molestia de hombro informada. Revisá tolerancia y técnica.");
  if (interpretation.priorities.some((item) => item.category === "asimetría") && /sentadilla|peso muerto|press|remo|pierna|brazo/.test(exercise) && !/unilateral|una pierna|un brazo|bulgara/.test(exercise)) messages.push("Existe una asimetría relevante. Considerá una variante unilateral cuando corresponda.");
  return messages;
}

export function uncoveredPriorityReminders(priorities: EvaluationPriority[], exercises: Array<{ name: string; muscleGroup: string }>) {
  const content = normalize(exercises.map((item) => `${item.name} ${item.muscleGroup}`).join(" "));
  return priorities.flatMap((priority) => {
    const covered = priority.category === "asimetría" ? /unilateral|una pierna|un brazo|bulgara/.test(content) : priority.id === "ankle-mobility" ? /tobillo|dorsiflex|movilidad/.test(content) : priority.category === "zona media" ? /core|plancha|dead bug|bird dog|pallof/.test(content) : priority.category === "equilibrio" ? /equilibrio|unipodal/.test(content) : true;
    return covered ? [] : [{ id: priority.id, message: `La prioridad “${priority.message}” todavía no aparece en la rutina.` }];
  });
}
