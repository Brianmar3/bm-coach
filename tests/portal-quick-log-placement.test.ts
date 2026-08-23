import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const shell = readFileSync(new URL("../componentes/portal-shell.tsx", import.meta.url), "utf8");
const home = readFileSync(new URL("../componentes/portal-section.tsx", import.meta.url), "utf8");
const classes = readFileSync(new URL("../componentes/portal-classes.tsx", import.meta.url), "utf8");
const classesPage = readFileSync(new URL("../app/portal/(student)/clases/page.tsx", import.meta.url), "utf8");
const quickLog = readFileSync(new URL("../componentes/quick-log.tsx", import.meta.url), "utf8");

test("Clases y Personalizado integran Registro rápido en la navegación sin FAB en Inicio", () => {
  assert.match(shell, /serviceType !== "MIXED"/);
  assert.match(shell, /<QuickNoteButton placement="navigation"/);
  assert.match(shell, /links\.length \+ \(showNavigationQuickLog \? 1 : 0\)/);
  assert.doesNotMatch(home, /QuickNoteButton/);
  assert.doesNotMatch(shell, /portal-quick-note-bottom/);
  const triggerStyles = quickLog.slice(quickLog.indexOf("const className"), quickLog.indexOf("return <>"));
  assert.doesNotMatch(triggerStyles, /\bfixed\b/);
});

test("Mixto conserva su navegación y abre el mismo flujo desde Clases", () => {
  assert.match(classesPage, /serviceType === "MIXED"/);
  assert.match(classesPage, /showQuickLogAction=/);
  assert.match(classes, /showQuickLogAction && <QuickNoteButton placement="inline"/);
  assert.equal((quickLog.match(/function GuidedQuickLogForm/g) ?? []).length, 1);
});

test("el acceso integrado es táctil, accesible y no depende de offsets del Home", () => {
  assert.match(quickLog, /aria-label="Abrir registro rápido"/);
  assert.match(quickLog, /min-h-11 min-w-11/);
  assert.match(quickLog, /focus-visible:ring-2/);
  const navigationStyle = quickLog.slice(quickLog.indexOf('placement === "navigation"'), quickLog.indexOf('    : "inline-flex'));
  assert.doesNotMatch(navigationStyle, /\bfixed\b|bottom-\[|right-/);
});

test("las opciones actuales son genéricas y no cargan asistencia de clase", () => {
  assert.match(quickLog, /"strength", "circuit", "other"/);
  assert.doesNotMatch(quickLog, /ClassAttendance|asistencia presencial|clase presencial/i);
});
