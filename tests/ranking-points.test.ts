import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildValidPointEvents, effectivePointDate, pointEventKeysToInvalidate } from "../lib/point-event-rules.ts";
import { pointPeriodStart } from "../lib/point-period.ts";

test("un alumno sin actividad, creado o con perfil completo obtiene cero puntos", () => {
  assert.deepEqual(buildValidPointEvents({}), []);
});

test("una asistencia y una rutina se puntúan una sola vez con claves estables", () => {
  const input = {
    occurrenceAttendances: [{ id: "attendance-1", date: "2026-07-15", description: "Asistencia" }],
    completedRoutineSessions: [{ id: "routine-1", date: "2026-07-16", description: "Rutina" }],
  };
  const first = buildValidPointEvents(input);
  const second = buildValidPointEvents(input);
  assert.deepEqual(first, second);
  assert.equal(new Set(first.map((item) => item.eventKey)).size, 2);
  assert.equal(first.reduce((sum, item) => sum + item.points, 0), 10);
});

test("usa la fecha efectiva y no createdAt para el período", () => {
  const [event] = buildValidPointEvents({ quickLogs: [{ id: "log-1", date: "2026-07-31", description: "Registro" }] });
  assert.equal(event.occurredAt.toISOString(), "2026-07-31T12:00:00.000Z");
  assert.equal(effectivePointDate("2026-08-01").toISOString(), "2026-08-01T12:00:00.000Z");
});

test("los logros derivados se invalidan y no duplican el evento que los originó", () => {
  const desired = buildValidPointEvents({ legacyAttendances: [{ id: "lisa-july", date: "2026-07-29", description: "Primera clase" }] });
  const obsolete = pointEventKeysToInvalidate([
    { eventKey: "attendance:legacy:lisa-july", active: true, sourceType: "LEGACY_ATTENDANCE" },
    { eventKey: "achievement:classes-1", active: true, sourceType: "ACHIEVEMENT" },
  ], desired);
  assert.deepEqual(obsolete, ["achievement:classes-1"]);
  assert.equal(desired.reduce((sum, item) => sum + item.points, 0), 5);
});

test("casos Lisi y Román: solo Lisi conserva su asistencia real", () => {
  const lisi = buildValidPointEvents({ legacyAttendances: [{ id: "lisi-attendance", date: "2026-07-29", description: "Asistencia real" }] });
  const roman = buildValidPointEvents({});
  assert.equal(lisi.reduce((sum, item) => sum + item.points, 0), 5);
  assert.equal(roman.reduce((sum, item) => sum + item.points, 0), 0);
});

test("el total del desglose coincide con la suma de movimientos", () => {
  const events = buildValidPointEvents({
    quickLogs: [{ id: "q1", date: "2026-08-01", description: "Registro" }],
    occurrenceAttendances: [{ id: "a1", date: "2026-08-01", description: "Asistencia" }],
  });
  assert.equal(events.reduce((sum, item) => sum + item.points, 0), 8);
});

test("dos presentes del mismo día generan un solo evento de puntos", () => {
  const events = buildValidPointEvents({
    occurrenceAttendances: [
      { id: "morning", date: "2026-08-03", description: "Clase 07:00" },
      { id: "afternoon", date: "2026-08-03", description: "Clase 15:30" },
    ],
  });
  assert.equal(events.filter((event) => event.eventType === "ATTENDANCE").length, 1);
  assert.equal(events.reduce((sum, event) => sum + event.points, 0), 5);
});

test("el recálculo previene doble toque y conserva el desempate existente", () => {
  const component = readFileSync(new URL("../componentes/points-ranking.tsx", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/admin/ranking/route.ts", import.meta.url), "utf8");
  assert.match(component, /if \(rebuilding\) return/);
  assert.match(component, /disabled=\{rebuilding\}/);
  const helper = readFileSync(new URL("../lib/point-ranking.ts", import.meta.url), "utf8");
  assert.match(route, /loadPointRanking\(period\)/);
  assert.match(helper, /right\.total - left\.total[\s\S]*right\.historicalTotal[\s\S]*localeCompare/);
});

test("tarjeta mensual y ranking reutilizan el mismo período del ledger", () => {
  const summary = readFileSync(new URL("../lib/student-points.ts", import.meta.url), "utf8");
  const ranking = readFileSync(new URL("../lib/point-ranking.ts", import.meta.url), "utf8");
  const period = readFileSync(new URL("../lib/point-period.ts", import.meta.url), "utf8");
  assert.match(summary, /pointPeriodStart\("month"\)/);
  assert.match(ranking, /pointPeriodStart\(period\)/);
  assert.match(period, /argentinaMonthBounds/);
});

test("el cambio de mes reinicia el período mensual sin alterar el concepto de total histórico", () => {
  assert.equal(pointPeriodStart("month", new Date("2026-08-31T23:59:00-03:00"))?.toISOString(), "2026-08-01T03:00:00.000Z");
  assert.equal(pointPeriodStart("month", new Date("2026-09-01T00:01:00-03:00"))?.toISOString(), "2026-09-01T03:00:00.000Z");
  assert.equal(pointPeriodStart("total", new Date("2026-09-01T00:01:00-03:00")), null);
});

test("el ranking del portal deriva el alumno de la sesión y no acepta studentId", () => {
  const route = readFileSync(new URL("../app/api/portal/ranking/route.ts", import.meta.url), "utf8");
  assert.match(route, /getPortalSession/);
  assert.match(route, /session\.studentId/);
  assert.doesNotMatch(route, /searchParams|get\("studentId"\)/);
});
