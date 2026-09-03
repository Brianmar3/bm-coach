import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("componentes/portal-section.tsx", "utf8");
const hero = source.slice(source.indexOf('className="portal-home-enter portal-home-hero'), source.indexOf("function eventDateLabel"));
const attendance = source.slice(source.indexOf("function MonthlyAttendanceIndicator"), source.indexOf("function AchievementsOverview"));

test("CLASSES y MIXED reservan altura suficiente sin descompactar PERSONALIZED", () => {
  assert.match(hero, /groupClassesEnabled && !routineFocused \? "min-h-\[7\.5rem\]/);
  assert.match(hero, /: "min-h-\[7rem\] sm:min-h-\[9rem\]"/);
  assert.match(hero, /px-5 py-4/);
});

test("el indicador móvil entra completo dentro del hero", () => {
  assert.match(attendance, /size-\[82px\]/);
  assert.match(attendance, /min-\[390px\]:size-\[86px\]/);
  assert.match(attendance, /gap-1/);
  assert.match(attendance, /leading-none text-yellow-300/);
  assert.match(attendance, /sm:size-\[6\.5rem\]/);
});
