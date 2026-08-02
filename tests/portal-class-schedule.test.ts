import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  argentinaLocalClock,
  classHasEnded,
  classIsInProgress,
  occurrenceBelongsToStudent,
  selectActivePortalSchedules,
  selectRelevantClassDay,
  selectUpcomingClassWindow,
  studentClassAvailability,
  studentIsActiveForClasses,
  type PortalWeeklyScheduleCandidate,
  type PortalClassCandidate,
} from "../lib/portal-class-schedule.ts";

function occurrence(id: string, date: string, startTime: string, endTime: string, status: PortalClassCandidate["status"] = "SCHEDULED", scheduleId = id): PortalClassCandidate {
  return { id, scheduleId, date, startTime, endTime, status };
}

function assignment(
  scheduleId: string,
  dayOfWeek: string,
  startTime: string,
  options: { active?: boolean; scheduleActive?: boolean; endedAt?: Date | null } = {},
): PortalWeeklyScheduleCandidate {
  return {
    scheduleId,
    active: options.active ?? true,
    endedAt: options.endedAt ?? null,
    schedule: {
      active: options.scheduleActive ?? true,
      dayOfWeek,
      startTime,
      endTime: "21:00",
      classType: "Entrenamiento funcional",
    },
  };
}

test("usa fecha y hora de America/Argentina/Buenos_Aires", () => {
  assert.deepEqual(argentinaLocalClock(new Date("2026-08-04T02:30:00.000Z")), { date: "2026-08-03", time: "23:30:00" });
});

test("el domingo 2 incluye la clase del lunes 3 aun a las 23:30 de Argentina", () => {
  const tomorrow = occurrence("monday", "2026-08-03", "07:00", "08:00");
  const result = selectUpcomingClassWindow([tomorrow], new Date("2026-08-03T02:30:00.000Z"));
  assert.deepEqual(result, { from: "2026-08-02", to: "2026-08-09", occurrenceIds: ["monday"] });
  assert.equal(selectRelevantClassDay([tomorrow], new Date("2026-08-03T02:30:00.000Z")).date, "2026-08-03");
});

test("los proximos siete dias cruzan semana y fin de mes sin usar UTC como dia local", () => {
  const result = selectUpcomingClassWindow([
    occurrence("july", "2026-07-31", "20:00", "21:00"),
    occurrence("august", "2026-08-03", "07:00", "08:00"),
    occurrence("outside", "2026-08-08", "07:00", "08:00"),
  ], new Date("2026-08-01T02:30:00.000Z"));
  assert.equal(result.from, "2026-07-31");
  assert.equal(result.to, "2026-08-07");
  assert.deepEqual(result.occurrenceIds, ["august"]);
});

test("la ventana futura excluye clases pasadas, inactivas y canceladas", () => {
  const now = new Date("2026-08-03T22:30:00.000Z");
  const result = selectUpcomingClassWindow([
    occurrence("ended", "2026-08-03", "18:00", "19:00"),
    occurrence("current", "2026-08-03", "19:00", "20:00"),
    occurrence("cancelled", "2026-08-04", "07:00", "08:00", "CANCELLED"),
    occurrence("valid", "2026-08-04", "08:00", "09:00"),
  ], now);
  assert.deepEqual(result.occurrenceIds, ["current", "valid"]);
});

test("los horarios semanales respetan actividad, vigencia y orden lunes a domingo", () => {
  const schedules = selectActivePortalSchedules([
    assignment("friday", "FRIDAY", "08:00"),
    assignment("inactive", "MONDAY", "07:00", { active: false }),
    assignment("ended", "TUESDAY", "07:00", { endedAt: new Date("2026-08-01T00:00:00.000Z") }),
    assignment("disabled-schedule", "WEDNESDAY", "07:00", { scheduleActive: false }),
    assignment("monday-late", "MONDAY", "20:00"),
    assignment("monday-early", "MONDAY", "07:00"),
  ]);
  assert.deepEqual(schedules.map((item) => item.scheduleId), ["monday-early", "monday-late", "friday"]);
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
  assert.equal(studentClassAvailability("inactivo", "inactivo").reason, "INACTIVE");
  assert.equal(studentClassAvailability("activo", "suspendido").reason, "SUSPENDED");
  assert.equal(studentClassAvailability("activo").message, null);
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

test("la API materializa recurrencias y devuelve una unica ventana calculada en servidor", () => {
  const source = readFileSync(new URL("../app/api/portal/clases/route.ts", import.meta.url), "utf8");
  assert.ok(source.indexOf("ensureClassOccurrences(PORTAL_CLASS_SEARCH_DAYS)") < source.indexOf("prisma.classOccurrence.findMany"));
  assert.match(source, /upcoming: selectUpcomingClassWindow\(serialized\)/);
  assert.match(source, /selectActivePortalSchedules\(assignments\)/);
  assert.match(source, /status: \{ not: "CANCELLED" \}/);
});

test("la vista consume la ventana del servidor y muestra un unico estado vacio", () => {
  const source = readFileSync(new URL("../componentes/portal-classes.tsx", import.meta.url), "utf8");
  assert.match(source, /data\?\.upcoming\.occurrenceIds/);
  assert.doesNotMatch(source, /const weekStart =/);
  assert.equal(source.match(/No tenés clases asignadas para los próximos 7 días\./g)?.length, 1);
  assert.match(source, /data\.availability\.message/);
});
