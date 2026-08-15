import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildBodyProgress, buildExerciseRecords, buildPortalProgress } from "../lib/portal-progress.ts";

const plan = { id: "routine-1", name: "Plan actual", assignedAt: "2026-07-18", startDate: "2026-07-18", durationWeeks: 8, plannedDays: 2 };
const session = (id: string, date: string, durationMinutes: number | null = 60) => ({
  id, date, routineName: "Plan actual", dayNumber: 1, dayName: "Tren inferior", durationMinutes,
  blocks: [{ completed: true }, { completed: false }],
  exercises: [{ exerciseReferenceId: "squat", exerciseName: "Sentadilla", sets: [{ completed: true, weight: 60, repetitions: 8 }, { completed: false, weight: 90, repetitions: 2 }] }],
});
const evaluation = (date: string, weight: number | null) => ({ date, weight, bodyFatPercentage: null, muscleMass: null, waist: null, hip: null, chest: null });

test("el resumen funciona con cero, una y varias sesiones sin NaN", () => {
  const empty = buildPortalProgress({ plan, sessions: [], evaluations: [], today: new Date("2026-08-15T12:00:00") });
  assert.equal(empty.summary.completedSessions, 0);
  assert.equal(empty.summary.totalDurationMinutes, null);
  assert.equal(empty.summary.lastSessionDate, null);
  assert.equal(Number.isNaN(empty.summary.adherencePercentage), false);

  const one = buildPortalProgress({ plan, sessions: [session("one", "2026-08-14")], evaluations: [], today: new Date("2026-08-15T12:00:00") });
  assert.deepEqual({ sessions: one.summary.completedSessions, duration: one.summary.totalDurationMinutes, blocks: one.summary.completedBlocks, exercises: one.summary.registeredExercises, sets: one.summary.completedSets }, { sessions: 1, duration: 60, blocks: 1, exercises: 1, sets: 1 });

  const many = buildPortalProgress({ plan, sessions: [session("old", "2026-08-01", null), session("new", "2026-08-14", 45)], evaluations: [], today: new Date("2026-08-15T12:00:00") });
  assert.equal(many.summary.completedSessions, 2);
  assert.equal(many.summary.totalDurationMinutes, 45);
  assert.equal(many.summary.lastSessionDate, "2026-08-14");
});

test("la adherencia reutiliza semanas completas del seguimiento del entrenador", () => {
  const progress = buildPortalProgress({ plan, sessions: [session("1", "2026-08-01"), session("2", "2026-08-08"), session("3", "2026-08-14")], evaluations: [], today: new Date("2026-08-15T12:00:00") });
  assert.equal(progress.summary.expectedSessions, 8);
  assert.equal(progress.summary.adherencePercentage, 38);
});

test("la evolución contempla 0, 1 y 2+ evaluaciones y calcula cambio neutral", () => {
  assert.deepEqual(buildBodyProgress([]), []);
  assert.equal(buildBodyProgress([evaluation("2026-08-01", 80)])[0].change, null);
  const weight = buildBodyProgress([evaluation("2026-08-01", 80), evaluation("2026-08-14", 77.5)])[0];
  assert.equal(weight.change, -2.5);
  assert.deepEqual(weight.points.map((point) => point.value), [80, 77.5]);
});

test("las marcas usan sólo series completadas y no mezclan IDs de ejercicios", () => {
  const sessions = [session("1", "2026-08-01"), { ...session("2", "2026-08-14"), exercises: [
    { exerciseReferenceId: "squat", exerciseName: "Sentadilla", sets: [{ completed: true, weight: 70, repetitions: 6 }] },
    { exerciseReferenceId: "press", exerciseName: "Press", sets: [{ completed: true, weight: 40, repetitions: 12 }] },
  ] }];
  const records = buildExerciseRecords(sessions);
  assert.equal(records.find((record) => record.exerciseId === "squat")?.maximumWeight, 70);
  assert.equal(records.find((record) => record.exerciseId === "squat")?.maximumRepetitions, 8);
  assert.equal(records.find((record) => record.exerciseId === "press")?.maximumWeight, 40);
});

test("el historial devuelve únicamente las tres sesiones más recientes", () => {
  const sessions = [session("1", "2026-08-01"), session("4", "2026-08-14"), session("2", "2026-08-05"), session("3", "2026-08-10")];
  const progress = buildPortalProgress({ plan, sessions, evaluations: [], today: new Date("2026-08-15T12:00:00") });
  assert.deepEqual(progress.recentSessions.map((item) => item.id), ["4", "3", "2"]);
});

test("el acceso y el endpoint respetan capacidad, navegación y seguridad", () => {
  const view = readFileSync(new URL("../componentes/portal-section.tsx", import.meta.url), "utf8");
  const page = readFileSync(new URL("../componentes/portal-progress.tsx", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/portal/progreso/route.ts", import.meta.url), "utf8");
  assert.match(view, /hasPersonalizedService\(data\.profile\.serviceType\)[\s\S]*Ver mi progreso/);
  assert.match(page, /href="\/portal\/rutina"/);
  assert.match(page, /href="\/portal\/evaluaciones"/);
  assert.match(view, /linked\.open = true/);
  assert.match(route, /const studentId = session\.studentId/);
  assert.doesNotMatch(route, /searchParams|get\("studentId"\)|params\.studentId/);
  assert.match(route, /status: 401/);
});

test("visitar progreso no limpia el borrador local del entrenamiento", () => {
  const view = readFileSync(new URL("../componentes/portal-section.tsx", import.meta.url), "utf8");
  const access = view.slice(view.indexOf('href="/portal/progreso"'), view.indexOf('href="/portal/progreso"') + 900);
  assert.doesNotMatch(access, /localStorage\.removeItem|setDraft\(null\)/);
  assert.match(view, /localStorage\.setItem\(storageKey\(draft\.dayId\), JSON\.stringify\(draft\)\)/);
});
