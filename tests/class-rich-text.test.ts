import assert from "node:assert/strict";
import test from "node:test";
import { classRichPlainText, decodeClassRichText, encodeClassRichText } from "../lib/class-rich-text.ts";
import { continueNumberedList } from "../lib/class-note-numbering.ts";

test("las clases anteriores conservan saltos y numeración literal", () => {
  const legacy = "MOVILIDAD\n\n1- Plancha frontal\n2- Dead bug";
  assert.equal(decodeClassRichText(legacy), null);
  assert.equal(classRichPlainText(legacy), legacy);
  assert.equal(continueNumberedList("1- Plancha frontal", "1- Plancha frontal".length, "1- Plancha frontal".length)?.text, "1- Plancha frontal\n2- ");
  assert.equal(continueNumberedList("1. Plancha frontal", "1. Plancha frontal".length, "1. Plancha frontal".length)?.text, "1. Plancha frontal\n2. ");
});

test("el formato permitido conserva títulos, listas, estilo y alineación", () => {
  const saved = encodeClassRichText([
    { t: "h2", c: [{ t: "text", x: "FUERZA" }], a: "center" },
    { t: "ol", c: [{ t: "li", c: [{ t: "strong", c: [{ t: "text", x: "Press con barra" }] }] }] },
  ]);
  assert.equal(decodeClassRichText(saved)?.[0]?.t, "h2");
  assert.equal(classRichPlainText(saved), "FUERZA\n1. Press con barra");
});

test("un documento no permitido no se interpreta como formato ejecutable", () => {
  const unknown = "BM_CLASS_RICH_V1:" + JSON.stringify([{ t: "script", c: [{ t: "text", x: "alert(1)" }] }]);
  assert.equal(decodeClassRichText(unknown), null);
  assert.equal(classRichPlainText(unknown), unknown);
});
