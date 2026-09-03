import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("componentes/portal-section.tsx", "utf8");
const hero = source.slice(source.indexOf('className="portal-home-enter portal-home-hero'), source.indexOf("<PortalEventAnnouncement"));

test("el hero móvil reduce sólo altura y espaciado manteniendo su escala desktop", () => {
  assert.match(hero, /px-5 py-4/);
  assert.match(hero, /min-h-\[7rem\] sm:min-h-\[9rem\]/);
  assert.match(hero, /className="mt-4 text-\[clamp\(1\.85rem,8vw,3\.15rem\)\]/);
  assert.match(hero, /sm:p-8/);
  assert.match(hero, /sm:mt-7/);
});

test("el mismo hero conserva contenido y variantes CLASSES, PERSONALIZED y MIXED", () => {
  assert.match(hero, /BmCalendarIcon/);
  assert.match(hero, /¡Hola,/);
  assert.match(hero, /Hoy avanzás una parte más de tu plan\./);
  assert.match(hero, /Vamos por un día más de progreso\./);
  assert.match(hero, /groupClassesEnabled/);
});
