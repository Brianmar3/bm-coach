import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { effectiveOccurrenceId, effectiveSessionForStudentsOnDate, type EffectiveSessionOccurrence } from "../lib/effective-class-session.ts";

const date = "2026-09-04";
const studentId = "student-1";

function occurrence(id: string, startTime: string, responses: EffectiveSessionOccurrence["responses"] = [], assigned = false, occurrenceDate = date): EffectiveSessionOccurrence {
  return {
    id,
    scheduleId: `schedule-${id}`,
    date: occurrenceDate,
    startTime,
    assignments: assigned ? [{ studentId, primaryScheduleId: `schedule-${id}` }] : [],
    responses,
  };
}

function effectiveCount(result: ReadonlyMap<string, string>, occurrenceId: string) {
  return [...result.values()].filter((id) => id === occurrenceId).length;
}

test("sin confirmación usa únicamente el turno designado", () => {
  const result = effectiveSessionForStudentsOnDate([occurrence("designated", "15:30", [], true), occurrence("other", "19:00")]);
  assert.equal(effectiveOccurrenceId(result, studentId, date), "designated");
});

test("confirmar el turno designado conserva una sola aparición", () => {
  const result = effectiveSessionForStudentsOnDate([occurrence("designated", "15:30", [{ studentId, response: "GOING", respondedAt: "2026-09-03T10:00:00Z" }], true)]);
  assert.equal(effectiveCount(result, "designated"), 1);
});

test("confirmar otro turno elimina la aparición del anterior", () => {
  const result = effectiveSessionForStudentsOnDate([
    occurrence("designated", "15:30", [{ studentId, response: "GOING", respondedAt: "2026-09-03T10:00:00Z" }], true),
    occurrence("latest", "19:00", [{ studentId, response: "GOING", respondedAt: "2026-09-03T11:00:00Z" }]),
  ]);
  assert.equal(effectiveCount(result, "designated"), 0);
});

test("entre confirmaciones duplicadas sólo gana la más reciente", () => {
  const result = effectiveSessionForStudentsOnDate([
    occurrence("first", "15:30", [{ studentId, response: "GOING", respondedAt: "2026-09-03T10:00:00Z" }], true),
    occurrence("latest", "19:00", [{ studentId, response: "GOING", respondedAt: "2026-09-03T11:00:00Z" }]),
  ]);
  assert.equal(effectiveOccurrenceId(result, studentId, date), "latest");
  assert.equal(effectiveCount(result, "latest"), 1);
});

test("los contadores descuentan el turno anterior y suman el nuevo", () => {
  const result = effectiveSessionForStudentsOnDate([
    occurrence("designated", "15:30", [{ studentId, response: "GOING", respondedAt: "2026-09-03T10:00:00Z" }], true),
    occurrence("latest", "19:00", [{ studentId, response: "GOING", respondedAt: "2026-09-03T11:00:00Z" }]),
  ]);
  assert.equal(effectiveCount(result, "designated"), 0);
  assert.equal(effectiveCount(result, "latest"), 1);
});

test("Asistencias filtra la lista con la misma sesión efectiva", () => {
  const attendanceRoute = readFileSync(new URL("../app/api/asistencias/route.ts", import.meta.url), "utf8");
  assert.match(attendanceRoute, /effectiveSessionForStudentsOnDate/);
  assert.match(attendanceRoute, /effectiveOccurrenceId\(effectiveSessions, assignment\.studentId, dateKey\) === occurrence\.id/);
});

test("otra fecha conserva su propio turno efectivo", () => {
  const nextDate = "2026-09-11";
  const result = effectiveSessionForStudentsOnDate([
    occurrence("first-date", "19:00", [{ studentId, response: "GOING", respondedAt: "2026-09-03T11:00:00Z" }]),
    occurrence("next-date", "15:30", [], true, nextDate),
  ]);
  assert.equal(effectiveOccurrenceId(result, studentId, date), "first-date");
  assert.equal(effectiveOccurrenceId(result, studentId, nextDate), "next-date");
});

test("No asistiré no crea otro turno y deja vigente el fallback designado", () => {
  const result = effectiveSessionForStudentsOnDate([
    occurrence("designated", "15:30", [], true),
    occurrence("declined", "19:00", [{ studentId, response: "NOT_GOING", respondedAt: "2026-09-03T11:00:00Z" }]),
  ]);
  assert.equal(effectiveOccurrenceId(result, studentId, date), "designated");
});

test("el histórico previo se conserva y los duplicados se resuelven por fecha de respuesta", () => {
  const portalRoute = readFileSync(new URL("../app/api/portal/clases/route.ts", import.meta.url), "utf8");
  const occurrenceRoute = readFileSync(new URL("../app/api/clases/ocurrencias/route.ts", import.meta.url), "utf8");
  const dashboardRoute = readFileSync(new URL("../app/api/dashboard/route.ts", import.meta.url), "utf8");
  assert.match(portalRoute, /classOccurrenceAttendance\.updateMany/);
  assert.match(portalRoute, /response: null/);
  assert.doesNotMatch(portalRoute, /classOccurrenceAttendance\.deleteMany/);
  for (const source of [occurrenceRoute, dashboardRoute]) {
    assert.match(source, /effectiveSessionForStudentsOnDate/);
    assert.match(source, /effectiveOccurrenceId/);
  }
});
