import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildDashboardPriorities,
  compactRanking,
  countPaymentStatuses,
  latestEvaluationPriorityCounts,
} from "../lib/dashboard-read-model.ts";

test("las prioridades muestran únicamente datos accionables y destinos reales", () => {
  const priorities = buildDashboardPriorities({ overdue: 4, dueSoon: 2, unconfigured: 0, reassessments: 1, evaluationsInProgress: 0 });
  assert.deepEqual(priorities.map((item) => [item.id, item.count]), [["overdue", 4], ["due-soon", 2], ["reassessments", 1]]);
  assert.ok(priorities.every((item) => item.href.startsWith("/")));
});

test("los estados de cuotas se cuentan sin mezclar al día o sin pagos", () => {
  assert.deepEqual(countPaymentStatuses(["VENCIDA", "VENCIDA", "VENCE_PRONTO", "SIN_CONFIGURAR", "AL_DIA", "SIN_PAGOS"]), { overdue: 2, dueSoon: 1, unconfigured: 1 });
});

test("la evaluación más reciente por alumno define reevaluaciones y trabajos en curso", () => {
  const result = latestEvaluationPriorityCounts([
    { studentId: "a", status: "COMPLETED", reassessmentDate: new Date("2026-08-01T00:00:00.000Z") },
    { studentId: "a", status: "IN_PROGRESS", reassessmentDate: null },
    { studentId: "b", status: "IN_PROGRESS", reassessmentDate: null },
    { studentId: "c", status: "REASSESSMENT_RECOMMENDED", reassessmentDate: null },
    { studentId: "inactive", status: "REASSESSMENT_RECOMMENDED", reassessmentDate: null },
  ], new Set(["a", "b", "c"]), "2026-08-09");
  assert.deepEqual(result, { inProgress: 1, reassessments: 2 });
});

test("el ranking mensual conserva sólo activos, ordena empates y limita a tres", () => {
  const ranking = compactRanking([
    { studentId: "a", points: 10 }, { studentId: "b", points: 20 }, { studentId: "c", points: 20 },
    { studentId: "d", points: 30 }, { studentId: "inactive", points: 99 },
  ], new Map([["a", "Zoe"], ["b", "Bruno"], ["c", "Ana"], ["d", "Damián"]]), new Set(["a", "b", "c", "d"]));
  assert.deepEqual(ranking.map((item) => item.studentId), ["d", "c", "b"]);
});

test("el Dashboard respeta la jerarquía compacta y elimina los bloques pesados", () => {
  const page = readFileSync(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");
  assert.match(page, /Prioridades de hoy/);
  assert.match(page, /Agenda de hoy/);
  assert.match(page, /Ranking por puntos/);
  assert.match(page, /Actividad semanal/);
  assert.doesNotMatch(page, /PaymentSummary|PointsRanking|QuickAccess|Accesos rápidos/);
  assert.match(page, /grid-cols-2 gap-2\.5 lg:grid-cols-4/);
  assert.match(page, /overflow-x-clip/);
});

test("el endpoint recorta listados, agrupa puntos y evita consultas por fila", () => {
  const route = readFileSync(new URL("../app/api/dashboard/route.ts", import.meta.url), "utf8");
  assert.match(route, /todayClasses: todayClasses\.slice\(0, 3\)/);
  assert.match(route, /active\.slice\(0, 3\)/);
  assert.match(route, /studentPointTransaction\.groupBy/);
  assert.match(route, /Promise\.all/);
  assert.doesNotMatch(route, /for \([^)]*\) \{[\s\S]{0,220}prisma\./);
});

test("el acceso flotante ofrece seis acciones y un diálogo interno responsive", () => {
  const source = readFileSync(new URL("../componentes/dashboard-floating-actions.tsx", import.meta.url), "utf8");
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /Nuevo alumno/);
  assert.match(source, /Agregar evento/);
  assert.match(source, /grid grid-cols-2/);
  assert.doesNotMatch(source, /window\.open|target="_blank"/);
});
