import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { RANKING_PAGE_HREF, RANKING_SECTION_ID, RANKING_TOP5_HREF, topFiveEntries } from "../lib/ranking-navigation.ts";

test("Top 5 usa el ancla estable de la página real de ranking", () => {
  assert.equal(RANKING_SECTION_ID, "ranking");
  assert.equal(RANKING_PAGE_HREF, "/ranking");
  assert.equal(RANKING_TOP5_HREF, "/ranking#ranking");
  const source = readFileSync(new URL("../componentes/points-ranking.tsx", import.meta.url), "utf8");
  assert.match(source, /id=\{RANKING_SECTION_ID\}/);
  assert.match(source, /href=\{RANKING_TOP5_HREF\}/);
  assert.doesNotMatch(source, /window\.scrollTo/);
});

test("el Dashboard enlaza el Top 3 con la página completa sin sumar controles avanzados", () => {
  const dashboard = readFileSync(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");
  const page = readFileSync(new URL("../app/ranking/page.tsx", import.meta.url), "utf8");
  assert.match(dashboard, /Ver ranking/);
  assert.match(dashboard, /href=\{RANKING_PAGE_HREF\}/);
  assert.doesNotMatch(dashboard, /Recalcular puntos|Últimos 30 días|Histórico/);
  assert.match(page, /<PointsRanking \/>/);
});

test("muestra exactamente cinco alumnos cuando hay más", () => {
  assert.deepEqual(topFiveEntries([1, 2, 3, 4, 5, 6, 7]), [1, 2, 3, 4, 5]);
});

test("si hay menos de cinco muestra todos sin completar espacios", () => {
  assert.deepEqual(topFiveEntries([1, 2, 3]), [1, 2, 3]);
  assert.deepEqual(topFiveEntries([]), []);
});

test("la vista contempla carga, error recuperable y ranking vacío", () => {
  const source = readFileSync(new URL("../componentes/points-ranking.tsx", import.meta.url), "utf8");
  assert.match(source, /Calculando ranking/);
  assert.match(source, /No se pudo cargar el ranking/);
  assert.match(source, /Reintentar/);
  assert.match(source, /Todavía no hay alumnos con puntos para mostrar/);
});

test("las filas muestran posición, foto o avatar, alumno y puntos", () => {
  const source = readFileSync(new URL("../componentes/points-ranking.tsx", import.meta.url), "utf8");
  assert.match(source, /index \+ 1/);
  assert.match(source, /profileImageUrl \|\| DEFAULT_PROFILE_AVATAR\.src/);
  assert.match(source, /student\.studentName/);
  assert.match(source, /student\.total\.toLocaleString/);
});

test("móvil y escritorio comparten destino, permiten volver y respetan el encabezado", () => {
  const source = readFileSync(new URL("../componentes/points-ranking.tsx", import.meta.url), "utf8");
  assert.match(source, /window\.history\.back\(\)/);
  assert.match(source, /← Volver/);
  assert.match(source, /scroll-mt-\[calc\(env\(safe-area-inset-top\)\+6rem\)\]/);
  assert.match(source, /min-w-0/);
});

test("un doble toque no dispara dos navegaciones", () => {
  const source = readFileSync(new URL("../componentes/points-ranking.tsx", import.meta.url), "utf8");
  assert.match(source, /topFiveNavigationLock\.current/);
  assert.match(source, /event\.preventDefault\(\)/);
});

test("el orden y los desempates siguen resueltos por la API existente", () => {
  const source = readFileSync(new URL("../app/api/admin/ranking/route.ts", import.meta.url), "utf8");
  const helper = readFileSync(new URL("../lib/point-ranking.ts", import.meta.url), "utf8");
  assert.match(source, /loadPointRanking/);
  assert.match(helper, /sort/);
  assert.match(helper, /total/);
  assert.match(helper, /studentName/);
});
