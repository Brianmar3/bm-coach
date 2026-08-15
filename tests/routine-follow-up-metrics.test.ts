import assert from "node:assert/strict";
import test from "node:test";
import { bodyMetricDelta, expectedRoutineSessions, followUpSummary, routineCompliance, routineFollowUpState } from "../lib/routine-follow-up-metrics.ts";

test("una asignación reciente sin sesiones no genera una alerta falsa", () => {
  const expected = expectedRoutineSessions({ assignedAt: "2026-08-13", plannedDays: 3, today: new Date("2026-08-15T12:00:00") });
  assert.equal(expected, 0);
  assert.deepEqual(routineFollowUpState({ completedSessions: 0, expectedSessions: expected, hasActivePain: false }), { state: "no_data", attentionReason: "" });
});

test("el cumplimiento usa semanas completas y respeta la duración del plan", () => {
  assert.equal(expectedRoutineSessions({ assignedAt: "2026-07-18", startDate: "2026-07-18", durationWeeks: 3, plannedDays: 2, today: new Date("2026-08-15T12:00:00") }), 6);
  assert.equal(routineCompliance(3, 6), 50);
  assert.equal(routineCompliance(0, 0), null);
  assert.equal(routineCompliance(8, 6), 100);
});

test("dolor activo e incumplimiento son motivos explícitos de atención", () => {
  assert.equal(routineFollowUpState({ completedSessions: 2, expectedSessions: 2, hasActivePain: true }).state, "attention");
  assert.deepEqual(routineFollowUpState({ completedSessions: 1, expectedSessions: 3, hasActivePain: false }), { state: "attention", attentionReason: "2 sesiones pendientes del plan" });
  assert.equal(routineFollowUpState({ completedSessions: 3, expectedSessions: 3, hasActivePain: false }).state, "on_track");
});

test("los KPI resumen funcionan con cero, uno y varios alumnos", () => {
  assert.deepEqual(followUpSummary([]), { trackedStudents: 0, onTrack: 0, onTrackPercentage: 0, attention: 0, attentionPercentage: 0, averageSessions: 0 });
  assert.equal(followUpSummary([{ state: "on_track", sessionCount: 2 }]).onTrackPercentage, 100);
  assert.deepEqual(followUpSummary([{ state: "on_track", sessionCount: 4 }, { state: "attention", sessionCount: 1 }, { state: "no_data", sessionCount: 0 }]), { trackedStudents: 3, onTrack: 1, onTrackPercentage: 33, attention: 1, attentionPercentage: 33, averageSessions: 1.7 });
});

test("la evolución corporal sólo calcula delta con datos comparables", () => {
  assert.equal(bodyMetricDelta([null, 80, 78.4]), -1.6);
  assert.equal(bodyMetricDelta([null, 80]), null);
});
