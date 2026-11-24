import assert from "node:assert/strict";
import test from "node:test";
import { listShortcut, separatorShortcut } from "../lib/class-writing-shortcuts.ts";
import { classRichPlainText, decodeClassRichText, encodeClassRichText } from "../lib/class-rich-text.ts";

test("los prefijos al comienzo del párrafo activan listas", () => {
  assert.deepEqual(listShortcut("*"), { kind: "bullet" });
  assert.deepEqual(listShortcut("-"), { kind: "bullet" });
  assert.deepEqual(listShortcut("1."), { kind: "ordered", start: 1 });
  assert.deepEqual(listShortcut("7-"), { kind: "ordered", start: 7 });
  for (const text of ["peso *", "10-12", "3x12", "20/11/2026", "  -", "1. ejercicio"]) assert.equal(listShortcut(text), null);
});

test("el separador exige tres guiones solos y persiste en texto enriquecido", () => {
  assert.equal(separatorShortcut("---", ""), true);
  assert.equal(separatorShortcut("---", "texto"), false);
  assert.equal(separatorShortcut("peso ---", ""), false);
  const value = encodeClassRichText([{ t: "p", c: [{ t: "text", x: "Inicio" }] }, { t: "hr", c: [] }, { t: "ol", n: 7, c: [{ t: "li", c: [{ t: "text", x: "Sigue" }] }] }]);
  assert.ok(decodeClassRichText(value));
  assert.equal(classRichPlainText(value), "Inicio\n---\n7. Sigue");
});
