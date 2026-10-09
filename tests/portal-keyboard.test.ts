import assert from "node:assert/strict";
import test from "node:test";
import { portalKeyboardIsOpen } from "../lib/portal-keyboard.ts";

const mobile = { mobile: true, editable: true, wasOpen: false, baselineHeight: 844, layoutHeight: 844, viewportHeight: 844, scale: 1 };
test("focus solo y barra del navegador no ocultan la navegación", () => {
  assert.equal(portalKeyboardIsOpen(mobile), false);
  assert.equal(portalKeyboardIsOpen({ ...mobile, viewportHeight: 760 }), false);
});
test("teclado visual viewport y Android adjustResize se detectan", () => {
  assert.equal(portalKeyboardIsOpen({ ...mobile, viewportHeight: 500 }), true);
  assert.equal(portalKeyboardIsOpen({ ...mobile, layoutHeight: 500, viewportHeight: 500 }), true);
});
test("cambiar campos o perder foco durante el cierre no hace parpadear nav", () => {
  assert.equal(portalKeyboardIsOpen({ ...mobile, wasOpen: true, editable: false, viewportHeight: 500 }), true);
  assert.equal(portalKeyboardIsOpen({ ...mobile, wasOpen: true, viewportHeight: 844 }), false);
});
test("desktop, resize sin foco y zoom no se confunden con teclado", () => {
  assert.equal(portalKeyboardIsOpen({ ...mobile, mobile: false, viewportHeight: 400 }), false);
  assert.equal(portalKeyboardIsOpen({ ...mobile, editable: false, viewportHeight: 400 }), false);
  assert.equal(portalKeyboardIsOpen({ ...mobile, scale: 2, viewportHeight: 400 }), false);
});
test("orientación horizontal usa un umbral válido para pantallas bajas", () => {
  assert.equal(portalKeyboardIsOpen({ ...mobile, baselineHeight: 390, layoutHeight: 390, viewportHeight: 200 }), true);
  assert.equal(portalKeyboardIsOpen({ ...mobile, baselineHeight: 390, layoutHeight: 390, viewportHeight: 390 }), false);
});
