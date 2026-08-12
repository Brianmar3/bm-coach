import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  mergePortalAttendanceRecords,
  portalAttendancePeriod,
  summarizePortalAttendance,
  type PortalAttendanceRecord,
} from "../lib/portal-attendance.ts";

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
  assert.match(home, /summarizePortalAttendance/);
  assert.match(detail, /summarizePortalAttendance/);
  assert.doesNotMatch(detail, /\bresponse\b/);
  assert.match(detail, /actualAttendance/);
  assert.match(endpoint, /getPortalSession/);
  assert.match(endpoint, /session\.studentId/);
  assert.doesNotMatch(endpoint, /searchParams\.get\("studentId"\)/);
  assert.match(detail, /weeklyCompliance/);
  assert.match(detail, /source: "weekly-closure"/);
  assert.match(detail, /hasGroupClasses/);
});
