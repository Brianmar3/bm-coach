import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildDashboardPriorities,
  compactRanking,
  countPaymentStatuses,
  dashboardPaymentAttention,
  dashboardTodayAttendance,
  latestEvaluationPriorityCounts,
  lowActivityStudentIds,
} from "../lib/dashboard-read-model.ts";
import { normalizeArgentineWhatsAppPhone } from "../lib/argentine-phone.ts";

test("WhatsApp normaliza celulares argentinos locales e internacionales", () => {
  for (const phone of [
    "03404 596699",
    "03404-596699",
    "03404 15 596699",
    "03404-15-596699",
    "3404 596699",
    "3404596699",
    "+54 9 3404 596699",
    "5493404596699",
    "+54 3404 596699",
  ]) assert.equal(normalizeArgentineWhatsAppPhone(phone), "5493404596699", phone);
});

test("WhatsApp rechaza teléfonos vacíos, sin dígitos o demasiado cortos", () => {
  for (const phone of ["", "sin teléfono", "0340-123"]) assert.equal(normalizeArgentineWhatsAppPhone(phone), null, phone);
});

test("las prioridades muestran únicamente datos accionables y destinos reales", () => {
  const priorities = buildDashboardPriorities({ overdue: 4, dueSoon: 2, unconfigured: 0, reassessments: 1, evaluationsInProgress: 0 });
  assert.deepEqual(priorities.map((item) => [item.id, item.count]), [["overdue", 4], ["due-soon", 2], ["reassessments", 1]]);
  assert.ok(priorities.every((item) => item.href.startsWith("/")));
});

test("los estados de cuotas se cuentan sin mezclar al día o sin pagos", () => {
  assert.deepEqual(countPaymentStatuses(["VENCIDA", "VENCIDA", "VENCE_PRONTO", "SIN_CONFIGURAR", "AL_DIA", "SIN_PAGOS"]), { overdue: 2, dueSoon: 1, unconfigured: 1 });
});

test("cuotas pendientes usa vencidas más las que vencen dentro de 3 días, sin duplicar", () => {
  const attention = dashboardPaymentAttention([
    { studentId: "overdue", status: "VENCIDA", dueDate: "2026-09-01" },
    { studentId: "overdue", status: "VENCE_PRONTO", dueDate: "2026-09-04" },
    { studentId: "soon", status: "VENCE_PRONTO", dueDate: "2026-09-06" },
    { studentId: "far", status: "VENCE_PRONTO", dueDate: "2026-09-07" },
    { studentId: "paid", status: "AL_DIA", dueDate: "2026-09-03" },
    { studentId: "unconfigured", status: "SIN_CONFIGURAR", dueDate: "" },
    { studentId: "no-payments", status: "SIN_PAGOS", dueDate: "2026-09-03" },
  ], "2026-09-03", "2026-09-06");
  assert.deepEqual(attention.overdueStudentIds, ["overdue"]);
  assert.deepEqual(attention.dueSoonStudentIds, ["soon"]);
  assert.equal(attention.attentionCount, attention.overdueCount + attention.dueSoonCount);
  assert.equal(attention.attentionCount, 2);
});

test("baja actividad respeta servicio, actividad real, vigencia y estado activo sin duplicados", () => {
  const base = { status: "activo", hasEstablishedRoutine: false, hasEstablishedClasses: false, hasRecentWorkout: false, hasRecentAttendance: false };
  assert.deepEqual(lowActivityStudentIds([
    { ...base, studentId: "personal", serviceType: "PERSONALIZED", hasEstablishedRoutine: true },
    { ...base, studentId: "class", serviceType: "CLASSES", hasEstablishedClasses: true },
    { ...base, studentId: "class", serviceType: "CLASSES", hasEstablishedClasses: true },
    { ...base, studentId: "mixed", serviceType: "MIXED", hasEstablishedClasses: true },
    { ...base, studentId: "present", serviceType: "CLASSES", hasEstablishedClasses: true, hasRecentAttendance: true },
    { ...base, studentId: "inactive", serviceType: "PERSONALIZED", status: "inactivo", hasEstablishedRoutine: true },
    { ...base, studentId: "new", serviceType: "CLASSES" },
  ]), ["class", "mixed"]);
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

test("asistencia de hoy usa ocurrencias reales, evita duplicados y omite presentes de clases futuras", () => {
  const result = dashboardTodayAttendance([
    { id: "morning", startTime: "08:00", enrolled: 10, attendance: 4 },
    { id: "morning", startTime: "08:00", enrolled: 10, attendance: 4 },
    { id: "midday", startTime: "11:00", enrolled: 8, attendance: 2 },
    { id: "future", startTime: "18:00", enrolled: 0, attendance: 3 },
  ], "12:00");
  assert.deepEqual(result, { present: 6, expected: 18, percentage: 33 });
  const route = readFileSync(new URL("../app/api/dashboard/route.ts", import.meta.url), "utf8");
  assert.match(route, /dashboardTodayAttendance\(attendanceClassesToday, currentArgentinaTime\)/);
  assert.match(route, /assignments\.filter\(\(\{ student \}\)/);
  assert.match(route, /occurrence\.status !== "CANCELLED"/);
});

test("asistencia de hoy devuelve un estado válido cuando no hay clases", () => {
  assert.deepEqual(dashboardTodayAttendance([], "12:00"), { present: 0, expected: 0, percentage: 0 });
});

test("el Dashboard respeta la jerarquía compacta y elimina los bloques pesados", () => {
  const page = readFileSync(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");
  const summary = page.slice(page.indexOf('aria-label="Resumen general"'), page.indexOf("<AttentionToday"));
  assert.match(page, /ATENCIÓN HOY/);
  assert.match(page, /Agenda de hoy/);
  assert.match(page, /Ranking mensual/);
  assert.match(page, /Ver ranking/);
  assert.match(page, /Actividad semanal/);
  assert.match(summary, /Alumnos activos/);
  assert.match(summary, /Asistencia hoy/);
  assert.match(summary, /attendanceTodayPercentage/);
  assert.doesNotMatch(summary, /Cuotas pendientes/);
  assert.doesNotMatch(summary, /Cobrado este mes/);
  assert.doesNotMatch(summary, /Clases hoy/);
  assert.match(page, /title="Cobros"/);
  assert.match(page, /<EventsPanel events=/);
  assert.doesNotMatch(page, /PaymentSummary|PointsRanking|QuickAccess|Accesos rápidos/);
  assert.match(page, /aria-label="Resumen general" className="grid grid-cols-2 gap-2\.5"/);
  assert.match(page, /overflow-x-clip/);
});

test("el clima usa un fallback no bloqueante sin inventar datos ni hacer requests externos", () => {
  const page = readFileSync(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");
  assert.match(page, /useState<CurrentWeather \| null \| undefined>\(undefined\)/);
  assert.match(page, /fetch\("\/api\/weather"/);
  assert.match(page, /<WeatherLine weather=\{weather\}/);
  assert.match(page, /setWeather\(result\.weather\)/);
  assert.match(page, /setWeather\(null\)/);
  assert.match(page, /Cargando clima/);
  assert.match(page, /Clima no disponible/);
  assert.doesNotMatch(page, /openweather|weatherapi|navigator\.geolocation/i);
});

test("Atención hoy usa datos reales, rutas válidas y no incluye confirmaciones", () => {
  const page = readFileSync(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/dashboard/route.ts", import.meta.url), "utf8");
  const attention = page.slice(page.indexOf("function AttentionToday"), page.indexOf("function TodayClasses"));
  for (const value of ["cuotas requieren atención", "baja actividad", "entrenamiento completado", "registrados hoy", "Todo al día por hoy"]) assert.match(attention, new RegExp(value));
  for (const href of ["/pagos", "/asistencias?view=low-activity", "/resumen-mensual"]) assert.match(attention, new RegExp(href.replace(/[?]/g, "\\?")));
  const lowActivityRow = attention.split("\n").find((line) => line.includes('id: "activity"')) ?? "";
  assert.doesNotMatch(lowActivityRow, /\/rutinas\?tab=seguimiento/);
  assert.doesNotMatch(attention, /confirmad|sin confirmar/i);
  assert.match(route, /registeredTodaySummary/);
  assert.match(route, /requireAdminApiResponse/);
  assert.match(route, /status: "COMPLETED"/);
  assert.match(attention, /const quotaCount = data\.attentionCount/);
  assert.match(route, /pendingCount: paymentAttention\.attentionCount/);
  assert.match(route, /attentionCount: paymentAttention\.attentionCount/);
});

test("la vista de baja actividad expone asistencia, frecuencia y contacto con teléfono real", () => {
  const page = readFileSync(new URL("../app/asistencias/page.tsx", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/dashboard/route.ts", import.meta.url), "utf8");
  for (const label of ["Última asistencia", "Días desde última asistencia", "Frecuencia semanal", "Sin teléfono", "Revisar teléfono"]) assert.match(page, new RegExp(label));
  assert.match(page, /https:\/\/wa\.me\/\$\{student\.phoneNormalized\}/);
  assert.match(route, /normalizeArgentineWhatsAppPhone\(rawPhone\)/);
  assert.match(route, /actualAttendance: "PRESENT"/);
  assert.match(route, /status: "PRESENT"/);
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
