import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  expectedPortalAttendanceSessions,
  mergePortalAttendanceRecords,
  portalAttendancePeriod,
  summarizeExpectedPortalAttendancePeriod,
  summarizePortalAttendance,
  type PortalAttendanceRecord,
} from "../lib/portal-attendance.ts";

const memberships = [{ start: "2026-01-01", end: null, frequencyDays: 3, serviceType: "CLASSES" }];
const assignments = [
  { dayOfWeek: "MONDAY" as const, assignedAt: "2026-01-01", endedAt: null },
  { dayOfWeek: "WEDNESDAY" as const, assignedAt: "2026-01-01", endedAt: null },
  { dayOfWeek: "FRIDAY" as const, assignedAt: "2026-01-01", endedAt: null },
];

const record = (values: Partial<PortalAttendanceRecord> & Pick<PortalAttendanceRecord, "id" | "status">): PortalAttendanceRecord => ({
  date: "2026-08-08",
  className: "Funcional",
  startTime: "07:00",
  endTime: "08:00",
  source: "current",
  scheduleId: "schedule-1",
  ...values,
});

test("resume presentes, ausentes y justificadas con una única fórmula", () => {
  const summary = summarizePortalAttendance([
    record({ id: "p1", status: "PRESENT" }),
    record({ id: "p2", status: "PRESENT" }),
    record({ id: "a1", status: "ABSENT" }),
    record({ id: "j1", status: "JUSTIFIED" }),
  ]);
  assert.deepEqual(summary, { present: 2, absent: 1, justified: 1, total: 4, percentage: 50 });
});

test("un período sin registros no se presenta como cero por ciento", () => {
  assert.deepEqual(summarizePortalAttendance([]), { present: 0, absent: 0, justified: 0, total: 0, percentage: null });
});

test("el mes actual usa sesiones esperadas transcurridas: 2 de 5 equivale a 40 por ciento", () => {
  const expected = expectedPortalAttendanceSessions({ start: "2026-08-01", endExclusive: "2026-09-01", today: "2026-08-12", memberships, assignments });
  const summary = summarizePortalAttendance([
    record({ id: "p1", status: "PRESENT", date: "2026-08-03" }),
    record({ id: "p2", status: "PRESENT", date: "2026-08-05" }),
    record({ id: "a1", status: "ABSENT", date: "2026-08-07" }),
  ], expected);
  assert.equal(expected, 5);
  assert.deepEqual(summary, { present: 2, absent: 1, justified: 0, total: 5, percentage: 40, completedDays: 2 });
});

test("dos presentes el mismo día cuentan una sola vez para cumplimiento", () => {
  const summary = summarizePortalAttendance([
    record({ id: "p1", status: "PRESENT", date: "2026-08-03", startTime: "07:00" }),
    record({ id: "p2", status: "PRESENT", date: "2026-08-03", startTime: "15:30", scheduleId: "schedule-2" }),
    record({ id: "p3", status: "PRESENT", date: "2026-08-05" }),
  ], 5);
  assert.equal(summary.present, 3);
  assert.equal(summary.completedDays, 2);
  assert.equal(summary.percentage, 40);
});

test("Home y detalle reciben el mismo 75 por ciento con tres días presentes y una ausencia", () => {
  const summary = summarizeExpectedPortalAttendancePeriod({
    start: "2026-08-01",
    endExclusive: "2026-09-01",
    today: "2026-08-12",
    memberships: [{ start: "2026-08-01", end: null, frequencyDays: 2, serviceType: "CLASSES", status: "ACTIVE" }],
    assignments: [
      { dayOfWeek: "TUESDAY", assignedAt: "2026-08-01", endedAt: null },
      { dayOfWeek: "THURSDAY", assignedAt: "2026-08-01", endedAt: null },
    ],
    records: [
      record({ id: "p1", status: "PRESENT", date: "2026-08-03" }),
      record({ id: "p2", status: "PRESENT", date: "2026-08-05" }),
      record({ id: "p3", status: "PRESENT", date: "2026-08-10" }),
      record({ id: "a1", status: "ABSENT", date: "2026-08-11" }),
    ],
  });
  assert.equal(summary.total, 4);
  assert.equal(summary.completedDays, 3);
  assert.equal(summary.percentage, 75);
});

test("una ausencia manual amplía el mínimo transcurrido si la proyección la omitió", () => {
  const summary = summarizePortalAttendance([
    record({ id: "p1", status: "PRESENT", date: "2026-08-03" }),
    record({ id: "p2", status: "PRESENT", date: "2026-08-04" }),
    record({ id: "p3", status: "PRESENT", date: "2026-08-06" }),
    record({ id: "a1", status: "ABSENT", date: "2026-08-11" }),
  ], 3);
  assert.deepEqual(summary, { present: 3, absent: 1, justified: 0, total: 4, percentage: 75, completedDays: 3 });
});

test("una clase futura de la semana actual no reduce el porcentaje", () => {
  const expected = expectedPortalAttendanceSessions({ start: "2026-08-10", endExclusive: "2026-08-17", today: "2026-08-12", memberships, assignments });
  assert.equal(expected, 2);
});

test("una membresía iniciada a mitad de mes no espera sesiones anteriores", () => {
  const expected = expectedPortalAttendanceSessions({
    start: "2026-08-01",
    endExclusive: "2026-09-01",
    today: "2026-08-12",
    memberships: [{ start: "2026-08-10", end: null, frequencyDays: 3, serviceType: "CLASSES", status: "ACTIVE" }],
    assignments,
  });
  assert.equal(expected, 2);
});

test("una presencia en otro horario cumple el día asignado", () => {
  const summary = summarizeExpectedPortalAttendancePeriod({
    start: "2026-08-03",
    endExclusive: "2026-08-10",
    today: "2026-08-03",
    memberships,
    assignments,
    records: [record({ id: "p1", status: "PRESENT", date: "2026-08-03", startTime: "15:30", scheduleId: "otro-horario" })],
  });
  assert.equal(summary.total, 1);
  assert.equal(summary.completedDays, 1);
  assert.equal(summary.percentage, 100);
});

test("una semana cerrada conserva tres esperadas y dos presentes equivalen a 66,7", () => {
  const summary = summarizeExpectedPortalAttendancePeriod({
    start: "2026-08-03",
    endExclusive: "2026-08-10",
    today: "2026-08-09",
    memberships,
    assignments,
    records: [
      record({ id: "p1", status: "PRESENT", date: "2026-08-03" }),
      record({ id: "p2", status: "PRESENT", date: "2026-08-05" }),
    ],
  });
  assert.equal(summary.total, 3);
  assert.equal(summary.percentage, 66.7);
});

test("una membresía inactiva no genera sesiones esperadas", () => {
  assert.equal(expectedPortalAttendanceSessions({
    start: "2026-08-03",
    endExclusive: "2026-08-10",
    today: "2026-08-09",
    memberships: [{ ...memberships[0], status: "INACTIVE" }],
    assignments,
  }), 0);
});

test("un mes cerrado evalúa el período completo", () => {
  const expected = expectedPortalAttendanceSessions({ start: "2026-02-01", endExclusive: "2026-03-01", today: "2026-08-12", memberships, assignments });
  const present = Array.from({ length: 9 }, (_, index) => record({ id: `p${index}`, status: "PRESENT", date: `2026-02-${String(index + 2).padStart(2, "0")}` }));
  assert.equal(expected, 12);
  assert.equal(summarizePortalAttendance(present, expected).percentage, 75);
});

test("cero sesiones esperadas produce cero seguro", () => {
  assert.deepEqual(summarizePortalAttendance([], 0), { present: 0, absent: 0, justified: 0, total: 0, percentage: 0, completedDays: 0 });
});

test("tres presentes sobre nueve esperadas producen 33,3 en cualquier consumidor", () => {
  const records = [
    record({ id: "p1", status: "PRESENT", date: "2026-08-03" }),
    record({ id: "p2", status: "PRESENT", date: "2026-08-10" }),
    record({ id: "p3", status: "PRESENT", date: "2026-08-17" }),
    ...Array.from({ length: 6 }, (_, index) => record({ id: `a${index}`, status: "ABSENT", date: `2026-08-${String(4 + index).padStart(2, "0")}` })),
  ];
  const official = summarizePortalAttendance(records, 9);
  assert.equal(official.total, 9);
  assert.equal(official.completedDays, 3);
  assert.equal(official.percentage, 33.3);
});

test("frecuencias 2, 3 y 5 conservan su expectativa semanal", () => {
  for (const frequencyDays of [2, 3, 5]) {
    const expected = expectedPortalAttendanceSessions({
      start: "2026-08-03",
      endExclusive: "2026-08-10",
      today: "2026-08-09",
      memberships: [{ start: "2026-08-01", end: null, frequencyDays, serviceType: "CLASSES", status: "ACTIVE" }],
      assignments: [],
    });
    assert.equal(expected, frequencyDays);
  }
});

test("justificadas y ausencias integran el denominador sin contar como presentes", () => {
  const summary = summarizePortalAttendance([
    record({ id: "p1", status: "PRESENT" }),
    record({ id: "j1", status: "JUSTIFIED" }),
    record({ id: "a1", status: "ABSENT" }),
  ], 3);
  assert.equal(summary.percentage, 33.3);
  assert.equal(summary.justified, 1);
  assert.equal(summary.absent, 1);
});

test("registros futuros quedan fuera del resumen oficial", () => {
  const summary = summarizeExpectedPortalAttendancePeriod({
    start: "2026-08-01",
    endExclusive: "2026-09-01",
    today: "2026-08-12",
    memberships,
    assignments,
    records: [
      record({ id: "past", status: "PRESENT", date: "2026-08-10" }),
      record({ id: "future", status: "PRESENT", date: "2026-08-14" }),
    ],
  });
  assert.equal(summary.present, 1);
  assert.equal(summary.completedDays, 1);
});

test("Personalizado puro no genera cumplimiento de clases", () => {
  assert.equal(expectedPortalAttendanceSessions({ start: "2026-08-01", endExclusive: "2026-09-01", today: "2026-08-12", memberships: [{ ...memberships[0], serviceType: "PERSONALIZED" }], assignments }), 0);
});

test("sin horarios confiables usa frecuencia semanal prorrateada por días hábiles reales", () => {
  assert.equal(expectedPortalAttendanceSessions({ start: "2026-08-10", endExclusive: "2026-08-17", today: "2026-08-12", memberships, assignments: [] }), 2);
});

test("los tres filtros generan límites inclusivos y exclusivos correctos", () => {
  assert.deepEqual(portalAttendancePeriod("current-month", "2026-08-08"), { key: "current-month", label: "Este mes", start: "2026-08-01", endExclusive: "2026-09-01" });
  assert.deepEqual(portalAttendancePeriod("previous-month", "2026-08-08"), { key: "previous-month", label: "Mes anterior", start: "2026-07-01", endExclusive: "2026-08-01" });
  assert.deepEqual(portalAttendancePeriod("last-30-days", "2026-08-08"), { key: "last-30-days", label: "Últimos 30 días", start: "2026-07-10", endExclusive: "2026-08-09" });
});

test("el registro actual prevalece sobre un duplicado histórico", () => {
  const current = record({ id: "new", status: "PRESENT" });
  const legacy = record({ id: "old", status: "ABSENT", source: "legacy" });
  assert.deepEqual(mergePortalAttendanceRecords([current], [legacy]).map((item) => item.id), ["new"]);
});

test("Home y detalle comparten el mismo resumen y nunca consultan confirmaciones", () => {
  const home = readFileSync(new URL("../app/api/portal/data/route.ts", import.meta.url), "utf8");
  const detail = readFileSync(new URL("../lib/portal-attendance-data.ts", import.meta.url), "utf8");
  const endpoint = readFileSync(new URL("../app/api/portal/asistencias/route.ts", import.meta.url), "utf8");
  assert.match(home, /loadPortalAttendance\(studentId, "current-month", todayKey\)/);
  assert.match(home, /loadPortalAttendance\(studentId, "previous-month", todayKey\)/);
  assert.doesNotMatch(home, /summarizeExpectedPortalAttendancePeriod/);
  assert.match(detail, /summarizeExpectedPortalAttendancePeriod/);
  assert.doesNotMatch(detail, /\bresponse\b/);
  assert.match(detail, /actualAttendance/);
  assert.match(endpoint, /getPortalSession/);
  assert.match(endpoint, /session\.studentId/);
  assert.doesNotMatch(endpoint, /searchParams\.get\("studentId"\)/);
  assert.match(detail, /weeklyCompliance/);
  assert.match(detail, /source: "weekly-closure"/);
  assert.match(detail, /hasGroupClasses/);
  assert.match(detail, /summarizeExpectedPortalAttendancePeriod/);
  assert.match(detail, /membershipHistory/);
  assert.match(detail, /weeklyClassAssignment\.findMany/);
  assert.match(detail, /record\.date <= todayKey/);
});
