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
  const triggerStyles = quickLog.slice(quickLog.indexOf("const className"), quickLog.indexOf("type QuickCategory"));
  assert.doesNotMatch(triggerStyles, /\bfixed\b/);
});

test("Mixto conserva su navegación y enlaza al mismo historial desde Clases", () => {
  assert.match(classesPage, /serviceType === "MIXED"/);
  assert.match(classesPage, /showQuickLogAction=/);
  assert.match(classes, /showQuickLogAction && <QuickNoteButton placement="inline"/);
  assert.match(quickLog, /href="\/portal\/registro"/);
});

test("el acceso integrado es táctil, accesible y no depende de offsets del Home", () => {
  assert.match(quickLog, /aria-label="Abrir mis registros"/);
  assert.match(quickLog, /h-14 w-14 aspect-square/);
  assert.match(quickLog, /rounded-full/);
  assert.match(quickLog, /-translate-y-2/);
  assert.match(quickLog, /focus-visible:ring-2/);
  const navigationStyle = quickLog.slice(quickLog.indexOf('placement === "navigation"'), quickLog.indexOf('    : "inline-flex'));
  assert.doesNotMatch(navigationStyle, /\bfixed\b|bottom-\[|right-/);
});

test("Registro rápido se crea dentro de Mis registros sin overlay", () => {
  assert.match(quickLog, /creating \? <GuidedQuickLogForm/);
  assert.match(quickLog, /mt-5 overflow-hidden rounded-3xl/);
  assert.doesNotMatch(quickLog, /quick-log-sheet|fixed inset-0 z-\[70\]|overflow-y-auto overscroll-contain/);
});

test("el acceso central navega sin montar el formulario sobre la pantalla actual", () => {
  const trigger = quickLog.slice(quickLog.indexOf("export function QuickNoteButton"), quickLog.indexOf("type QuickCategory"));
  assert.match(trigger, /<Link href="\/portal\/registro"/);
  assert.doesNotMatch(trigger, /useState|GuidedQuickLogForm|setOpen/);
});

test("las opciones actuales son genéricas y no cargan asistencia de clase", () => {
  assert.match(quickLog, /"strength", "circuit", "other"/);
  assert.doesNotMatch(quickLog, /ClassAttendance|asistencia presencial|clase presencial/i);
});
