import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isAchievementEligibleForService, isCompetitiveGamificationEligible } from "../lib/student-service.ts";

const read = (path: string) => readFileSync(path, "utf8");

test("CLASSES y MIXED son competitivos; PERSONALIZED no", () => {
  assert.equal(isCompetitiveGamificationEligible("CLASSES"), true);
  assert.equal(isCompetitiveGamificationEligible("MIXED"), true);
  assert.equal(isCompetitiveGamificationEligible("PERSONALIZED"), false);
});

test("PERSONALIZED conserva logros individuales y excluye los de clases", () => {
  assert.equal(isAchievementEligibleForService("PERSONALIZED", { category: "RUTINAS", source: "ROUTINE" }), true);
  assert.equal(isAchievementEligibleForService("PERSONALIZED", { category: "ASISTENCIA" }), false);
  assert.equal(isAchievementEligibleForService("PERSONALIZED", { source: "CLASS" }), false);
});

test("backend bloquea puntos, ranking y bonus de pago para PERSONALIZED", () => {
  assert.match(read("lib/student-points.ts"), /!isCompetitiveGamificationEligible\(student\.serviceType\)/);
  assert.match(read("lib/point-ranking.ts"), /isCompetitiveGamificationEligible\(record\.serviceType\)/);
  assert.match(read("lib/payment-notifications.ts"), /isCompetitiveGamificationEligible\(student\.serviceType\)/);
  assert.match(read("app/api/portal/ranking/route.ts"), /redirectTo: "\/portal\/progreso"/);
});

test("la experiencia PERSONALIZED usa progreso y oculta superficies competitivas", () => {
  const portal = read("componentes/portal-section.tsx");
  assert.match(portal, /competitive \? <Link href="\/portal\/puntos"/);
  assert.match(portal, /href="\/portal\/progreso"/);
  assert.match(portal, /competitive \? "Puntos y logros" : "Progreso y logros"/);
  assert.match(read("app/portal/(student)/ranking/page.tsx"), /redirect\("\/portal\/progreso"\)/);
});

test("los cambios de servicio filtran actividad por períodos sin borrar puntos históricos", () => {
  const points = read("lib/student-points.ts");
  assert.match(points, /studentMembershipHistory\.findMany/);
  assert.match(points, /pointEventWasCompetitivelyEligible/);
  assert.doesNotMatch(points, /studentPointTransaction\.delete/);
});
