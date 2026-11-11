
import assert from "node:assert/strict";
import test from "node:test";
import { buildSportsPointEvents, contractualFrequency, pointPolicyStart, sportsTrainingDays, sportsWeeklyGoal, validTrainingWeight, type SportsActivity, type SportsContract } from "../lib/sports-point-policy.ts";

const start = "2026-12-01";
const activity = (date: string, kind: SportsActivity["kind"] = "class", hasWeight = false): SportsActivity => ({ id: kind + date, date, kind, hasWeight });
const contract = (frequencyDays: number | null, serviceType: SportsContract["serviceType"] = "MIXED"): SportsContract =>
  ({ start: "2026-11-01", end: null, serviceType, active: true, frequencyDays });

test("solo fechas de inicio de mes y frecuencias estructuradas de 2 a 5", () => {
  assert.deepEqual([0, -2, null, NaN, Infinity, "NaN", 1, "42.5"].map(validTrainingWeight), [false, false, false, false, false, false, true, true]);
  assert.equal(pointPolicyStart(start), start);
  assert.equal(pointPolicyStart("2026-12-02"), "");
  assert.equal(pointPolicyStart("2026-13-01"), "");
  assert.deepEqual([2, 3, 4, 5, "4", "Plan 3 meses", 1, 6, null].map(contractualFrequency), [2, 3, 4, 5, null, null, null, null, null]);
});

for (const frequency of [2, 3, 4, 5]) {
  test(`objetivo de ${frequency} días: +5 solo al completar todos los entrenamientos`, () => {
    for (const service of ["CLASSES", "PERSONALIZED", "MIXED"] as const) {
      const contracts = [contract(frequency, service)];
      const days = Array.from({ length: frequency }, (_, index) => activity(
        "2026-12-" + String(7 + index).padStart(2, "0"),
        service === "PERSONALIZED" || (service === "MIXED" && index % 2 === 1) ? "routine" : "class",
      ));
      const events = (items: SportsActivity[]) => buildSportsPointEvents({ start, today: "2026-12-13", days: sportsTrainingDays(items, contracts, service), contracts, achievements: [] });
      assert.deepEqual(events(days).filter(event => event.eventType === "WEEKLY_MISSION").map(event => event.points), [5]);
      assert.equal(events(days.slice(1)).some(event => event.eventType === "WEEKLY_MISSION"), false);
    }
  });
}

test("Mixto deduplica clase, rutina y cargas del mismo día; sin contrato verificable omite bonus", () => {
  const contracts = [contract(null)];
  const days = sportsTrainingDays([activity(start), activity(start, "routine", true), activity(start, "class", true)], contracts, "MIXED");
  assert.deepEqual(buildSportsPointEvents({ start, today: start, days, contracts, achievements: [] }).map(event => [event.eventKey, event.points]),
    [["sports:training:2026-12-01", 2], ["sports:load:2026-12-01", 1]]);
  assert.equal(sportsWeeklyGoal("2026-11-30", days, contracts), null);
});

test("un cambio a mitad de semana conserva el objetivo del contrato vigente al comenzar", () => {
  const contracts = [{ ...contract(2), start: "2026-12-09" }, { ...contract(4), end: "2026-12-09" }];
  const days = [7, 8, 9, 10].map(day => activity("2026-12-" + String(day).padStart(2, "0")));
  assert.equal(sportsWeeklyGoal("2026-12-07", days, contracts)?.target, 4);
  assert.equal(sportsWeeklyGoal("2026-12-07", days, contracts)?.completedAt, "2026-12-10");
  assert.equal(sportsWeeklyGoal("2026-12-14", days, contracts)?.target, 2);
});

test("noviembre puede completar el progreso de la semana sin crear movimientos previos; bloquea futuros y logros repetidos", () => {
  const days = [activity("2026-11-30"), activity(start), activity("2026-12-03")];
  const events = buildSportsPointEvents({ start, today: "2026-12-02", days, contracts: [contract(2)], achievements: [
    { id: "repetido", date: "2026-11-30", name: "Anterior" },
    { id: "repetido", date: start, name: "Anterior" },
    { id: "nuevo", date: start, name: "Nuevo" },
    { id: "nuevo", date: "2026-12-02", name: "Nuevo" },
  ] });
  assert.deepEqual(events.map(event => [event.eventKey, event.points]), [
    ["sports:training:2026-12-01", 2], ["sports:weekly:2026-11-30", 5], ["achievement:nuevo", 3],
  ]);
});

test("Mantequita sin frecuencia suma entrenamiento, peso y logro sin heredar el objetivo anterior", () => {
  const contracts = [
    { ...contract(null, "CLASSES"), start: "2026-12-01" },
    { ...contract(5, "CLASSES"), end: "2026-12-01" },
  ];
  const days = sportsTrainingDays([activity("2026-12-07", "class", true), activity("2026-12-08")], contracts, "CLASSES");
  const events = buildSportsPointEvents({ start, today: "2026-12-13", days, contracts,
    achievements: [{ id: "qa", date: "2026-12-08", name: "Hito" }] });
  assert.deepEqual(events.map(event => [event.eventType, event.points]), [["ATTENDANCE", 2], ["RECORD", 1], ["ATTENDANCE", 2], ["ACHIEVEMENT", 3]]);
  assert.equal(sportsWeeklyGoal("2026-12-07", days, contracts), null);
});

test("Semipersonalizado cambia de tres a cuatro días con fecha efectiva y conserva la semana anterior", () => {
  const contracts = [{ ...contract(4, "PERSONALIZED"), start: "2026-12-14" },
    { ...contract(3, "PERSONALIZED"), end: "2026-12-14" }];
  const days = sportsTrainingDays(["07", "09", "11", "14", "15", "16", "17"].map(day => activity("2026-12-" + day, "routine")), contracts, "PERSONALIZED");
  assert.equal(sportsWeeklyGoal("2026-12-07", days, contracts)?.target, 3);
  assert.equal(sportsWeeklyGoal("2026-12-14", days, contracts)?.target, 4);
  const events = buildSportsPointEvents({ start, today: "2026-12-20", days, contracts, achievements: [] });
  assert.deepEqual(events.filter(event => event.eventType === "WEEKLY_MISSION").map(event => event.points), [5, 5]);
});
