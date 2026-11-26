/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const test = require("node:test");
const Module = require("node:module");
const path = require("node:path");
const fs = require("node:fs");
const ts = require("typescript");
const { JSDOM } = require("jsdom");

const root = path.resolve(__dirname, "..");
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  return originalResolve.call(this, request.startsWith("@/") ? path.join(root, request.slice(2)) : request, parent, ...rest);
};
for (const extension of [".ts", ".tsx"]) require.extensions[extension] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
};

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
Object.assign(global, { window: dom.window, document: dom.window.document, Node: dom.window.Node, Element: dom.window.Element, HTMLElement: dom.window.HTMLElement, HTMLOListElement: dom.window.HTMLOListElement, NodeFilter: dom.window.NodeFilter });
window.matchMedia = () => ({ matches: false });
global.requestAnimationFrame = (callback) => setTimeout(callback, 0);
global.cancelAnimationFrame = clearTimeout;
document.execCommand = (command, _ui, text) => {
  if (command !== "insertText") return true;
  const selection = window.getSelection();
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node); range.collapse(true);
  selection.removeAllRanges(); selection.addRange(range);
  return true;
};
const React = require("react");
const { render, fireEvent, cleanup } = require("@testing-library/react");
const { ClassNotesEditor } = require("../componentes/class-notes-editor.tsx");

test("el atajo de teclado crea una lista, conserva el cursor y permite deshacer", () => {
  let value = "*";
  const screen = render(React.createElement(ClassNotesEditor, { value, onChange: (next) => { value = next; }, disabled: false }));
  const editor = screen.getByRole("textbox", { name: "Tu clase" });
  const range = document.createRange(); range.selectNodeContents(editor.firstElementChild); range.collapse(false);
  const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
  fireEvent.keyDown(editor, { key: " " });
  assert.ok(editor.querySelector("ul > li"));
  assert.ok(editor.querySelector("li")?.contains(selection.anchorNode));
  fireEvent.keyDown(editor, { key: "z", ctrlKey: true });
  assert.equal(editor.textContent, "* ");
  assert.ok(value);
  cleanup();
});

test("la entrada móvil por input crea lista y Enter crea separador", () => {
  window.matchMedia = () => ({ matches: true });
  const screen = render(React.createElement(ClassNotesEditor, { value: "1-", onChange: () => {}, disabled: false }));
  const editor = screen.getByRole("textbox", { name: "Tu clase" });
  const range = document.createRange(); range.selectNodeContents(editor.firstElementChild); range.collapse(false);
  const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
  document.execCommand("insertText", false, " ");
  fireEvent.input(editor, { inputType: "insertText", data: " " });
  assert.equal(editor.querySelector("ol")?.start, 1);
  fireEvent.keyDown(editor, { key: "z", ctrlKey: true });
  assert.equal(editor.textContent, "1- ");
  cleanup();

  const separatorScreen = render(React.createElement(ClassNotesEditor, { value: "---", onChange: () => {}, disabled: false }));
  const separatorEditor = separatorScreen.getByRole("textbox", { name: "Tu clase" });
  const separatorRange = document.createRange(); separatorRange.selectNodeContents(separatorEditor.firstElementChild); separatorRange.collapse(false);
  selection.removeAllRanges(); selection.addRange(separatorRange);
  fireEvent.keyDown(separatorEditor, { key: "Enter" });
  assert.ok(separatorEditor.querySelector("hr"));
  assert.equal(selection.anchorNode?.parentElement?.tagName, "DIV");
  cleanup();
});

test("título por espacio conserva el cursor y se puede deshacer", () => {
  const screen = render(React.createElement(ClassNotesEditor, { value: "##", onChange: () => {}, disabled: false }));
  const editor = screen.getByRole("textbox", { name: "Tu clase" });
  const range = document.createRange(); range.selectNodeContents(editor.firstElementChild); range.collapse(false);
  const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
  fireEvent.keyDown(editor, { key: " " });
  assert.ok(editor.querySelector("h2"));
  assert.ok(editor.querySelector("h2")?.contains(selection.anchorNode));
  fireEvent.keyDown(editor, { key: "z", ctrlKey: true });
  assert.equal(editor.textContent, "## ");
  cleanup();
});

test("Ctrl+S usa el guardado existente sin alterar el texto", () => {
  let saves = 0;
  const screen = render(React.createElement(ClassNotesEditor, { value: "Clase", onChange: () => {}, disabled: false, onSave: () => { saves++; } }));
  const editor = screen.getByRole("textbox", { name: "Tu clase" });
  fireEvent.keyDown(editor, { key: "s", ctrlKey: true });
  assert.equal(saves, 1);
  assert.equal(editor.textContent, "Clase");
  cleanup();
});

test("la entrada móvil convierte una cita y permite deshacer", () => {
  window.matchMedia = () => ({ matches: true });
  const screen = render(React.createElement(ClassNotesEditor, { value: ">", onChange: () => {}, disabled: false }));
  const editor = screen.getByRole("textbox", { name: "Tu clase" });
  const selection = window.getSelection();
  const range = document.createRange(); range.selectNodeContents(editor.firstElementChild); range.collapse(false);
  selection.removeAllRanges(); selection.addRange(range);
  document.execCommand("insertText", false, " ");
  fireEvent.input(editor, { inputType: "insertText", data: " " });
  assert.ok(editor.querySelector("blockquote"));
  fireEvent.keyDown(editor, { key: "z", ctrlKey: true });
  assert.equal(editor.textContent, "> ");
  cleanup();
});

test("los atajos de formato y salto suave usan los comandos del editor", () => {
  const commands = [];
  const original = document.execCommand;
  document.execCommand = (command, ui, text) => { commands.push(command); return original(command, ui, text); };
  try {
    const screen = render(React.createElement(ClassNotesEditor, { value: "Clase", onChange: () => {}, disabled: false }));
    const editor = screen.getByRole("textbox", { name: "Tu clase" });
    const selection = window.getSelection();
    const range = document.createRange(); range.selectNodeContents(editor.firstElementChild); range.collapse(false);
    selection.removeAllRanges(); selection.addRange(range);
    for (const key of ["b", "i", "u"]) fireEvent.keyDown(editor, { key, ctrlKey: true });
    fireEvent.keyDown(editor, { key: "Enter", shiftKey: true });
    assert.deepEqual(commands, ["bold", "italic", "underline", "insertLineBreak"]);
    cleanup();
  } finally { document.execCommand = original; }
});
