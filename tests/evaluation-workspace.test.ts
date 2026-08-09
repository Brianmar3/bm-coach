import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildEvaluationWorkspaceStudents, evaluationSequenceLabel, type EvaluationListItem } from "../lib/evaluation-workspace.ts";
import { filterEvaluationStudents } from "../lib/evaluation-student-filter.ts";

const student = { id: "student-1", firstName: "Brian", lastName: "Martinez", birthDate: "1999-08-08", goal: "Fuerza", serviceType: "MIXED" as const };
const item = (overrides: Partial<EvaluationListItem> = {}): EvaluationListItem => ({ id: "evaluation-1", studentId: student.id, date: "2026-06-01", version: 1, status: "COMPLETED", completionPercentage: 100, primaryGoal: "Fuerza", reassessmentDate: "", weight: 70, source: "PHYSICAL", ...overrides });

test("el listado resume cantidad, última evaluación y objetivo sin cargar el detalle", () => {
  const rows = buildEvaluationWorkspaceStudents([student], [item(), item({ id: "evaluation-2", date: "2026-08-08", version: 2, status: "IN_PROGRESS", completionPercentage: 50 })], "2026-08-09");
  assert.equal(rows[0].evaluationCount, 2);
  assert.equal(rows[0].latestDate, "2026-08-08");
  assert.equal(rows[0].latestStatus, "IN_PROGRESS");
  assert.equal(rows[0].latestGoal, "Fuerza");
});

test("reevaluación pendiente combina estado explícito y vencimiento existente", () => {
  const rows = buildEvaluationWorkspaceStudents([student], [item({ reassessmentDate: "2026-08-01" })], "2026-08-09");
  assert.equal(rows[0].validity, "REASSESSMENT_RECOMMENDED");
  assert.deepEqual(filterEvaluationStudents(rows, { query: "brian", service: "MIXED", status: "REASSESSMENT_RECOMMENDED", validity: "ALL" }).map((row) => row.id), [student.id]);
});

test("al eliminar última o inicial las referencias se derivan de las restantes", () => {
  const all = [item(), item({ id: "evaluation-2", date: "2026-07-01", version: 2 }), item({ id: "evaluation-3", date: "2026-08-01", version: 3 })];
  const withoutLatest = all.filter((evaluation) => evaluation.id !== "evaluation-3");
  const summary = buildEvaluationWorkspaceStudents([student], withoutLatest, "2026-08-09")[0];
  assert.equal(summary.latestDate, "2026-07-01");
  assert.equal(summary.evaluationCount, 2);
  const withoutInitial = all.filter((evaluation) => evaluation.id !== "evaluation-1");
  assert.equal(evaluationSequenceLabel(withoutInitial, "evaluation-2"), "Evaluación inicial");
  assert.equal(evaluationSequenceLabel(withoutInitial, "evaluation-3"), "Evaluación #2");
});

test("la interfaz usa fichas y tabs, y no confirma el borrado con window.confirm", () => {
  const component = readFileSync("componentes/professional-evaluations-dashboard.tsx", "utf8");
  assert.match(component, /Resumen/);
  assert.match(component, /Evaluaciones/);
  assert.match(component, /Progreso/);
  assert.match(component, /Ficha/);
  assert.match(component, /tab === "summary"/);
  assert.match(component, /tab === "evaluations"/);
  assert.match(component, /role="dialog"/);
  assert.match(component, /Eliminar evaluación/);
  assert.doesNotMatch(component, /window\.confirm/);
});

test("duplicar conserva configuración pero reinicia resultados medidos", () => {
  const persistence = readFileSync("lib/evaluation-persistence.ts", "utf8");
  assert.match(persistence, /duplicateEvaluationData/);
  assert.match(persistence, /status: "NOT_PERFORMED"/);
  assert.match(persistence, /numericValue: null/);
  assert.match(persistence, /measurements/);
  assert.match(persistence, /finalStrengths: ""/);
  assert.match(persistence, /protocol: test\.protocol/);
  assert.match(persistence, /variation: test\.variation/);
});

test("el endpoint de borrado exige entrenador, valida pertenencia y recalcula", () => {
  const route = readFileSync("app/api/admin/alumnos/[id]/evaluaciones/[evaluationId]/route.ts", "utf8");
  assert.match(route, /requireAdminApiResponse/);
  assert.match(route, /findFirst\(\{ where: \{ id: evaluationId, studentId \}/);
  assert.match(route, /physicalEvaluation\.delete/);
  assert.match(route, /reconcileStudentPointsAfterMutation/);
  assert.doesNotMatch(route, /Solo pueden eliminarse borradores/);
});

test("el listado usa resumen y el detalle se solicita por alumno", () => {
  const component = readFileSync("componentes/professional-evaluations-dashboard.tsx", "utf8");
  const endpoint = readFileSync("app/api/admin/evaluaciones/progreso/route.ts", "utf8");
  assert.match(component, /progreso\?view=summary/);
  assert.match(component, /progreso\?studentId=/);
  assert.match(endpoint, /view === "summary"/);
  assert.match(endpoint, /select: \{ id: true, studentId: true, date: true/);
});
