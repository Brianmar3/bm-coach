import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildDashboardPriorities,
  compactRanking,
  countPaymentStatuses,
  latestEvaluationPriorityCounts,
  lowActivityStudentIds,
} from "../lib/dashboard-read-model.ts";

test("las prioridades muestran únicamente datos accionables y destinos reales", () => {
  const priorities = buildDashboardPriorities({ overdue: 4, dueSoon: 2, unconfigured: 0, reassessments: 1, evaluationsInProgress: 0 });
  assert.deepEqual(priorities.map((item) => [item.id, item.count]), [["overdue", 4], ["due-soon", 2], ["reassessments", 1]]);
  assert.ok(priorities.every((item) => item.href.startsWith("/")));
});

test("los estados de cuotas se cuentan sin mezclar al día o sin pagos", () => {
  assert.deepEqual(countPaymentStatuses(["VENCIDA", "VENCIDA", "VENCE_PRONTO", "SIN_CONFIGURAR", "AL_DIA", "SIN_PAGOS"]), { overdue: 2, dueSoon: 1, unconfigured: 1 });
});

test("baja actividad respeta servicio, actividad real, vigencia y estado activo sin duplicados", () => {
  const base = { status: "activo", hasEstablishedRoutine: false, hasEstablishedClasses: false, hasRecentWorkout: false, hasRecentAttendance: false };
  assert.deepEqual(lowActivityStudentIds([
    { ...base, studentId: "personal", serviceType: "PERSONALIZED", hasEstablishedRoutine: true },
    { ...base, studentId: "class", serviceType: "CLASSES", hasEstablishedClasses: true },
    { ...base, studentId: "mixed", serviceType: "MIXED", hasEstablishedRoutine: true, hasRecentAttendance: true },
    { ...base, studentId: "inactive", serviceType: "PERSONALIZED", status: "inactivo", hasEstablishedRoutine: true },
    { ...base, studentId: "new", serviceType: "CLASSES" },
  ]), ["personal", "class"]);
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
  const summary = page.slice(page.indexOf('aria-label="Resumen general"'), page.indexOf("<PrioritiesPanel"));
  assert.match(page, /ATENCIÓN HOY/);
  assert.match(page, /Agenda de hoy/);
  assert.match(page, /Ranking mensual/);
  assert.match(page, /Ver ranking/);
  assert.match(page, /Actividad semanal/);
  assert.match(summary, /Alumnos activos/);
  assert.match(summary, /Cuotas pendientes/);
  assert.doesNotMatch(summary, /Cobrado este mes/);
  assert.doesNotMatch(summary, /Clases hoy/);
  assert.match(page, /title="Cobros"/);
  assert.match(page, /<EventsPanel events=/);
  assert.doesNotMatch(page, /PaymentSummary|PointsRanking|QuickAccess|Accesos rápidos/);
  assert.match(page, /aria-label="Resumen general" className="grid grid-cols-2 gap-2\.5"/);
  assert.match(page, /overflow-x-clip/);
});

test("Atención hoy usa datos reales, rutas válidas y no incluye confirmaciones", () => {
  const page = readFileSync(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/dashboard/route.ts", import.meta.url), "utf8");
  const attention = page.slice(page.indexOf("function AttentionToday"), page.indexOf("function TodayClasses"));
  for (const value of ["cuotas requieren atención", "baja actividad", "entrenamiento completado", "registrados hoy", "Todo al día por hoy"]) assert.match(attention, new RegExp(value));
  for (const href of ["/pagos", "/rutinas?tab=seguimiento", "/resumen-mensual"]) assert.match(attention, new RegExp(href.replace(/[?]/g, "\\?")));
  assert.doesNotMatch(attention, /confirmad|sin confirmar/i);
  assert.match(route, /registeredTodaySummary/);
  assert.match(route, /requireAdminApiResponse/);
  assert.match(route, /status: "COMPLETED"/);
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
  const dashboardActions = readFileSync(new URL("../componentes/dashboard-floating-actions.tsx", import.meta.url), "utf8");
  const sharedActions = readFileSync(new URL("../componentes/trainer-floating-actions.tsx", import.meta.url), "utf8");
  const registry = readFileSync(new URL("../lib/trainer-commands.ts", import.meta.url), "utf8");
  const source = `${dashboardActions}\n${sharedActions}\n${registry}`;
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /Nuevo alumno/);
  assert.match(source, /Agregar evento/);
  assert.match(source, /sm:grid-cols-2/);
  assert.doesNotMatch(source, /window\.open|target="_blank"/);
});
