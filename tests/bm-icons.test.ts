import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const library = readFileSync(new URL("../componentes/icons/bm-icons.tsx", import.meta.url), "utf8");
const barrel = readFileSync(new URL("../componentes/icons/index.ts", import.meta.url), "utf8");
const settings = readFileSync(new URL("../componentes/settings-icons.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../componentes/portal-shell.tsx", import.meta.url), "utf8");
const profile = readFileSync(new URL("../componentes/student-profile-view.tsx", import.meta.url), "utf8");

test("BM Icons expone una API visual y accesible única", () => {
  assert.match(library, /export type BmIconProps/);
  assert.match(library, /size = 24/);
  assert.match(library, /strokeWidth = 1\.8/);
  assert.match(library, /viewBox="0 0 24 24"/);
  assert.match(library, /fill="none"/);
  assert.match(library, /stroke="currentColor"/);
  assert.match(library, /strokeLinecap="round"/);
  assert.match(library, /strokeLinejoin="round"/);
  assert.match(library, /aria-hidden=\{title \? undefined : true\}/);
  assert.match(library, /\{title && <title>\{title\}<\/title>\}/);
  assert.equal(barrel.trim(), 'export * from "./bm-icons";');
});

test("los nombres públicos de BM Icons son únicos y cubren el catálogo V1", () => {
  const names = [...library.matchAll(/export const (Bm[A-Za-z]+Icon)/g)].map((match) => match[1]);
  assert.equal(names.length, 56);
  assert.equal(new Set(names).size, names.length);
  for (const required of [
    "BmHomeIcon", "BmClassesIcon", "BmRoutineIcon", "BmNutritionIcon", "BmEvaluationIcon",
    "BmSettingsIcon", "BmBellIcon", "BmShieldCheckIcon", "BmLockIcon", "BmSlidersIcon",
    "BmHelpCircleIcon", "BmLogoutIcon", "BmPlusIcon", "BmEditIcon", "BmSearchIcon",
    "BmRankingIcon", "BmPointsIcon", "BmAttendanceIcon", "BmPaymentIcon", "BmTargetIcon",
    "BmTimerIcon", "BmWorkoutIcon", "BmHydrationIcon",
  ]) assert.ok(names.includes(required), `${required} debe estar registrado`);
});

test("Ajustes conserva compatibilidad sin mantener una segunda fuente SVG", () => {
  assert.match(settings, /from "@\/componentes\/icons"/);
  assert.match(settings, /const settingsIcons:/);
  assert.doesNotMatch(settings, /<svg|<path|<circle|<rect/);
});

test("la primera migración usa BM Icons y elimina Unicode de navegación y Perfil", () => {
  for (const icon of ["BmHomeIcon", "BmRoutineIcon", "BmClassesIcon", "BmNutritionIcon", "BmEvaluationIcon"]) {
    assert.match(shell, new RegExp(icon));
  }
  assert.doesNotMatch(shell, /[⌂◫▷◉◇]/);
  for (const icon of ["BmSettingsIcon", "BmUserPlusIcon", "BmEditIcon", "BmPhoneIcon", "BmMailIcon"]) {
    assert.match(profile, new RegExp(icon));
  }
  assert.doesNotMatch(profile, /[☎✉⚙♙✎]/);
});
