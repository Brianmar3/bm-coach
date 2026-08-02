import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { PortalWorkoutSession } from "../types/portal.ts";
import { validateWorkoutSessionInput } from "../lib/workout-session-validation.ts";
import {
  createFreshWorkoutSets,
  findCurrentWeekSession,
  getLocalWeekEnd,
  getLocalWeekStart,
  getWeekKey,
  getWorkoutWeekRange,
  legacyWorkoutDraftStorageKey,
  sessionBelongsToWeek,
  weeklySessionLockKey,
  workoutDraftStorageKey,
} from "../lib/workout-week.ts";

const portalSource = readFileSync(new URL("../componentes/portal-section.tsx", import.meta.url), "utf8");
const apiSource = readFileSync(new URL("../app/api/portal/entrenamientos/route.ts", import.meta.url), "utf8");
const dataSource = readFileSync(new URL("../app/api/portal/data/route.ts", import.meta.url), "utf8");

function validSession(overrides: Partial<PortalWorkoutSession> = {}): PortalWorkoutSession {
  return {
    routineId: "routine-a",
    routineName: "Rutina A",
    dayId: "day-a",
    dayNumber: 1,
    date: "2026-08-03",
    startTime: "18:30",
    durationMinutes: 45,
    generalFeeling: "Buena",
    finalComment: "Sensación general: Buena",
    hasPain: false,
    painDetails: "",
    status: "finalizado",
    exercises: [{ exerciseId: "exercise-a", exerciseName: "Sentadilla", observation: "", previous: null, history: [], sets: [{ setNumber: 1, weight: 30, repetitions: 10, effort: 2, completed: true, observation: "" }] }],
    ...overrides,
  };
}

test("finaliza sin energyBefore", () => {
  const input = validSession();
  delete input.energyBefore;
  assert.equal(validateWorkoutSessionInput(input), null);
});

test("finaliza sin energyAfter", () => {
  const input = validSession();
  delete input.energyAfter;
  assert.equal(validateWorkoutSessionInput(input), null);
});

test("finaliza sin dificultad percibida", () => {
  const input = validSession();
  delete input.difficulty;
  assert.equal(validateWorkoutSessionInput(input), null);
});

test("sesiones históricas con escalas antiguas siguen siendo válidas", () => {
  assert.equal(validateWorkoutSessionInput(validSession({ energyBefore: 3, energyAfter: 4, difficulty: 5 })), null);
});

test("exige una sensación general válida y acepta el formato histórico", () => {
  assert.equal(validateWorkoutSessionInput(validSession({ generalFeeling: undefined, finalComment: "Sensación general: Normal" })), null);
  assert.match(validateWorkoutSessionInput(validSession({ generalFeeling: undefined, finalComment: "Sin sensación" })) ?? "", /sensación general válida/);
});

test("la semana argentina comienza el lunes a las 00:00", () => {
  assert.equal(getWeekKey("2026-08-05"), "2026-08-03");
  assert.equal(getLocalWeekStart("2026-08-05").toISOString(), "2026-08-03T03:00:00.000Z");
  assert.equal(getLocalWeekEnd("2026-08-05").toISOString(), "2026-08-10T02:59:59.999Z");
});

test("el cambio de domingo a lunes usa la hora argentina", () => {
  assert.equal(getWeekKey(new Date("2026-08-03T02:59:59.000Z")), "2026-07-27");
  assert.equal(getWeekKey(new Date("2026-08-03T03:00:00.000Z")), "2026-08-03");
});

test("el rango semanal usa fin exclusivo y cruza fin de mes", () => {
  assert.deepEqual(getWorkoutWeekRange("2026-08-31").startKey, "2026-08-31");
  assert.equal(getWorkoutWeekRange("2026-08-31").endExclusiveKey, "2026-09-07");
});

test("el weekKey cruza fin de año sin cortar la semana", () => {
  assert.equal(getWeekKey("2026-12-31"), "2026-12-28");
  assert.equal(getWeekKey("2027-01-01"), "2026-12-28");
  assert.equal(getWeekKey("2027-01-04"), "2027-01-04");
});

test("una semana nueva crea cero checks y conserva solamente la carga", () => {
  const sets = createFreshWorkoutSets(2, 20, [{ weight: 30 }, { weight: 32.5 }]);
  assert.deepEqual(sets, [
    { setNumber: 1, weight: 30, repetitions: null, effort: null, completed: false, observation: "" },
    { setNumber: 2, weight: 32.5, repetitions: null, effort: null, completed: false, observation: "" },
  ]);
});

test("la carga programada funciona como fallback sin precargar repeticiones ni RIR/RPE", () => {
  assert.deepEqual(createFreshWorkoutSets(1, 25), [{ setNumber: 1, weight: 25, repetitions: null, effort: null, completed: false, observation: "" }]);
});

const sessions = [
  { id: "old", routineId: "routine-a", dayId: "day-a", date: "2026-07-27", status: "en_progreso" as const },
  { id: "current", routineId: "routine-a", dayId: "day-a", date: "2026-08-03", status: "en_progreso" as const },
  { id: "other-day", routineId: "routine-a", dayId: "day-b", date: "2026-08-03", status: "en_progreso" as const },
  { id: "other-routine", routineId: "routine-b", dayId: "day-a", date: "2026-08-03", status: "en_progreso" as const },
];

test("una IN_PROGRESS vieja no reaparece ni bloquea la semana nueva", () => {
  assert.equal(sessionBelongsToWeek(sessions[0], "2026-08-03"), false);
  assert.equal(findCurrentWeekSession([sessions[0]], { routineId: "routine-a", dayId: "day-a", weekKey: "2026-08-03" }), null);
});

test("reabrir durante la misma semana recupera la sesión actual", () => {
  assert.equal(findCurrentWeekSession(sessions, { routineId: "routine-a", dayId: "day-a", weekKey: "2026-08-03" })?.id, "current");
});

test("varias IN_PROGRESS heredadas no crean otra y priorizan la más reciente recibida", () => {
  const duplicate = { ...sessions[1], id: "older-current", date: "2026-08-04" };
  assert.equal(findCurrentWeekSession([sessions[1], duplicate], { routineId: "routine-a", dayId: "day-a", weekKey: "2026-08-03" })?.id, "current");
});

test("rutinas y días del mismo alumno permanecen aislados", () => {
  assert.equal(findCurrentWeekSession(sessions, { routineId: "routine-a", dayId: "day-b", weekKey: "2026-08-03" })?.id, "other-day");
  assert.equal(findCurrentWeekSession(sessions, { routineId: "routine-b", dayId: "day-a", weekKey: "2026-08-03" })?.id, "other-routine");
});

test("la misma rutina puede repetirse la semana siguiente", () => {
  assert.equal(findCurrentWeekSession([sessions[1]], { routineId: "routine-a", dayId: "day-a", weekKey: "2026-08-10" }), null);
});

test("sesiones antiguas sin columna weekKey se clasifican por su fecha efectiva", () => {
  assert.equal(sessionBelongsToWeek({ date: "2026-08-06" }, "2026-08-03"), true);
});

test("la clave local incluye alumno, rutina, día y semana", () => {
  assert.equal(workoutDraftStorageKey("student", "routine", "day", "2026-08-03"), "bm-workout:student:routine:day:2026-08-03");
  assert.notEqual(workoutDraftStorageKey("student", "routine-a", "day", "2026-08-03"), workoutDraftStorageKey("student", "routine-b", "day", "2026-08-03"));
  assert.notEqual(workoutDraftStorageKey("student", "routine", "day-a", "2026-08-03"), workoutDraftStorageKey("student", "routine", "day-b", "2026-08-03"));
});

test("las claves antiguas son reconocibles pero nunca coinciden con la clave semanal", () => {
  assert.equal(legacyWorkoutDraftStorageKey("student", "day"), "bm-workout-student-day");
  assert.notEqual(legacyWorkoutDraftStorageKey("student", "day"), workoutDraftStorageKey("student", "routine", "day", "2026-08-03"));
  assert.match(portalSource, /removeItem\(legacyWorkoutDraftStorageKey/);
});

test("el portal selecciona sesiones y borradores exclusivamente por weekKey", () => {
  assert.match(portalSource, /findCurrentWeekSession/);
  assert.match(portalSource, /sessionBelongsToWeek\(session, weekKey\)/);
  assert.match(portalSource, /workoutDraftStorageKey\(data\.profile\.id, routine\.id, dayId, weekKey\)/);
  assert.doesNotMatch(portalSource, /getItem\(`bm-workout-\$\{data\.profile\.id\}/);
});

test("la API bloquea doble toque con una clave semanal y transacción serializable", () => {
  assert.notEqual(weeklySessionLockKey("s", "r", "d", "2026-08-03"), weeklySessionLockKey("s", "r", "d", "2026-08-10"));
  assert.match(apiSource, /pg_advisory_xact_lock/);
  assert.match(apiSource, /TransactionIsolationLevel\.Serializable/);
  assert.match(apiSource, /WEEKLY_SESSION:/);
});

test("solo reutiliza una IN_PROGRESS de la combinación y rango semanal actuales", () => {
  assert.match(apiSource, /routineId: input\.routineId, dayId: input\.dayId, status: "IN_PROGRESS"/);
  assert.match(apiSource, /date: \{ gte: weekRange\.startDate, lt: weekRange\.endExclusiveDate \}/);
});

test("una COMPLETED es inmutable incluso ante cambio de fecha o reapertura", () => {
  assert.match(apiSource, /existingSession\?\.status === "COMPLETED"/);
  assert.match(apiSource, /Una sesión finalizada no puede modificarse ni reabrirse/);
  assert.match(apiSource, /databaseDateKey\(existingSession\.date\) !== input\.date/);
  assert.match(apiSource, /existing\.status === "COMPLETED"/);
});

test("los cambios del entrenador no reemplazan snapshots ya iniciados", () => {
  assert.match(apiSource, /previousSnapshot\?\.targetSets \?\? programmed\.sets/);
  assert.match(apiSource, /previousSnapshot\?\.coachInstructions \?\? programmed\.observations/);
  assert.match(apiSource, /previousSnapshot\?\.exerciseName/);
});

test("el historial conserva todas las series y no filtra las sesiones viejas", () => {
  assert.match(dataSource, /sets: \{ orderBy: \{ setNumber: "asc" \} \}/);
  assert.match(dataSource, /sets: log\.sets\.map/);
  assert.match(dataSource, /where: \{ studentId \}/);
});

test("la nueva sesión conserva referencias pero no observaciones del borrador anterior", () => {
  assert.match(portalSource, /createFreshWorkoutSets\(exercise\.sets, exercise\.weight, previous\?\.item\.sets \?\? \[\]\)/);
  assert.match(portalSource, /observation: "", previous:/);
});
