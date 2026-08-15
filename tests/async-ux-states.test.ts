import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const states = read("componentes/async-states.tsx");
const progress = read("componentes/portal-progress.tsx");
const followUp = read("componentes/routine-follow-up-dashboard.tsx");
const library = read("componentes/training-library-blocks.tsx");
const students = read("app/alumnos/page.tsx");
const payments = read("app/pagos/page.tsx");
const classes = read("app/clases/page.tsx");

test("los estados reutilizables son accesibles y ofrecen reintento", () => {
  assert.match(states, /role="alert"/);
  assert.match(states, /Reintentar/);
  assert.match(states, /aria-hidden="true"/);
  assert.match(states, /animate-pulse/);
});

test("Mi progreso y Seguimiento no muestran KPI falsos durante la carga", () => {
  assert.match(progress, /aria-busy="true"/);
  assert.match(followUp, /loading && students\.length === 0 \? <CardGridSkeleton/);
  assert.match(followUp, /ListSkeleton rows=\{5\}/);
  assert.match(followUp, /No pudimos cargar el seguimiento/);
  assert.match(followUp, /detailError/);
});

test("Biblioteca conserva contenido previo y distingue vacíos", () => {
  assert.match(library, /loadError && blocks\.length === 0/);
  assert.match(library, /loadError && <div className="mb-3">/);
  assert.match(library, /No encontramos resultados con estos filtros/);
  assert.match(library, /No tenés bloques favoritos/);
  assert.match(library, /ListSkeleton rows=\{4\}/);
  assert.doesNotMatch(library, /window\.alert/);
});

test("Alumnos, Pagos y Clases tienen fallos de carga recuperables", () => {
  for (const source of [students, payments, classes]) {
    assert.match(source, /retryLoad/);
    assert.match(source, /setReload/);
    assert.match(source, /ErrorState/);
  }
  assert.match(students, /ListSkeleton rows=\{6\}/);
  assert.match(students, /Todavía no tenés alumnos/);
  assert.match(students, /No encontramos alumnos con estos filtros/);
  assert.match(classes, /Todavía no hay horarios semanales/);
  assert.match(classes, /animate-pulse/);
  assert.match(payments, /Seguís viendo la última información disponible/);
});
