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
