import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { appendNormalizedLibraryTags } from "../lib/training-library.ts";

const component = readFileSync(new URL("../componentes/training-tag-input.tsx", import.meta.url), "utf8");
const keyboard = readFileSync(new URL("../componentes/use-routine-keyboard-navigation.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/rutinas/page.tsx", import.meta.url), "utf8");

test("Enter confirma un tag y conserva los espacios internos", () => {
  assert.deepEqual(appendNormalizedLibraryTags([], "Full body"), ["Full body"]);
  assert.deepEqual(appendNormalizedLibraryTags([], "Tren inferior"), ["Tren inferior"]);
  assert.match(component, /event\.key === "Enter" && draft\.trim\(\)/);
  assert.match(component, /event\.preventDefault\(\)/);
  assert.match(component, /event\.stopPropagation\(\)/);
});

test("coma y pegado separan tags sin separar por espacios", () => {
  assert.deepEqual(appendNormalizedLibraryTags([], "full body, metabólico, tren inferior"), ["full body", "metabólico", "tren inferior"]);
  assert.match(component, /event\.key === ","/);
  assert.match(component, /onPaste=\{handlePaste\}/);
  assert.doesNotMatch(component, /split\(" "\)/);
});

test("duplicados semánticos usan la normalización única de Biblioteca", () => {
  assert.deepEqual(appendNormalizedLibraryTags([], "Core, core, CORE"), ["Core"]);
  assert.deepEqual(appendNormalizedLibraryTags(["Técnica"], " tecnica , TÉCNICA"), ["Técnica"]);
});

test("texto vacío no crea tags y se aplica trim", () => {
  assert.deepEqual(appendNormalizedLibraryTags([], " ,   ,"), []);
  assert.deepEqual(appendNormalizedLibraryTags([], "  Full body  "), ["Full body"]);
});

test("Backspace y el botón accesible eliminan una sola etiqueta", () => {
  assert.match(component, /event\.key === "Backspace" && !draft && value\.length/);
  assert.match(component, /remove\(value\.length - 1\)/);
  assert.match(component, /value\.filter\(\(_, currentIndex\) => currentIndex !== index\)/);
  assert.match(component, /aria-label=\{`Quitar etiqueta \$\{tag\}`\}/);
  assert.match(component, /type="button"/);
});

test("Tab confirma el pendiente sin impedir la navegación nativa", () => {
  const tabBranch = component.slice(component.indexOf('event.key === "Tab"'), component.indexOf('event.key === "Backspace"'));
  assert.match(tabBranch, /commit\(\)/);
  assert.doesNotMatch(tabBranch, /preventDefault/);
});

test("Enter con texto se consume antes de la navegación global y vacío puede avanzar", () => {
  assert.match(component, /data-enter-next="tag-input"/);
  assert.match(keyboard, /target\.dataset\.enterNext === "tag-input" && target\.value\.trim\(\)/);
  assert.doesNotMatch(keyboard, /target\.dataset\.enterNext === "tag-input"\) return/);
});

test("Clase completa y ambos flujos de Bloques comparten TrainingTagInput", () => {
  assert.equal((page.match(/<TrainingTagInput /g) ?? []).length, 2);
  assert.match(page, /value=\{visibleClassTags\(form\.tags\)\}/);
  assert.match(page, /classTagsWithType\(tags, classType\)/);
  assert.match(page, /tags: libraryTags/);
  assert.doesNotMatch(page.slice(page.indexOf("function ClassTemplateEditor"), page.indexOf("function RoutineEditor")), /value=\{form\.tags\}/);
});

test("el layout permite wrap sin scroll horizontal obligatorio", () => {
  assert.match(component, /flex-wrap/);
  assert.match(component, /max-w-full/);
  assert.match(component, /min-w-0/);
  assert.match(component, /flex-\[1_1_9rem\]/);
  assert.doesNotMatch(component, /overflow-x-auto|whitespace-nowrap/);
});
