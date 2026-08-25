import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Puntos y logros deja ranking e historial únicamente en sus páginas", () => {
  const portal = read("../componentes/portal-section.tsx");
  const main = portal.slice(
    portal.indexOf("function PointsAndAchievementsView"),
    portal.indexOf("const reducedMotionQuery"),
  );
  const summary = portal.slice(portal.indexOf("function PointsSummary"), portal.indexOf("function PointsAndAchievementsView"));

  assert.match(main, /<PointsSummary data=\{data\} ranking=\{ranking\} \/>/);
  assert.match(main, /<WeeklyMissionAchievement data=\{data\} \/>/);
  assert.match(main, /<AchievementsOverview data=\{data\} \/>/);
  assert.doesNotMatch(main, /<RankingPreview|<PointsHistory|ranking\.ranking\.slice\(0, 3\)|historial-puntos|ranking-mensual/);
  assert.match(summary, /href="\/portal\/ranking"/);
  assert.match(summary, /href="\/portal\/puntos\/historial"/);
  assert.match(summary, /Ver ranking/);
  assert.match(summary, /Ver historial/);
  assert.doesNotMatch(main, /Secciones de Puntos y logros|grid-cols-4/);
});

test("Historial usa una ruta normal, movimientos reales, filtros y BM Icons", () => {
  const portal = read("../componentes/portal-section.tsx");
  const dataRoute = read("../app/api/portal/data/route.ts");
  const pointLoader = read("../lib/student-points.ts");
  const history = portal.slice(portal.indexOf("function PointsHistoryPageView"), portal.indexOf("function ComparativeEvaluationsView"));
  const routeUrl = new URL("../app/portal/(student)/puntos/historial/page.tsx", import.meta.url);

  assert.equal(existsSync(routeUrl), true);
  assert.match(read("../app/portal/(student)/puntos/historial/page.tsx"), /section="puntos-historial"/);
  assert.match(history, /href="\/portal\/puntos"/);
  assert.match(history, /points\.recent\.filter/);
  assert.match(history, /movement\.occurredAt/);
  assert.match(history, /Todos/);
  assert.match(history, /Clases/);
  assert.match(history, /Pagos/);
  assert.match(history, /Logros/);
  assert.match(history, /Desafíos/);
  assert.match(portal, /function movementIcon[\s\S]*BmAttendanceIcon[\s\S]*BmPaymentIcon[\s\S]*BmTrophyIcon[\s\S]*BmChallengeIcon/);
  assert.doesNotMatch(history, /fixed inset-0|role="dialog"|max-h-\[/);
  assert.match(dataRoute, /section === "puntos-historial" \? 40 : 8/);
  assert.match(pointLoader, /recentLimit = 8/);
  assert.match(pointLoader, /take: recentLimit/);
});

test("Ranking premium conserva su página y vuelve a Puntos y logros", () => {
  const ranking = read("../componentes/portal-ranking.tsx");
  const page = read("../app/portal/(student)/ranking/page.tsx");

  assert.match(page, /<PortalRanking/);
  assert.match(ranking, /fetch\("\/api\/portal\/ranking"/);
  assert.match(ranking, /href="\/portal\/puntos"/);
  assert.match(ranking, /FEATURED_RANKING_SIZE = 5/);
  assert.match(ranking, /pinnedCurrent/);
});
