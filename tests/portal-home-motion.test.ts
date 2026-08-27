import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const home = readFileSync(new URL("../componentes/portal-section.tsx", import.meta.url), "utf8");
const classes = readFileSync(new URL("../componentes/portal-classes.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../componentes/portal-shell.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const homeStyles = styles.slice(styles.indexOf("@keyframes portal-home-enter"), styles.indexOf("@keyframes portal-ranking-enter"));

test("la Home anima únicamente su contenido y mantiene header y navegación estables", () => {
  assert.match(home, /portal-home-sequence/);
  assert.match(shell, /<main key=\{pathname\}/);
  assert.match(shell, /<nav/);
  assert.doesNotMatch(shell, /portal-home-sequence/);
});

test("los contadores finalizan en valores reales sin alterar los datos", () => {
  assert.match(home, /HomeAnimatedNumber value=\{data\.home\.points\.total\}/);
  assert.match(home, /monthlyAttendancePercentage/);
  assert.match(home, /return reducedMotion \? value : visibleValue/);
  assert.doesNotMatch(home, /points\.total\s*[+*/-]=|monthlyAttendancePercentage\s*[+*/-]=/);
});

test("las animaciones de Home son acotadas y reduced motion elimina movimiento decorativo", () => {
  assert.match(homeStyles, /prefers-reduced-motion: reduce/);
  assert.match(homeStyles, /portal-home-light-sweep/);
  assert.match(homeStyles, /portal-home-points-spark/);
  assert.match(homeStyles, /portal-home-progress-fill/);
  assert.doesNotMatch(homeStyles, /infinite/);
  assert.match(homeStyles, /\.portal-home-enter \{ opacity: 1; transform: none; \}/);
  assert.match(homeStyles, /portal-home-objective-celebration 1100ms/);
  assert.match(homeStyles, /portal-home-objective-icon-pop 900ms/);
  assert.match(homeStyles, /portal-home-objective-celebrating \.portal-home-objective-check/);
});

test("el objetivo semanal es compacto y su celebración no queda en loop", () => {
  assert.match(home, /px-5 py-\[15px\]/);
  assert.match(home, /grid-cols-\[44px_minmax\(0,1fr\)_auto\]/);
  assert.match(home, /className="h-1\.5 overflow-hidden rounded-full bg-zinc-800"/);
  assert.doesNotMatch(homeStyles, /portal-home-objective[^\n]*infinite/);
  assert.match(homeStyles, /prefers-reduced-motion: reduce[\s\S]*portal-home-objective-celebrating/);
});

test("la confirmación visual de asistencia ocurre después de guardar y recargar", () => {
  const saved = classes.indexOf("setNotice(body.message");
  const reloaded = classes.indexOf("await load();", saved);
  const confirmed = classes.indexOf("setConfirmedId(item.id)", saved);
  assert.ok(saved >= 0 && reloaded > saved && confirmed > reloaded);
  assert.match(classes, /value === "GOING"/);
  assert.match(classes, /portal-home-confirmed/);
});

test("los CTA conservan sus rutas y el acceso rápido central conserva su componente", () => {
  assert.match(home, /href="\/portal\/asistencias"/);
  assert.match(home, /href="\/portal\/rutina"/);
  assert.match(home, /href="\/portal\/pagos"/);
  assert.match(home, /href="\/portal\/puntos"/);
  assert.match(shell, /<QuickNoteButton placement="navigation"/);
});

test("la Home premium conserva ornamentos acotados y usa la manzana oficial", () => {
  assert.match(home, /portal-home-focus-lines/);
  assert.match(home, /portal-home-stat/);
  assert.match(styles, /\.portal-home-hero::after/);
  assert.match(styles, /\.portal-home-focus-lines/);
  assert.match(shell, /"\/portal\/nutricion", BmAppleIcon/);
});

test("la Home premium mantiene una densidad compacta en mobile", () => {
  assert.match(home, /space-y-4/);
  assert.match(home, /min-h-\[8rem\]/);
  assert.doesNotMatch(home, /min-h-\[10rem\]/);
  assert.doesNotMatch(home, /sm:min-h-40/);
  assert.match(home, /size-\[92px\]/);
  assert.match(home, /min-\[390px\]:size-24/);
  assert.match(classes, /mt-3 space-y-2/);
  assert.match(classes, /min-h-11 shrink-0/);
});
