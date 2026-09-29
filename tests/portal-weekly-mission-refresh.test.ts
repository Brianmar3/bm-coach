import assert from "node:assert/strict";
import test from "node:test";
import { mergePortalRefresh, validWeeklyMission } from "../lib/portal-weekly-mission-refresh.ts";
import type { PortalData } from "../types/portal.ts";

const mission = {
  id: "mission-2026-09-28",
  weekStart: "2026-09-28",
  weekEnd: "2026-10-04",
  type: "ATTENDANCE" as const,
  title: "Completá tus 3 entrenamientos semanales",
  target: 3,
  progress: 1,
  remaining: 2,
  percentage: 33,
  state: "ACTIVE" as const,
  rewardPoints: 11,
  pointsPerSession: 2,
  completionBonus: 5,
  maximumReward: 11,
  completedAt: null,
  pointsAwardedAt: null,
  message: "Buen comienzo. Te quedan 2 clases.",
};

function portalData(weeklyMission: PortalData["home"]["weeklyMission"], overrides: { status?: string; serviceType?: PortalData["profile"]["serviceType"] } = {}) {
  return {
    profile: { id: "student-1", status: overrides.status ?? "activo", serviceType: overrides.serviceType ?? "CLASSES" },
    home: { weeklyMission },
  } as PortalData;
}

test("acepta únicamente misiones semanales con identidad, semana y progreso válidos", () => {
  assert.equal(validWeeklyMission(mission), true);
  assert.equal(validWeeklyMission({ ...mission, id: "" }), false);
  assert.equal(validWeeklyMission({ ...mission, target: 0 }), false);
  assert.equal(validWeeklyMission({ ...mission, progress: -1 }), false);
});

test("un null o payload inválido transitorio conserva la última misión válida de la semana", () => {
  const previous = portalData(mission);
  assert.equal(mergePortalRefresh(previous, portalData(null), "2026-09-29").home.weeklyMission, mission);
  assert.equal(mergePortalRefresh(previous, portalData({ ...mission, target: 0 }), "2026-09-29").home.weeklyMission, mission);
});

test("una misión nueva válida reemplaza la anterior", () => {
  const updated = { ...mission, progress: 2, remaining: 1, percentage: 67 };
  assert.equal(mergePortalRefresh(portalData(mission), portalData(updated), "2026-09-29").home.weeklyMission, updated);
});

test("la misión desaparece sólo ante un estado válido incompatible o al vencer la semana", () => {
  const previous = portalData(mission);
  assert.equal(mergePortalRefresh(previous, portalData(null, { status: "inactivo" }), "2026-09-29").home.weeklyMission, null);
  assert.equal(mergePortalRefresh(previous, portalData(null, { serviceType: "PERSONALIZED" }), "2026-09-29").home.weeklyMission, null);
  assert.equal(mergePortalRefresh(previous, portalData(null), "2026-10-05").home.weeklyMission, null);
});
