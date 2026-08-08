import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildValidPointEvents, POINT_RULES } from "../lib/point-event-rules.ts";
import { argentinaDateKey, weekRange } from "../lib/weekly-attendance.ts";
import {
  getWeeklyMissionProgress,
  scheduledWeeklyMissionClasses,
  WEEKLY_MISSION_REWARD,
  weeklyMissionAttendanceProgress,
  type WeeklyMissionAssignment,
} from "../lib/weekly-mission.ts";

const assignments: WeeklyMissionAssignment[] = ["MONDAY", "WEDNESDAY", "FRIDAY"].map((dayOfWeek, index) => ({
  scheduleId: `schedule-${index + 1}`,
  assignedAt: "2026-07-01",
  endedAt: null,
  active: true,
  scheduleActive: true,
  dayOfWeek: dayOfWeek as WeeklyMissionAssignment["dayOfWeek"],
}));

function scheduled(overrides: Partial<Parameters<typeof scheduledWeeklyMissionClasses>[0]> = {}) {
  return scheduledWeeklyMissionClasses({
    referenceDate: "2026-08-05",
    joinedAt: "2026-01-01",
    statusEvents: [],
    assignments,
    cancelled: [],
    ...overrides,
  });
}

function mission(progress: number, state: "ACTIVE" | "COMPLETED" | "EXPIRED" = "ACTIVE") {
  return getWeeklyMissionProgress({ id: "mission-1", weekStart: "2026-08-03", weekEnd: "2026-08-09", target: 3, progress, state });
}

test("un alumno de tres días recibe target 3", () => {
  assert.deepEqual(scheduled().map((item) => item.date), ["2026-08-03", "2026-08-05", "2026-08-07"]);
});

test("0/3 y 2/3 permanecen activas con copy natural", () => {
  assert.equal(mission(0).state, "ACTIVE");
  assert.equal(mission(0).message, "Tu semana recién empieza.");
  assert.equal(mission(2).remaining, 1);
  assert.equal(mission(2).message, "Te falta 1 clase para completar la misión.");
});

test("3/3 queda completada y muestra la recompensa central", () => {
  const completed = mission(3, "COMPLETED");
  assert.equal(completed.percentage, 100);
  assert.equal(completed.message, "¡Misión completada!");
  assert.equal(completed.rewardPoints, 15);
  assert.equal(WEEKLY_MISSION_REWARD, POINT_RULES.WEEKLY_MISSION);
});

test("los puntos usan una clave estable y una recarga no crea otra recompensa", () => {
  const input = { weeklyMissions: [{ id: "mission-2026-08-03", date: "2026-08-03", description: "Misión semanal completada" }] };
  const first = buildValidPointEvents(input);
  const reload = buildValidPointEvents(input);
  assert.deepEqual(first, reload);
  assert.equal(first[0].eventKey, "weekly-mission:mission-2026-08-03");
  assert.equal(first[0].points, 15);
  assert.equal(new Set([...first, ...reload].map((item) => item.eventKey)).size, 1);
});

test("sólo PRESENT suma; ausente, justificada y confirmación no cuentan", () => {
  assert.equal(weeklyMissionAttendanceProgress([
    { status: "PRESENT", response: "NOT_GOING" },
    { status: "ABSENT", response: "GOING" },
    { status: "JUSTIFIED", response: "GOING" },
    { status: "UNKNOWN", response: "GOING" },
  ]), 1);
});

test("sin horarios asignados no existe target ni misión posible", () => {
  assert.deepEqual(scheduled({ assignments: [] }), []);
});

test("la oferta general no contamina el target: cinco turnos disponibles y dos asignados dan target 2", () => {
  const assigned = assignments.slice(0, 2);
  const fiveGeneralOccurrences = Array.from({ length: 5 }, (_, index) => ({ id: `general-${index + 1}` }));
  assert.equal(fiveGeneralOccurrences.length, 5);
  assert.equal(scheduled({ assignments: assigned }).length, 2);
  assert.equal(scheduled({ assignments: [] }).length, 0);
});

test("la misión usa asignaciones persistidas y no inventa clases para completar la frecuencia del plan", () => {
  const onlyTwoRealAssignments = assignments.slice(0, 2);
  assert.equal(scheduled({ assignments: onlyTwoRealAssignments }).length, 2);
  const source = readFileSync(new URL("../lib/weekly-mission-data.ts", import.meta.url), "utf8");
  assert.match(source, /weeklyClasses: \{ include: \{ schedule: true \} \}/);
  assert.doesNotMatch(source, /weeklyFrequency|planDays|frequencyDays/);
});

test("los horarios legacy no se infieren: sólo una WeeklyClassAssignment vigente crea target", () => {
  const source = readFileSync(new URL("../lib/weekly-mission-data.ts", import.meta.url), "utf8");
  assert.match(source, /studentRecord\.weeklyClasses\.map/);
  assert.doesNotMatch(source, /primaryScheduleId|flexibleSchedule/);
});

test("un alumno inactivo no acumula clases programadas", () => {
  assert.deepEqual(scheduled({ statusEvents: [{ type: "DEACTIVATION", date: "2026-08-03" }] }), []);
});

test("un alta a mitad de semana excluye clases anteriores", () => {
  assert.deepEqual(scheduled({ joinedAt: "2026-08-05" }).map((item) => item.date), ["2026-08-05", "2026-08-07"]);
});

test("una clase cancelada no forma parte del target", () => {
  assert.deepEqual(scheduled({ cancelled: [{ scheduleId: "schedule-2", date: "2026-08-05" }] }).map((item) => item.date), ["2026-08-03", "2026-08-07"]);
});

test("el snapshot conserva target aunque después cambien plan u horarios", () => {
  const existing = mission(1);
  assert.equal(existing.target, 3);
  assert.equal(scheduled({ assignments: [...assignments, { ...assignments[0], scheduleId: "new-1", dayOfWeek: "TUESDAY" }, { ...assignments[0], scheduleId: "new-2", dayOfWeek: "THURSDAY" }] }).length, 5);
  assert.equal(existing.target, 3);
});

test("una semana nueva tiene otra clave y el historial se conserva en tabla propia", () => {
  assert.deepEqual(weekRange("2026-08-09"), { start: "2026-08-03", end: "2026-08-09", endExclusive: "2026-08-10" });
  assert.deepEqual(weekRange("2026-08-10"), { start: "2026-08-10", end: "2026-08-16", endExclusive: "2026-08-17" });
  const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  assert.match(schema, /model StudentWeeklyMission/);
  assert.match(schema, /@@unique\(\[studentId, weekStart\]\)/);
  assert.match(schema, /ACTIVE\s+COMPLETED\s+EXPIRED/s);
});

test("la semana usa fecha de Argentina", () => {
  assert.equal(argentinaDateKey(new Date("2026-08-10T02:30:00.000Z")), "2026-08-09");
  assert.equal(weekRange(argentinaDateKey(new Date("2026-08-10T02:30:00.000Z")))?.start, "2026-08-03");
});

test("el portal deriva alumno de sesión y el ranking consume el evento existente", () => {
  const portal = readFileSync(new URL("../app/api/portal/data/route.ts", import.meta.url), "utf8");
  const points = readFileSync(new URL("../lib/student-points.ts", import.meta.url), "utf8");
  assert.match(portal, /getPortalSession/);
  assert.match(portal, /const studentId = session\.studentId/);
  assert.doesNotMatch(portal, /searchParams\.get\("studentId"\)/);
  assert.match(points, /studentWeeklyMission\.findMany/);
  assert.match(points, /sourceType === "WEEKLY_MISSION"/);
});

test("la migración es aditiva y no contiene operaciones destructivas", () => {
  const sql = readFileSync(new URL("../prisma/migrations/20260809100000_student_weekly_missions/migration.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE TABLE "student_weekly_missions"/);
  assert.match(sql, /ADD VALUE 'WEEKLY_MISSION'/);
  assert.doesNotMatch(sql, /^\s*(DROP TABLE|ALTER TABLE .* DROP COLUMN|TRUNCATE|DELETE FROM|UPDATE\s+\")/im);
});
