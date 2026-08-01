import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  argentinaLocalClock,
  classHasEnded,
  classIsInProgress,
  occurrenceBelongsToStudent,
  selectRelevantClassDay,
  studentIsActiveForClasses,
  type PortalClassCandidate,
} from "../lib/portal-class-schedule.ts";

function occurrence(id: string, date: string, startTime: string, endTime: string, status: PortalClassCandidate["status"] = "SCHEDULED", scheduleId = id): PortalClassCandidate {
  return { id, scheduleId, date, startTime, endTime, status };
}

test("usa fecha y hora de America/Argentina/Buenos_Aires", () => {
  assert.deepEqual(argentinaLocalClock(new Date("2026-08-04T02:30:00.000Z")), { date: "2026-08-03", time: "23:30:00" });
});

test("mantiene hoy cuando hay una clase futura y las ordena por hora", () => {
  const result = selectRelevantClassDay([
    occurrence("late", "2026-08-03", "20:00", "21:00"),
    occurrence("early", "2026-08-03", "18:00", "19:00"),
  ], new Date("2026-08-03T19:00:00.000Z"));
  assert.equal(result.title, "Clases de hoy");
  assert.deepEqual(result.occurrenceIds, ["early", "late"]);
});

test("una clase iniciada y no finalizada sigue en curso", () => {
  const clock = argentinaLocalClock(new Date("2026-08-03T22:30:00.000Z"));
  const item = occurrence("current", "2026-08-03", "19:00", "20:00");
  assert.equal(classIsInProgress(item, clock), true);
  assert.equal(classHasEnded(item, clock), false);
  assert.equal(selectRelevantClassDay([item], new Date("2026-08-03T22:30:00.000Z")).date, "2026-08-03");
  assert.equal(classIsInProgress(item, argentinaLocalClock(new Date("2026-08-03T22:00:00.000Z"))), true);
});

test("al llegar exactamente al final considera terminada la última clase", () => {
  const today = occurrence("today", "2026-08-03", "20:00", "21:00");
  const tomorrow = occurrence("tomorrow", "2026-08-04", "07:00", "08:00");
  const now = new Date("2026-08-04T00:00:00.000Z");
  assert.equal(classHasEnded(today, argentinaLocalClock(now)), true);
  const result = selectRelevantClassDay([today, tomorrow], now);
  assert.equal(result.date, "2026-08-04");
  assert.equal(result.title, "Clases de mañana");
});

test("salta de viernes a lunes sin etiquetarlo como mañana", () => {
  const result = selectRelevantClassDay([
    occurrence("friday", "2026-08-07", "20:00", "21:00"),
    occurrence("monday", "2026-08-10", "07:00", "08:00"),
  ], new Date("2026-08-08T00:01:00.000Z"));
  assert.equal(result.date, "2026-08-10");
  assert.equal(result.title, "Próximas clases · Lunes 10 de agosto");
});

test("ignora una clase cancelada y busca la siguiente válida", () => {
  const result = selectRelevantClassDay([
    occurrence("cancelled", "2026-08-04", "07:00", "08:00", "CANCELLED"),
    occurrence("valid", "2026-08-05", "08:00", "09:00"),
  ], new Date("2026-08-04T00:01:00.000Z"));
  assert.equal(result.date, "2026-08-05");
  assert.deepEqual(result.occurrenceIds, ["valid"]);
});

test("solo acepta disciplinas y ocurrencias asignadas o explícitas al alumno", () => {
  const assigned = new Set(["functional-schedule"]);
  const explicit = new Set(["explicit-gap"]);
  assert.equal(occurrenceBelongsToStudent(occurrence("functional", "2026-08-04", "07:00", "08:00", "SCHEDULED", "functional-schedule"), assigned, explicit), true);
  assert.equal(occurrenceBelongsToStudent(occurrence("gap", "2026-08-04", "08:00", "09:00", "SCHEDULED", "gap-schedule"), assigned, explicit), false);
  assert.equal(occurrenceBelongsToStudent(occurrence("kids", "2026-08-04", "09:00", "10:00", "SCHEDULED", "kids-schedule"), assigned, explicit), false);
  assert.equal(occurrenceBelongsToStudent(occurrence("explicit-gap", "2026-08-04", "10:00", "11:00", "SCHEDULED", "gap-schedule"), assigned, explicit), true);
});

test("alumno inactivo o suspendido no tiene clases disponibles", () => {
  assert.equal(studentIsActiveForClasses("inactivo"), false);
  assert.equal(studentIsActiveForClasses("activo", "suspendido"), false);
  assert.equal(studentIsActiveForClasses("activo"), true);
});

test("devuelve estado vacío cuando no hay próximas clases dentro del rango", () => {
  const result = selectRelevantClassDay([], new Date("2026-08-03T19:00:00.000Z"), 35);
  assert.equal(result.date, null);
  assert.equal(result.subtitle, "No encontramos próximas clases asignadas. Consultá con tu entrenador.");
});

test("la API deriva el alumno desde sesión y no acepta studentId del navegador", () => {
  const source = readFileSync(new URL("../app/api/portal/clases/route.ts", import.meta.url), "utf8");
  assert.match(source, /session\.studentId/);
  assert.doesNotMatch(source, /input\.studentId/);
  assert.match(source, /scheduleId: \{ in: \[\.\.\.assignedScheduleIds\] \}/);
});
