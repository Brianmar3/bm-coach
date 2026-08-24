import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Puntos y logros usa datos reales, historial ampliado y BM Icons", () => {
  const portal = read("../componentes/portal-section.tsx");
  const dataRoute = read("../app/api/portal/data/route.ts");
  const pointLoader = read("../lib/student-points.ts");
  const view = portal.slice(
    portal.indexOf("function PointsAndAchievementsView"),
    portal.indexOf("function ComparativeEvaluationsView"),
  );

  assert.match(view, /fetch\("\/api\/portal\/ranking"/);
  assert.match(view, /ranking\.ranking\.slice\(0, 3\)/);
  assert.match(view, /points\.recent\.filter/);
  assert.match(view, /movement\.occurredAt/);
  assert.match(view, /achievement\.category/);
  assert.match(view, /BmRankingIcon|BmPointsIcon|BmTrophyIcon/);
  assert.doesNotMatch(view, /Caro Gorgo|Arlu Schmunk|Brian Martinez|90 puntos|27 este mes/);
  assert.match(dataRoute, /section === "puntos" \? 40 : 8/);
  assert.match(pointLoader, /recentLimit = 8/);
  assert.match(pointLoader, /take: recentLimit/);
});

test("Puntos y logros conserva navegación completa y movimiento reducido", () => {
  const portal = read("../componentes/portal-section.tsx");
  const css = read("../app/globals.css");
  const view = portal.slice(
    portal.indexOf("function PointsAndAchievementsView"),
    portal.indexOf("function ComparativeEvaluationsView"),
  );

  for (const target of ["#puntos", "#ranking-mensual", "#logros", "#historial-puntos"]) {
    assert.match(view, new RegExp(`href="${target}"`));
  }
  assert.match(view, /pb-\[calc\(1rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(css, /@keyframes portal-points-enter/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.portal-points-enter/);
  assert.doesNotMatch(view, /fixed inset-0|role="dialog"|max-h-\[/);
});
