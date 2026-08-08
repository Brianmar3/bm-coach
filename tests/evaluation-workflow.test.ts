import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BODY_ZONES, calculateAgeAtDate, calculateEvaluationCompletion, emptyBodyIssue, emptyTest,
  missingEssentialFields, validateEvaluationDraft, validateMeasurement,
} from "../lib/evaluation-workflow.ts";
import type { EvaluationWorkflow } from "../types/evaluation-workflow.ts";

function evaluation(overrides: Partial<EvaluationWorkflow> = {}): EvaluationWorkflow {
  return {
    id: "evaluation-1", studentId: "student-1", studentName: "Ana Pérez", version: 1,
    status: "IN_PROGRESS", date: "2026-08-08", currentStep: 1, completionPercentage: 0,
    trainerName: "Entrenador", primaryGoal: "", secondaryGoals: [], experienceLevel: "",
    weeklyAvailability: "", generalData: {}, habits: {}, trainingObservations: {}, trainerNotes: "",
    finalStrengths: "", finalPriorities: "", finalLimitations: "", planningNotes: "", finalComment: "",
    reassessmentDate: "", completedAt: null, createdAt: "2026-08-08T00:00:00Z", updatedAt: "2026-08-08T00:00:00Z",
    measurements: [], bodyIssues: [], testResults: [], ...overrides,
  };
}

test("la completitud es determinista, acotada y ponderada por bloques", () => {
  const empty = evaluation();
  assert.equal(calculateEvaluationCompletion(empty), calculateEvaluationCompletion(empty));
  assert.ok(calculateEvaluationCompletion(empty) >= 0);
  const complete = evaluation({
    weeklyAvailability: "3 días", primaryGoal: "Fuerza", experienceLevel: "Principiante",
    generalData: { activities: "Caminata" }, habits: { sleep: "Buena", water: "2 L", activity: "Moderada" },
    trainerNotes: "Sin observaciones", measurements: [{ measurementType: "WEIGHT", side: null, value: 70, unit: "kg", notes: "" }],
    testResults: [emptyTest("KNEE_TO_WALL", "MOBILITY"), emptyTest("DEEP_SQUAT", "MOBILITY"), emptyTest("CONTROLLED_SQUATS", "PHYSICAL")].map((item) => ({ ...item, status: "CORRECT" })),
    finalComment: "Observación final",
  });
  assert.equal(calculateEvaluationCompletion(complete), 100);
});

test("la edad se calcula en la fecha de evaluación y respeta el cumpleaños", () => {
  assert.equal(calculateAgeAtDate("1999-08-08", "2026-08-08"), 27);
  assert.equal(calculateAgeAtDate("1999-08-09", "2026-08-08"), 26);
  assert.equal(calculateAgeAtDate("", "2026-08-08"), null);
  assert.equal(calculateAgeAtDate("2027-01-01", "2026-08-08"), null);
});

test("la edad manual se valida, es opcional y queda dentro de generalData", () => {
  assert.equal(validateEvaluationDraft(evaluation({ generalData: { ageSnapshot: 27 } })), null);
  assert.match(validateEvaluationDraft(evaluation({ generalData: { ageSnapshot: 121 } })) ?? "", /edad/);
  assert.equal(validateEvaluationDraft(evaluation({ generalData: {} })), null);
});

test("la finalización enumera exactamente los campos esenciales faltantes", () => {
  assert.deepEqual(missingEssentialFields(evaluation({ date: "" })), [
    "Fecha de evaluación", "Objetivo principal", "Nivel o experiencia", "Disponibilidad semanal",
    "Observación final del entrenador", "Al menos una medida corporal o un test realizado",
  ]);
  const ready = evaluation({ primaryGoal: "Salud general", experienceLevel: "Principiante", weeklyAvailability: "2 días", finalComment: "Base registrada", measurements: [{ measurementType: "WEIGHT", side: null, value: 70, unit: "kg", notes: "" }] });
  assert.deepEqual(missingEssentialFields(ready), []);
});

test("las medidas validan valor, rango, unidad y lados independientes", () => {
  assert.equal(validateMeasurement({ measurementType: "WEIGHT", side: null, value: 70.5, unit: "kg", notes: "" }), null);
  assert.match(validateMeasurement({ measurementType: "WEIGHT", side: null, value: 0, unit: "kg", notes: "" }) ?? "", /mayor que cero/);
  assert.match(validateMeasurement({ measurementType: "WAIST", side: null, value: 500, unit: "cm", notes: "" }) ?? "", /entre/);
  assert.match(validateMeasurement({ measurementType: "BODY_FAT", side: null, value: 20, unit: "kg", notes: "" }) ?? "", /unidad/);
  assert.equal(validateMeasurement({ measurementType: "ARM", side: "RIGHT", value: 32, unit: "cm", notes: "" }), null);
  assert.equal(validateMeasurement({ measurementType: "ARM", side: "LEFT", value: 31, unit: "cm", notes: "" }), null);
});

test("molestias soportan varias zonas, lados, intensidad opcional y eliminación local", () => {
  const issues = [emptyBodyIssue("Rodilla derecha"), emptyBodyIssue("Espalda baja")];
  assert.equal(issues[0].side, "RIGHT");
  assert.equal(issues[1].intensity, null);
  assert.ok(BODY_ZONES.length >= 27);
  assert.equal(issues.filter((_, index) => index !== 0).length, 1);
});

test("tests conservan estado, resultados, lados, dolor y observaciones", () => {
  const result = { ...emptyTest("KNEE_TO_WALL", "MOBILITY"), status: "IMPROVABLE", rightValue: 8, leftValue: 10, rightPain: true, observations: "Diferencia observada" };
  assert.equal(result.category, "MOBILITY");
  assert.equal(result.rightValue, 8);
  assert.equal(result.leftValue, 10);
  assert.equal(result.rightPain, true);
  assert.equal(emptyTest("STEP_TEST", "PHYSICAL").status, "NOT_PERFORMED");
});

test("el borrador valida paso, medidas y zonas sin exigir campos opcionales", () => {
  const valid = evaluation();
  assert.equal(validateEvaluationDraft(valid), null);
  assert.match(validateEvaluationDraft({ ...valid, currentStep: 9 }) ?? "", /entre 1 y 8/);
  assert.match(validateEvaluationDraft({ ...valid, bodyIssues: [emptyBodyIssue("Zona inventada")] }) ?? "", /zona corporal/);
});

test("la ficha oculta evaluaciones para Clases y las muestra para Personalizado o Mixto", () => {
  const page = readFileSync("app/alumnos/page.tsx", "utf8");
  assert.match(page, /item\.serviceType !== "CLASSES" && <StudentEvaluations/);
  assert.match(page, /item\.serviceType !== "CLASSES" && <Link href="\/evaluaciones"/);
});

test("Paso 1 guarda snapshot de edad y no repite observaciones generales", () => {
  const component = readFileSync("componentes/student-evaluations.tsx", "utf8");
  const generalStep = component.slice(component.indexOf("function GeneralStep"), component.indexOf("function GoalsStep"));
  assert.match(generalStep, /calculateAgeAtDate\(birthDate, value\.date\)/);
  assert.match(generalStep, /ageSnapshot/);
  assert.match(generalStep, /Edad manual/);
  assert.doesNotMatch(generalStep, /Observaciones generales del entrenador/);
  assert.doesNotMatch(generalStep, /setObject\([^\n]*birthDate|update\(\{\s*birthDate/);
  const createRoute = readFileSync("app/api/admin/alumnos/[id]/evaluaciones/route.ts", "utf8");
  assert.match(createRoute, /generalData: ageSnapshot === null \? \{\} : \{ ageSnapshot \}/);
});

test("la ficha muestra un resumen compacto y prioriza continuar el borrador", () => {
  const component = readFileSync("componentes/student-evaluations.tsx", "utf8");
  const compact = component.slice(component.indexOf("export function StudentEvaluations"), component.indexOf("function numeric"));
  assert.match(compact, /Continuar evaluación/);
  assert.match(compact, /Nueva evaluación/);
  assert.match(compact, /Ver evaluaciones/);
  assert.doesNotMatch(compact, /<h4[^>]*>Historial/);
});

test("el panel profesional usa métricas reales, guiones e historial descendente", () => {
  const component = readFileSync("componentes/student-evaluations.tsx", "utf8");
  const panel = component.slice(component.indexOf("function EvaluationPanel"), component.indexOf("function EvaluationWizard"));
  assert.match(panel, /Evaluaciones realizadas/);
  assert.match(panel, /Progreso de la última/);
  assert.match(panel, /Próxima reevaluación/);
  assert.match(panel, /Resumen rápido/);
  assert.match(panel, /value=\{.*\? .* : "—"\}/s);
  const route = readFileSync("app/api/admin/alumnos/[id]/evaluaciones/route.ts", "utf8");
  assert.match(route, /orderBy: \[\{ date: "desc" \}, \{ version: "desc" \}\]/);
});

test("la vista del alumno es compacta y no recibe notas internas", () => {
  const portal = readFileSync("componentes/portal-section.tsx", "utf8");
  const compact = portal.slice(portal.indexOf("function CompactEvaluationsView"), portal.indexOf("function QuotaSummaryCard"));
  assert.match(compact, /Ver historial/);
  assert.match(compact, /completionPercentage/);
  assert.match(compact, /reassessmentDate/);
  assert.doesNotMatch(compact, /\.notes|trainerNotes|finalLimitations|planningNotes/);
  const api = readFileSync("app/api/portal/data/route.ts", "utf8");
  assert.match(api, /notes: ""/);
});

test("evaluaciones mantiene controles accesibles y evita scroll horizontal", () => {
  const component = readFileSync("componentes/student-evaluations.tsx", "utf8");
  assert.match(component, /aria-label="Cerrar evaluación"/);
  assert.match(component, /overflow-hidden/);
  assert.match(component, /md:grid/);
  assert.match(component, /min-h-11/);
});

test("Edad reutiliza generalData y no requiere otra migración", () => {
  const migration = readFileSync("prisma/migrations/20260808143000_evaluations_phase_1/migration.sql", "utf8");
  assert.doesNotMatch(migration, /ageSnapshot|\bage\b/i);
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  assert.match(schema, /generalData\s+Json/);
});

test("la API previene doble creación, valida servicio y protege completadas", () => {
  const collection = readFileSync("app/api/admin/alumnos/[id]/evaluaciones/route.ts", "utf8");
  const detail = readFileSync("app/api/admin/alumnos/[id]/evaluaciones/[evaluationId]/route.ts", "utf8");
  const completion = readFileSync("app/api/admin/alumnos/[id]/evaluaciones/[evaluationId]/complete/route.ts", "utf8");
  assert.match(collection, /findUnique\(\{ where: \{ creationKey \}/);
  assert.match(collection, /serviceType === "CLASSES"/);
  assert.match(collection, /_max: \{ version: true \}/);
  assert.match(detail, /status !== "IN_PROGRESS"/);
  assert.match(completion, /\$transaction/);
  assert.match(completion, /completedAt: new Date\(\)/);
});

test("la migración preserva tablas anteriores y versiona el historial", () => {
  const sql = readFileSync("prisma/migrations/20260808143000_evaluations_phase_1/migration.sql", "utf8");
  assert.match(sql, /ROW_NUMBER\(\) OVER/);
  assert.match(sql, /DEFAULT 'COMPLETED'/);
  assert.doesNotMatch(sql, /DROP TABLE|DROP COLUMN/);
});
