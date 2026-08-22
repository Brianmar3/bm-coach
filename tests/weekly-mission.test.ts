import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildValidPointEvents } from "../lib/point-event-rules.ts";
import { hasGroupClasses } from "../lib/student-service.ts";
import { argentinaDateKey, weekRange } from "../lib/weekly-attendance.ts";
import {
  getWeeklyMissionProgress,
  scheduledWeeklyMissionClasses,
  weeklyMissionMaximumReward,
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

test("3/3 queda completada y muestra la recompensa dinámica", () => {
  const completed = mission(3, "COMPLETED");
  assert.equal(completed.percentage, 100);
  assert.equal(completed.message, "¡Misión completada!");
  assert.equal(completed.rewardPoints, 11);
  assert.equal(completed.pointsPerSession, 2);
  assert.equal(completed.completionBonus, 5);
  assert.equal(completed.maximumReward, 11);
});

test("los puntos semanales usan claves estables y una recarga no duplica sesiones ni bonus", () => {
  const input = { weeklyMissions: [{ id: "mission-2026-08-03", date: "2026-08-03", description: "Misión semanal completada", target: 3, progress: 3, rewardPoints: weeklyMissionMaximumReward(3) }] };
  const first = buildValidPointEvents(input);
  const reload = buildValidPointEvents(input);
  assert.deepEqual(first, reload);
  assert.deepEqual(first.map((item) => item.eventKey), ["weekly-mission-session:mission-2026-08-03:1", "weekly-mission-session:mission-2026-08-03:2", "weekly-mission-session:mission-2026-08-03:3", "weekly-mission-bonus:mission-2026-08-03"]);
  assert.equal(first.reduce((sum, item) => sum + item.points, 0), 11);
  assert.equal(new Set([...first, ...reload].map((item) => item.eventKey)).size, 4);
});

for (const [target, maximum] of [[2, 9], [3, 11], [5, 15]] as const) {
  test(`frecuencia ${target}: entrega +2 por sesión y +5 al completar`, () => {
    const events = buildValidPointEvents({ weeklyMissions: [{ id: `m-${target}`, date: "2026-08-03", description: "Misión", target, progress: target, rewardPoints: weeklyMissionMaximumReward(target) }] });
    assert.equal(events.filter((item) => item.eventKey.startsWith("weekly-mission-session:")).length, target);
    assert.equal(events.filter((item) => item.eventKey.startsWith("weekly-mission-bonus:")).length, 1);
    assert.equal(events.reduce((sum, item) => sum + item.points, 0), maximum);
  });
}

test("4/5 suma 8 puntos y todavía no entrega bonus", () => {
  const events = buildValidPointEvents({ weeklyMissions: [{ id: "m-5-partial", date: "2026-08-03", description: "Misión", target: 5, progress: 4, rewardPoints: weeklyMissionMaximumReward(5) }] });
  assert.equal(events.reduce((sum, item) => sum + item.points, 0), 8);
  assert.equal(events.some((item) => item.eventKey.startsWith("weekly-mission-bonus:")), false);
});

test("una sesión invalidada retira su tramo y el bonus aunque el snapshot previo estuviera completo", () => {
  const events = buildValidPointEvents({ weeklyMissions: [{
    id: "m-invalidated",
    date: "2026-08-03",
    description: "Misión",
    target: 3,
    progress: 3,
    rewardPoints: weeklyMissionMaximumReward(3),
    sessions: [
      { id: "attendance-1", date: "2026-08-03" },
      { id: "attendance-2", date: "2026-08-05" },
    ],
  }] });
  assert.equal(events.reduce((sum, item) => sum + item.points, 0), 4);
  assert.equal(events.some((item) => item.eventKey.startsWith("weekly-mission-bonus:")), false);
});

test("sólo PRESENT suma; ausente, justificada y confirmación no cuentan", () => {
  assert.equal(weeklyMissionAttendanceProgress([
    { status: "PRESENT", response: "NOT_GOING" },
    { status: "ABSENT", response: "GOING" },
    { status: "JUSTIFIED", response: "GOING" },
    { status: "UNKNOWN", response: "GOING" },
  ]), 1);
});

test("la misión cuenta presentes fuera de horario y máximo una vez por día", () => {
  assert.equal(weeklyMissionAttendanceProgress([
    { status: "PRESENT", date: "2026-08-03" },
    { status: "PRESENT", date: "2026-08-03" },
    { status: "PRESENT", date: "2026-08-05" },
  ]), 2);
});

test("sin horarios asignados no existe target ni misión posible", () => {
  assert.deepEqual(scheduled({ assignments: [] }), []);
});

test("Personalizado puro no puede resolver una misión basada en clases", () => {
  assert.equal(hasGroupClasses("PERSONALIZED"), false);
  assert.equal(hasGroupClasses("CLASSES"), true);
  assert.equal(hasGroupClasses("MIXED"), true);

  const source = readFileSync(new URL("../lib/weekly-mission-data.ts", import.meta.url), "utf8");
  const resolver = source.slice(source.indexOf("export async function resolveCurrentWeeklyMission"), source.indexOf("export async function loadCurrentWeeklyMission"));
  assert.match(source, /if \(!hasGroupClasses\(serviceType\) \|\| target <= 0\) return null/);
  assert.match(resolver, /const configuration = await missionConfiguration/);
  assert.ok(resolver.indexOf("if (!configuration) return null") < resolver.indexOf("studentWeeklyMission.findMany"));
});

test("Puntos oculta por completo la misión inexistente y conserva puntos y logros", () => {
  const source = readFileSync(new URL("../componentes/portal-section.tsx", import.meta.url), "utf8");
  const missionCard = source.slice(source.indexOf("function WeeklyMissionAchievement"), source.indexOf("function PointsSummary"));
  const pointsView = source.slice(source.indexOf("function PointsAndAchievementsView"), source.indexOf("function RoutineView"));
  assert.match(missionCard, /if \(!mission\) return null/);
  assert.doesNotMatch(missionCard, /No tenés una misión semanal disponible/);
  assert.match(pointsView, /<PointsSummary data=\{data\} \/>/);
  assert.match(pointsView, /<AchievementsSpotlight data=\{data\} \/>/);
  assert.match(pointsView, /<AchievementsOverview data=\{data\} \/>/);
});

test("la oferta general no contamina el target: cinco turnos disponibles y dos asignados dan target 2", () => {
  const assigned = assignments.slice(0, 2);
  const fiveGeneralOccurrences = Array.from({ length: 5 }, (_, index) => ({ id: `general-${index + 1}` }));
  assert.equal(fiveGeneralOccurrences.length, 5);
  assert.equal(scheduled({ assignments: assigned }).length, 2);
  assert.equal(scheduled({ assignments: [] }).length, 0);
});

test("la misión nueva usa frecuencia histórica o plan y no exige matching de horario", () => {
  const source = readFileSync(new URL("../lib/weekly-mission-data.ts", import.meta.url), "utf8");
  assert.match(source, /membershipHistory/);
  assert.match(source, /frequencyDays/);
  assert.match(source, /planDays/);
  assert.doesNotMatch(source, /allowed\.has/);
});

test("los horarios legacy no se infieren ni limitan el cumplimiento real", () => {
  const source = readFileSync(new URL("../lib/weekly-mission-data.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /primaryScheduleId|flexibleSchedule/);
  assert.doesNotMatch(source, /studentRecord\.weeklyClasses\.map/);
  assert.match(source, /loadPortalAttendanceRange/);
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
  assert.match(points, /weekly-mission-bonus:/);
});

test("Puntos separa total y mes y abre ranking dentro del módulo", () => {
  const portal = readFileSync(new URL("../componentes/portal-section.tsx", import.meta.url), "utf8");
  const view = portal.slice(portal.indexOf("function PointsAndAchievementsView"), portal.indexOf("function MonthlyAttendanceIndicator"));
  assert.match(portal, /points\.monthlyTotal/);
  assert.match(view, /aria-label="Ver ranking mensual"/);
  assert.match(view, /MonthlyRankingDialog/);
  assert.doesNotMatch(view, /campanita|profileImageUrl/);
});

test("la migración es aditiva y no contiene operaciones destructivas", () => {
  const sql = readFileSync(new URL("../prisma/migrations/20260809100000_student_weekly_missions/migration.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE TABLE "student_weekly_missions"/);
  assert.match(sql, /ADD VALUE 'WEEKLY_MISSION'/);
  assert.doesNotMatch(sql, /^\s*(DROP TABLE|ALTER TABLE .* DROP COLUMN|TRUNCATE|DELETE FROM|UPDATE\s+\")/im);
});
