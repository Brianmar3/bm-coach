import { TEST_DEFINITIONS } from "../lib/evaluation-workflow.ts";
import { interpretEvaluation } from "../lib/evaluation-interpretation.ts";
import type { EvaluationMetricKey, NormalizedEvaluation, StudentEvaluation } from "../types/evaluation-read-model.ts";
import type { EvaluationBodyIssueValue, EvaluationTestValue } from "../types/evaluation-workflow.ts";
import type { AreaEvolution, AttentionItem, BMProgressIndex, BodyIssueEvolution, EvaluationComparison, EvaluationGlobalStats, EvaluationStudentSummary, MetricComparison, ProgressComponent, SymmetryComparison, TestResultComparison } from "../types/evaluation-progress.ts";

const round = (value: number) => Math.round(value * 10) / 10;
type ProgressEvaluation = NormalizedEvaluation | StudentEvaluation;
const clamp = (value: number) => Math.max(0, Math.min(100, round(value)));
const normalizedText = (value: string) => value.trim().normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const dateDiff = (from: string, to: string) => {
  const start = Date.parse(`${from}T12:00:00.000Z`); const end = Date.parse(`${to}T12:00:00.000Z`);
  return Number.isFinite(start) && Number.isFinite(end) ? Math.round((end - start) / 86400000) : null;
};

export const COMPARABLE_METRICS: Array<{ key: EvaluationMetricKey; label: string; unit: string }> = [
  { key: "weight", label: "Peso", unit: "kg" }, { key: "waist", label: "Cintura", unit: "cm" },
  { key: "hip", label: "Cadera", unit: "cm" }, { key: "chest", label: "Pecho", unit: "cm" },
  { key: "rightArm", label: "Brazo derecho", unit: "cm" }, { key: "leftArm", label: "Brazo izquierdo", unit: "cm" },
  { key: "rightThigh", label: "Muslo derecho", unit: "cm" }, { key: "leftThigh", label: "Muslo izquierdo", unit: "cm" },
  { key: "rightCalf", label: "Pantorrilla derecha", unit: "cm" }, { key: "leftCalf", label: "Pantorrilla izquierda", unit: "cm" },
  { key: "bodyFatPercentage", label: "Grasa corporal", unit: "%" },
];

export function compareMetric(previous: ProgressEvaluation, current: ProgressEvaluation, definition: typeof COMPARABLE_METRICS[number]): MetricComparison | null {
  const before = previous[definition.key]; const after = current[definition.key];
  if (typeof before !== "number" || typeof after !== "number") return null;
  const change = round(after - before);
  return { key: definition.key, label: definition.label, unit: definition.unit, previous: before, current: after, absoluteChange: change, percentageChange: before === 0 ? null : round(change / Math.abs(before) * 100), direction: change > 0 ? "INCREASED" : change < 0 ? "DECREASED" : "UNCHANGED" };
}

function rawProtocolCompatible(current: EvaluationTestValue, previous: EvaluationTestValue) {
  if (current.testKey !== "STEP_TEST") return true;
  const keys = ["height", "stepHeight", "duration", "protocol"];
  return keys.every((key) => {
    const left = previous.rawResult[key]; const right = current.rawResult[key];
    return left === undefined && right === undefined || left === right;
  });
}

export function areTestsCompatible(previous: EvaluationTestValue, current: EvaluationTestValue, side: "CENTER" | "RIGHT" | "LEFT" = "CENTER") {
  const unit = side === "RIGHT" ? current.rightUnit : side === "LEFT" ? current.leftUnit : current.unit;
  const previousUnit = side === "RIGHT" ? previous.rightUnit : side === "LEFT" ? previous.leftUnit : previous.unit;
  if (previous.testKey !== current.testKey || previous.category !== current.category) return { compatible: false, reason: "Test diferente" };
  if (!unit || unit !== previousUnit) return { compatible: false, reason: "Unidad diferente o ausente" };
  if (normalizedText(previous.variation) !== normalizedText(current.variation)) return { compatible: false, reason: "Variante diferente" };
  if (normalizedText(previous.protocol) !== normalizedText(current.protocol) || !rawProtocolCompatible(current, previous)) return { compatible: false, reason: "Protocolo diferente" };
  return { compatible: true, reason: "" };
}

function testLabel(key: string) { return TEST_DEFINITIONS.find((item) => item.key === key)?.name ?? key.replaceAll("_", " "); }

export function compareTests(previousTests: EvaluationTestValue[], currentTests: EvaluationTestValue[]): TestResultComparison[] {
  return currentTests.flatMap((current) => {
    const previous = previousTests.find((item) => item.testKey === current.testKey && item.category === current.category);
    if (!previous) return [];
    const sides: Array<"CENTER" | "RIGHT" | "LEFT"> = current.rightValue !== null || current.leftValue !== null || previous.rightValue !== null || previous.leftValue !== null ? ["RIGHT", "LEFT"] : ["CENTER"];
    return sides.map((side) => {
      const before = side === "RIGHT" ? previous.rightValue : side === "LEFT" ? previous.leftValue : previous.numericValue;
      const after = side === "RIGHT" ? current.rightValue : side === "LEFT" ? current.leftValue : current.numericValue;
      const unit = side === "RIGHT" ? current.rightUnit : side === "LEFT" ? current.leftUnit : current.unit;
      const validity = areTestsCompatible(previous, current, side);
      const numericComparable = validity.compatible && before !== null && after !== null;
      const change = numericComparable ? round(after - before) : null;
      return { testKey: current.testKey, label: testLabel(current.testKey), category: current.category, side, previous: before, current: after, unit, absoluteChange: change, percentageChange: numericComparable && before !== 0 ? round(change! / Math.abs(before) * 100) : null, previousStatus: previous.status, currentStatus: current.status, protocol: current.protocol, variation: current.variation, compatible: validity.compatible, incompatibilityReason: validity.reason };
    });
  });
}

export function calculateSymmetry(evaluation: ProgressEvaluation): SymmetryComparison[] {
  const result: SymmetryComparison[] = [];
  const pairs = [["ARM", "Brazo", evaluation.rightArm, evaluation.leftArm], ["THIGH", "Muslo", evaluation.rightThigh, evaluation.leftThigh], ["CALF", "Pantorrilla", evaluation.rightCalf, evaluation.leftCalf]] as const;
  for (const [key, label, right, left] of pairs) if (right !== null && left !== null) result.push(symmetry(`${key}`, label, "MEASUREMENT", right, left, "cm"));
  for (const test of evaluation.testResults) if (test.rightValue !== null && test.leftValue !== null && test.rightUnit && test.rightUnit === test.leftUnit) result.push(symmetry(test.testKey, testLabel(test.testKey), "TEST", test.rightValue, test.leftValue, test.rightUnit));
  return result;
}

function symmetry(key: string, label: string, source: "MEASUREMENT" | "TEST", right: number, left: number, unit: string): SymmetryComparison {
  const difference = round(Math.abs(right - left)); const maximum = Math.max(Math.abs(right), Math.abs(left));
  return { key, label, source, right, left, unit, absoluteDifference: difference, percentageDifference: maximum === 0 ? null : round(difference / maximum * 100), lowerSide: right === left ? "EQUAL" : right < left ? "RIGHT" : "LEFT" };
}

const issueKey = (issue: EvaluationBodyIssueValue) => `${normalizedText(issue.bodyZone)}|${normalizedText(issue.side || "CENTER")}`;
export function compareBodyIssues(previous: EvaluationBodyIssueValue[], current: EvaluationBodyIssueValue[]): BodyIssueEvolution[] {
  const before = new Map(previous.map((item) => [issueKey(item), item])); const after = new Map(current.map((item) => [issueKey(item), item]));
  return [...new Set([...before.keys(), ...after.keys()])].map((key) => {
    const prior = before.get(key) ?? null; const present = after.get(key) ?? null;
    return { key, bodyZone: present?.bodyZone ?? prior?.bodyZone ?? "", side: present?.side ?? prior?.side ?? "CENTER", state: prior && present ? "PERSISTENT" : present ? "NEW" : "NO_LONGER_REPORTED", previous: prior, current: present };
  });
}

function stateBand(status: string) {
  const value = normalizedText(status);
  if (/correct|normal|good|completed|adecuad/.test(value)) return "CORRECT";
  if (/improv|regular|limited|mejor/.test(value)) return "IMPROVABLE";
  if (/prior|poor|pain|dolor/.test(value)) return "PRIORITY";
  return "UNKNOWN";
}
function transitionScore(before: string, after: string) {
  const left = stateBand(before); const right = stateBand(after);
  if (left === "UNKNOWN" || right === "UNKNOWN") return null;
  if (left === right) return right === "CORRECT" ? 75 : right === "IMPROVABLE" ? 50 : 25;
  if (left === "PRIORITY" && right !== "PRIORITY" || left === "IMPROVABLE" && right === "CORRECT") return 100;
  return 0;
}

function mean(values: number[]) { return values.reduce((sum, value) => sum + value, 0) / values.length; }
function directionalScore(percent: number, desired: "UP" | "DOWN") { return clamp(50 + (desired === "UP" ? percent : -percent) * 10); }

export function calculateBMProgress(previous: ProgressEvaluation, current: ProgressEvaluation, today: string): BMProgressIndex {
  const components: ProgressComponent[] = []; const goal = normalizedText(current.primaryGoal || previous.primaryGoal);
  const measurementSignals: Array<{ comparison: MetricComparison; desired: "UP" | "DOWN" }> = [];
  const comparisons = COMPARABLE_METRICS.map((item) => compareMetric(previous, current, item)).filter((item): item is MetricComparison => Boolean(item));
  if (/perd|bajar|descenso|grasa|adelgaz/.test(goal)) for (const key of ["waist", "bodyFatPercentage"] as const) { const found = comparisons.find((item) => item.key === key && item.percentageChange !== null); if (found) measurementSignals.push({ comparison: found, desired: "DOWN" }); }
  if (/masa|muscul|hipertrof/.test(goal) && previous.muscleMass !== null && current.muscleMass !== null && previous.muscleMass !== 0) { const comparison = compareMetric(previous, current, { key: "muscleMass", label: "Masa muscular", unit: "kg" }); if (comparison && comparison.percentageChange !== null) measurementSignals.push({ comparison, desired: "UP" }); }
  if (measurementSignals.length) components.push({ key: "MEASUREMENTS", label: "Medidas vinculadas al objetivo", score: round(mean(measurementSignals.map((item) => directionalScore(item.comparison.percentageChange!, item.desired)))), weight: 30, usedData: measurementSignals.map((item) => `${item.comparison.label}: ${item.comparison.previous} → ${item.comparison.current} ${item.comparison.unit}`) });

  const tests = compareTests(previous.testResults, current.testResults);
  const testScores = (category: "PHYSICAL" | "MOBILITY") => tests.filter((item) => item.category === category && item.compatible).flatMap((item) => { const status = transitionScore(item.previousStatus, item.currentStatus); if (item.absoluteChange !== null && item.percentageChange !== null) return [directionalScore(item.percentageChange, "UP")]; return status === null ? [] : [status]; });
  const performanceScores = testScores("PHYSICAL");
  if (performanceScores.length) components.push({ key: "PERFORMANCE", label: "Rendimiento", score: round(mean(performanceScores)), weight: 30, usedData: tests.filter((item) => item.category === "PHYSICAL" && item.compatible).map((item) => `${item.label}${item.side === "CENTER" ? "" : ` ${item.side === "RIGHT" ? "derecha" : "izquierda"}`}`) });
  const mobilityScores = testScores("MOBILITY");
  if (mobilityScores.length) components.push({ key: "MOBILITY", label: "Movilidad/control", score: round(mean(mobilityScores)), weight: 25, usedData: tests.filter((item) => item.category === "MOBILITY" && item.compatible).map((item) => `${item.label}${item.side === "CENTER" ? "" : ` ${item.side === "RIGHT" ? "derecha" : "izquierda"}`}`) });

  const previousPriorities = new Set(interpretEvaluation(previous, today).priorities.map((item) => item.id)); const currentPriorities = new Set(interpretEvaluation(current, today).priorities.map((item) => item.id));
  if (previousPriorities.size || currentPriorities.size) { const resolved = [...previousPriorities].filter((item) => !currentPriorities.has(item)).length; const added = [...currentPriorities].filter((item) => !previousPriorities.has(item)).length; const total = Math.max(previousPriorities.size + added, 1); components.push({ key: "PRIORITIES", label: "Prioridades", score: clamp(50 + (resolved - added) / total * 50), weight: 15, usedData: [`${resolved} ya no activas`, `${added} nuevas`, `${currentPriorities.size} actuales`] }); }

  if (components.length < 2) return { available: false, score: null, reason: "Se necesitan al menos dos evaluaciones comparables con datos de dos componentes.", formula: "Promedio ponderado de componentes disponibles; los pesos se renormalizan.", components };
  const weight = components.reduce((sum, item) => sum + item.weight, 0); const score = clamp(components.reduce((sum, item) => sum + item.score * item.weight, 0) / weight);
  return { available: true, score, reason: "", formula: `Σ (componente × peso) / ${weight}. Pesos disponibles: ${components.map((item) => `${item.label} ${item.weight}%`).join(", ")}.`, components };
}

function areaState(items: TestResultComparison[]): AreaEvolution["state"] {
  const comparable = items.filter((item) => item.compatible);
  if (!comparable.length) return "INSUFFICIENT_DATA";
  const transitions = comparable.map((item) => transitionScore(item.previousStatus, item.currentStatus)).filter((item) => item !== null) as number[];
  const numeric = comparable.flatMap((item) => item.percentageChange === null ? [] : [item.percentageChange]);
  if (transitions.some((item) => item === 0) || numeric.some((item) => item < -2)) return "FOLLOW_UP";
  if (transitions.some((item) => item === 100) || numeric.some((item) => item > 2)) return "EVOLUTION";
  return "STABLE";
}

export function calculateAreaEvolution(measurements: MetricComparison[], tests: TestResultComparison[]): AreaEvolution[] {
  const definitions: Array<{ key: AreaEvolution["key"]; label: string; match: (item: TestResultComparison) => boolean }> = [
    { key: "STRENGTH", label: "Fuerza", match: (item) => /SQUAT|PUSHUP|ROW/.test(item.testKey) },
    { key: "ENDURANCE", label: "Resistencia", match: (item) => item.testKey === "STEP_TEST" },
    { key: "CORE", label: "Zona media", match: (item) => item.testKey.includes("PLANK") },
    { key: "MOBILITY", label: "Movilidad", match: (item) => item.category === "MOBILITY" && !/BIRD_DOG|CONTROL/.test(item.testKey) },
    { key: "BALANCE", label: "Equilibrio/control", match: (item) => /BALANCE|BIRD_DOG|CONTROL/.test(item.testKey) },
  ];
  const measurementState: AreaEvolution["state"] = !measurements.length ? "INSUFFICIENT_DATA" : measurements.some((item) => Math.abs(item.percentageChange ?? 0) > 0.5) ? "EVOLUTION" : "STABLE";
  return [{ key: "MEASUREMENTS", label: "Composición/medidas", state: measurementState, evidence: measurements.map((item) => item.label) }, ...definitions.map((definition) => { const matching = tests.filter(definition.match); return { key: definition.key, label: definition.label, state: areaState(matching), evidence: matching.filter((item) => item.compatible).map((item) => item.label) }; })];
}

export function compareEvaluations(previous: ProgressEvaluation, current: ProgressEvaluation, today: string): EvaluationComparison {
  const measurements = COMPARABLE_METRICS.map((item) => compareMetric(previous, current, item)).filter((item): item is MetricComparison => Boolean(item)); const tests = compareTests(previous.testResults, current.testResults);
  return { previous, current, elapsedDays: dateDiff(previous.date, current.date), measurements, tests, symmetry: calculateSymmetry(current), bodyIssues: compareBodyIssues(previous.bodyIssues, current.bodyIssues), progress: calculateBMProgress(previous, current, today), areas: calculateAreaEvolution(measurements, tests) };
}

export function calculateGlobalEvaluationStats(students: EvaluationStudentSummary[], evaluations: NormalizedEvaluation[], today: string): EvaluationGlobalStats {
  const eligible = students.filter((item) => item.serviceType !== "CLASSES"); const eligibleIds = new Set(eligible.map((item) => item.id)); const records = evaluations.filter((item) => eligibleIds.has(item.studentId)); const histories = new Map(eligible.map((item) => [item.id, records.filter((evaluation) => evaluation.studentId === item.id).sort((a, b) => b.date.localeCompare(a.date))]));
  const withEvaluation = [...histories.values()].filter((items) => items.length > 0).length; const completed = records.filter((item) => item.status === "COMPLETED" || item.status === "REASSESSMENT_RECOMMENDED").length; const thisMonth = today.slice(0, 7); const days = [...histories.values()].flatMap((items) => items[0]?.date ? [dateDiff(items[0].date, today)] : []).filter((item): item is number => item !== null && item >= 0);
  const attention: AttentionItem[] = eligible.flatMap((student): AttentionItem[] => { const history = histories.get(student.id) ?? []; const latest = history[0]; const name = `${student.firstName} ${student.lastName}`.trim(); if (!latest) return [{ studentId: student.id, studentName: name, reason: "NO_EVALUATION", label: "Sin evaluación" }]; const items: AttentionItem[] = []; if (latest.status === "IN_PROGRESS") items.push({ studentId: student.id, studentName: name, reason: "INCOMPLETE", label: `Evaluación incompleta (${latest.completionPercentage}%)` }); if (latest.status === "REASSESSMENT_RECOMMENDED" || latest.reassessmentDate && latest.reassessmentDate < today) items.push({ studentId: student.id, studentName: name, reason: "OVERDUE", label: "Reevaluación vencida o recomendada" }); if (interpretEvaluation(latest, today).priorities.some((item) => item.level === "prioritaria")) items.push({ studentId: student.id, studentName: name, reason: "HIGH_PRIORITIES", label: "Prioridades altas" }); return items; });
  return { eligibleStudents: eligible.length, studentsWithEvaluation: withEvaluation, studentsWithoutEvaluation: eligible.length - withEvaluation, inProgress: records.filter((item) => item.status === "IN_PROGRESS").length, completed, reassessmentRecommended: records.filter((item) => item.status === "REASSESSMENT_RECOMMENDED").length, evaluationsThisMonth: records.filter((item) => item.date.startsWith(thisMonth)).length, evaluatedPercentage: eligible.length ? round(withEvaluation / eligible.length * 100) : 0, averageDaysSinceLastEvaluation: days.length ? round(mean(days)) : null, totalEvaluations: records.length, averagePerStudent: eligible.length ? round(records.length / eligible.length) : 0, completionPercentage: records.length ? round(completed / records.length * 100) : 0, reassessmentsPerformed: [...histories.values()].reduce((sum, items) => sum + Math.max(0, items.length - 1), 0), attention };
}
