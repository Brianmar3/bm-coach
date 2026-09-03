import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("el selector mensual queda sticky respecto del viewport y no de un wrapper recortado", () => {
  const page = read("app/resumen-mensual/page.tsx");
  const frame = read("componentes/app-frame.tsx");
  const css = read("app/globals.css");

  assert.match(page, /sticky top-\[calc\(env\(safe-area-inset-top\)\+4\.5rem\)\] z-20/);
  assert.match(frame, /pathname === "\/resumen-mensual"/);
  assert.match(frame, /admin-panel--viewport-sticky/);
  assert.match(css, /\.admin-panel\.admin-panel--viewport-sticky\s*\{\s*overflow-x: visible;/);
});

test("el bloque sticky sigue en el contenedor que incluye todas las secciones del resumen", () => {
  const page = read("app/resumen-mensual/page.tsx");
  assert.ok(page.indexOf("sticky top-") < page.indexOf("<TodayCollections"));
  assert.ok(page.indexOf("sticky top-") < page.indexOf("CSV detalle"));
  assert.doesNotMatch(page, /sticky[^\n]*overflow-y-(?:auto|scroll)/);
});
