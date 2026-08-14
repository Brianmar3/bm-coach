import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { nextRosterIndex, rosterStatusForKey, shouldEnterAdvance } from "../lib/trainer-keyboard-interactions.ts";

const escapeStack = readFileSync(new URL("../lib/trainer-escape-layers.ts", import.meta.url), "utf8");
const payment = readFileSync(new URL("../app/pagos/page.tsx", import.meta.url), "utf8");
const attendance = readFileSync(new URL("../app/asistencias/page.tsx", import.meta.url), "utf8");
const palette = readFileSync(new URL("../componentes/trainer-command-palette.tsx", import.meta.url), "utf8");
const quickAdd = readFileSync(new URL("../componentes/trainer-floating-actions.tsx", import.meta.url), "utf8");

test("Enter sólo avanza en campos editables de una línea", () => {
  assert.equal(shouldEnterAdvance({ tagName: "INPUT", inputType: "text" }), true);
  assert.equal(shouldEnterAdvance({ tagName: "INPUT", inputType: "number" }), true);
  assert.equal(shouldEnterAdvance({ tagName: "SELECT" }), true);
  assert.equal(shouldEnterAdvance({ tagName: "TEXTAREA" }), false);
  assert.equal(shouldEnterAdvance({ tagName: "DIV", isContentEditable: true }), false);
  assert.equal(shouldEnterAdvance({ tagName: "INPUT", inputType: "radio" }), false);
  assert.equal(shouldEnterAdvance({ tagName: "INPUT", inputType: "number", disabled: true }), false);
});

test("Escape usa una pila priorizada y consume una sola capa", () => {
  assert.match(escapeStack, /right\.priority - left\.priority \|\| right\.sequence - left\.sequence/);
  assert.match(escapeStack, /event\.stopImmediatePropagation\(\)/);
  assert.match(escapeStack, /requestAnimationFrame\(\(\) => layer\.restoreFocus/);
  assert.match(palette, /useEscapeLayer\(open, close, \{ priority: 100 \}\)/);
  assert.match(quickAdd, /useEscapeLayer\(open, \(\) => close\(\), \{ priority: 60, triggerRef \}\)/);
});

test("Pago rápido enfoca alumno o importe y Enter no hace submit", () => {
  assert.match(payment, /if \(!form\.studentId\) studentInputRef\.current\?\.focus\(\)/);
  assert.match(payment, /input\[name="payment-amount"\]/);
  assert.match(payment, /onKeyDownCapture=\{handleEnterNavigation\}/);
  assert.match(payment, /data-enter-next="false"/);
  assert.match(payment, /role="dialog"/);
  assert.doesNotMatch(payment, /requestSubmit/);
});

test("Roster recorre alumnos y reutiliza los estados existentes", () => {
  assert.equal(nextRosterIndex(0, "ArrowDown", 3), 1);
  assert.equal(nextRosterIndex(2, "ArrowDown", 3), 2);
  assert.equal(nextRosterIndex(1, "ArrowUp", 3), 0);
  assert.equal(rosterStatusForKey(" "), "presente");
  assert.equal(rosterStatusForKey("a"), "ausente");
  assert.equal(rosterStatusForKey("J"), "justificado");
  assert.match(attendance, /setStatus\(rosterStudents\[index\]\.id, status\)/);
  assert.match(attendance, /event\.target !== event\.currentTarget/);
  assert.match(attendance, /focus-visible:ring-2/);
});
