import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { JSDOM } from "jsdom";

const require = createRequire(import.meta.url);
const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true, url: "https://bm.test" });
for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "HTMLInputElement", "HTMLSelectElement", "HTMLTextAreaElement", "HTMLButtonElement", "KeyboardEvent", "MouseEvent", "PointerEvent", "Event", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"]) {
  Object.defineProperty(globalThis, key, { configurable: true, value: typeof dom.window[key] === "function" && ["getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"].includes(key) ? dom.window[key].bind(dom.window) : dom.window[key] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// JSDOM has no layout. Model only visibility; keyboard events/focus/React run for real.
dom.window.HTMLElement.prototype.getClientRects = function () {
  if (this.closest('[hidden], [inert], [style*="display: none"]')) return [];
  return [{ top: 0, bottom: 40, left: 0, right: 200, width: 200, height: 40 }];
};
const React = require("react");
const { render, screen, cleanup, fireEvent, act } = require("@testing-library/react");
const userEvent = require("@testing-library/user-event").default;
const ts = require("typescript");
const modules = new Map();
function sourceModule(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const record = { exports: {} }; modules.set(file, record);
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const localRequire = (name) => {
    if (name === "next/navigation") return { usePathname: () => "/dashboard", useRouter: () => ({ push() {}, replace() {}, refresh() {} }) };
    if (!name.startsWith("@/") && !name.startsWith(".")) return require(name);
    const base = name.startsWith("@/") ? path.resolve(name.slice(2)) : path.resolve(path.dirname(file), name);
    const resolved = [base, `${base}.ts`, `${base}.tsx`].find(existsSync);
    if (!resolved) throw new Error(`Missing test import ${name}`);
    return sourceModule(resolved);
  };
  new Function("require", "module", "exports", code)(localRequire, record, record.exports);
  return record.exports;
}
const { useComboboxNavigation } = sourceModule("componentes/use-combobox-navigation.ts");
const { KeyboardDialog } = sourceModule("componentes/keyboard-dialog.tsx");
const { KeyboardMenu } = sourceModule("componentes/keyboard-menu.tsx");
const { KeyboardResults } = sourceModule("componentes/keyboard-results.tsx");
const { StudentAssignmentOptions } = sourceModule("componentes/student-assignment-options.tsx");
const { useRoutineKeyboardNavigation } = sourceModule("componentes/use-routine-keyboard-navigation.ts");
const { SearchWithFilters } = sourceModule("componentes/search-with-filters.tsx");
const { useEscapeLayer } = sourceModule("componentes/use-trainer-keyboard-interactions.ts");
const h = React.createElement;
const all = [{ id: "ana", name: "Ana" }, { id: "disabled", name: "No disponible", disabled: true }, { id: "bruno", name: "Bruno" }, { id: "carla", name: "Carla" }];
const user = () => userEvent.setup({ document: dom.window.document });
const frame = () => act(() => new Promise(resolve => setTimeout(resolve, 35)));
afterEach(() => cleanup());

const { KeyboardTabs } = sourceModule("componentes/keyboard-tabs.tsx");
const { default: BodyMapModal } = sourceModule("componentes/body-map.tsx");
const { RoutineDuplicatesReview } = sourceModule("componentes/routine-duplicates-review.tsx");

test("pestañas: flechas horizontales, extremos, deshabilitados y Tab conservan el patrón ARIA", async () => {
  function Tabs() {
    const [selected, setSelected] = React.useState("Uno");
    return h(React.Fragment, null, h(KeyboardTabs, { "aria-label": "Vistas" }, ["Uno", "Bloqueado", "Tres"].map(name => h("button", { key: name, type: "button", role: "tab", disabled: name === "Bloqueado", "aria-selected": selected === name, tabIndex: selected === name ? 0 : -1, onClick: () => setSelected(name) }, name))), h("button", null, "Después"));
  }
  render(h(Tabs));
  const tablist = screen.getByRole("tablist");
  tablist.getBoundingClientRect = () => ({ left: 0, right: 200 });
  screen.getByRole("tab", { name: "Tres" }).getBoundingClientRect = () => ({ left: 300, right: 400 });
  await user().tab();
  await user().keyboard("{ArrowRight}"); assert.equal(document.activeElement.textContent, "Tres");
  assert.equal(tablist.scrollLeft, 200);
  assert.equal(document.activeElement.getAttribute("aria-selected"), "true");
  assert.equal(fireEvent.keyDown(document.activeElement, { key: "ArrowDown" }), true);
  await user().keyboard("{Home}{End}"); assert.equal(document.activeElement.textContent, "Tres");
  await user().tab(); assert.equal(document.activeElement.textContent, "Después");
});

test("mapa corporal real: cambiar vistas, conservar datos en texto y restaurar foco", async () => {
  function Map() { const [open, setOpen] = React.useState(false); return h(React.Fragment, null, h("button", { onClick: () => setOpen(true) }, "Ver mapa"), h(BodyMapModal, { open, onClose: () => setOpen(false), weekly: [{ muscleGroup: "Pecho", series: 6, percentage: 100 }] })); }
  render(h(Map)); const trigger = screen.getByRole("button", { name: "Ver mapa" }); await user().click(trigger); await frame();
  assert.equal(document.activeElement.getAttribute("aria-label"), "Cerrar mapa corporal");
  await user().tab(); assert.equal(document.activeElement.textContent, "Vista anterior");
  await user().keyboard("{ArrowRight}"); assert.equal(screen.getByRole("tab", { selected: true }).textContent, "Vista posterior");
  assert.ok(screen.getByText("Pecho"));
  await user().keyboard("{Escape}"); await frame(); assert.equal(screen.queryByRole("dialog"), null); assert.equal(document.activeElement, trigger);
});

test("duplicados reales: confirmar recibe foco en Cancelar, Escape cierra sólo confirmación y restaura origen", async () => {
  const previousFetch = globalThis.fetch; const requests = [];
  const routine = { name: "Fuerza", status: "BORRADOR", createdAt: "2026-10-01", updatedAt: "2026-10-01", students: [], dayCount: 1, blockCount: 1, exerciseCount: 1, sessionCount: 0, versionCount: 1, lastSessionAt: "", safeToDelete: true, riskReasons: [] };
  globalThis.fetch = async (url, options) => { requests.push(options?.method ?? "GET"); return { ok: true, json: async () => ({ groups: [{ id: "group", objective: "Fuerza", routines: [{ ...routine, id: "first" }, { ...routine, id: "second" }] }] }) }; };
  try {
    render(h(RoutineDuplicatesReview, { close: () => {}, onDeleted: () => {}, onArchived: () => {} })); await frame();
    const trigger = screen.getByRole("button", { name: "Eliminar rutina" }); await user().click(trigger); await frame();
    assert.equal(document.activeElement.textContent, "Cancelar");
    await user().tab({ shift: true }); assert.equal(document.activeElement.textContent, "Eliminar definitivamente");
    await user().keyboard("{Escape}"); await frame(); assert.equal(screen.queryByRole("alertdialog"), null);
    assert.ok(screen.getByRole("dialog")); assert.equal(document.activeElement, trigger); assert.deepEqual(requests, ["GET"]);
  } finally { globalThis.fetch = previousFetch; }
});

test("diálogo no modal permite salir con Tab; el diálogo nativo conserva Escape", async () => {
  let closed = 0;
  render(h(React.Fragment, null, h(KeyboardDialog, { modal: false, onClose: () => closed++, "aria-label": "Ajustes" }, h("button", null, "Dentro")), h("button", null, "Fuera"), h("dialog", { open: true }, h("button", null, "Nativo")))); await frame();
  await user().tab(); assert.equal(document.activeElement.textContent, "Fuera");
  await user().click(screen.getByRole("button", { name: "Nativo" }));
  assert.equal(fireEvent.keyDown(document.activeElement, { key: "Escape" }), true); assert.equal(closed, 0);
});

test("notificaciones reales: foco inicial, flechas en avisos, cancelar borrado y cerrar recuperan foco", async () => {
  const { AdminNotificationCenter } = sourceModule("componentes/admin-notification-center.tsx");
  const previousFetch = globalThis.fetch; const requests = [];
  globalThis.fetch = async (url, options) => { requests.push(options?.method ?? "GET"); return { ok: true, json: async () => ({ unreadCount: 0, notifications: ["Primer aviso", "Segundo aviso"].map((title, index) => ({ id: String(index), type: "info", title, message: "Mensaje", url: "/alumnos", readAt: "2026-10-01", createdAt: "2026-10-01" })) }) }; };
  try {
    render(h(AdminNotificationCenter)); await frame(); const trigger = screen.getByRole("button", { name: "Notificaciones" });
    trigger.getBoundingClientRect = () => ({ top: 20, bottom: 60, left: 200, right: 240, width: 40, height: 40 });
    await user().click(trigger); await frame();
    const remove = screen.getByRole("button", { name: "Borrar todas las notificaciones" }); assert.equal(document.activeElement, remove);
    await user().tab(); await user().tab(); assert.match(document.activeElement.textContent, /Primer aviso/);
    await user().keyboard("{ArrowDown}"); assert.match(document.activeElement.textContent, /Segundo aviso/);
    await user().click(remove); await frame(); assert.equal(document.activeElement.textContent.trim(), "Cancelar");
    await user().keyboard("{Escape}"); await frame(); assert.equal(screen.queryByRole("alertdialog"), null); assert.equal(document.activeElement, remove);
    await user().keyboard("{Escape}"); await frame(); assert.equal(screen.queryByRole("dialog"), null); assert.equal(document.activeElement, trigger);
    assert.ok(requests.every(method => method === "GET"));
  } finally { globalThis.fetch = previousFetch; }
});

function Picker({ choose = () => {}, items = all, multiple = false, insideEditor = false }) {
  const [query, setQuery] = React.useState("");
  const filtered = items.filter(item => item.name.toLowerCase().includes(query.toLowerCase()));
  const navigation = useComboboxNavigation({ items: filtered, itemKey: item => item.id, isDisabled: item => Boolean(item.disabled), queryKey: query, onSelect: choose, closeOnSelect: !multiple });
  const editorKeyboard = useRoutineKeyboardNavigation();
  return h("form", { onSubmit: event => { event.preventDefault(); choose("UNEXPECTED_SUBMIT"); }, onKeyDownCapture: insideEditor ? editorKeyboard : undefined },
    h("div", { ref: navigation.attachRoot, ...navigation.rootProps },
      h("input", { ref: navigation.attachInput, ...navigation.inputProps, "aria-label": "Buscar alumno", value: query, onChange: event => { setQuery(event.target.value); navigation.changed(); } }),
      navigation.open && h("div", { ref: navigation.attachList, ...navigation.listProps, "aria-label": "Alumnos" }, filtered.map(item => h("button", { key: item.id, type: "button", ...navigation.optionProps(item) }, item.name)))),
    h("button", { type: "button" }, "Siguiente control"));
}

test("escribir, ↓ activa el primer resultado, ↑↓ omiten deshabilitados y Enter selecciona una sola vez", async () => {
  const selected = []; render(h(Picker, { choose: item => selected.push(item) }));
  const input = screen.getByRole("combobox"); await user().click(input);
  assert.equal(input.getAttribute("aria-activedescendant"), null);
  await user().keyboard("{ArrowDown}");
  assert.equal(document.getElementById(input.getAttribute("aria-activedescendant")).textContent, "Ana");
  await user().keyboard("{ArrowDown}");
  assert.equal(document.getElementById(input.getAttribute("aria-activedescendant")).textContent, "Bruno");
  await user().keyboard("{ArrowUp}{Enter}");
  assert.deepEqual(selected.map(item => item.id), ["ana"]);
  assert.equal(document.activeElement, input);
  assert.equal(input.getAttribute("aria-expanded"), "false");
});

test("Enter sin opción activa, lista vacía y Escape nunca envían el formulario", async () => {
  const selected = []; render(h(Picker, { choose: value => selected.push(value) }));
  const input = screen.getByRole("combobox"); await user().click(input);
  await user().keyboard("{Enter}{Escape}{Enter}");
  await user().type(input, "sin coincidencias"); await user().keyboard("{ArrowDown}{Enter}");
  assert.deepEqual(selected, []);
  assert.equal(input.getAttribute("aria-activedescendant"), null);
});

test("cambiar búsqueda o resultados invalida la opción previa y evita seleccionar datos viejos", async () => {
  const selected = []; const view = render(h(Picker, { choose: value => selected.push(value) }));
  const input = screen.getByRole("combobox"); await user().click(input); await user().keyboard("{ArrowDown}");
  await user().type(input, "br"); await user().keyboard("{Enter}");
  assert.equal(input.getAttribute("aria-activedescendant"), null);
  assert.equal(selected.length, 0);
  await user().keyboard("{ArrowDown}");
  view.rerender(h(Picker, { items: [all[0]], choose: value => selected.push(value) }));
  await user().keyboard("{Enter}"); assert.equal(selected.length, 0);
});

test("click y teclado invocan el mismo callback; la búsqueda retiene foco", async () => {
  const selected = []; render(h(Picker, { choose: item => selected.push(item.id), multiple: true }));
  const input = screen.getByRole("combobox"); await user().click(input);
  await user().click(screen.getByRole("option", { name: "Bruno" }));
  assert.equal(document.activeElement, input);
  await user().keyboard("{ArrowUp}{Enter}");
  assert.deepEqual(selected, ["bruno", "ana"]);
});

test("Tab y Shift+Tab cierran sugerencias y permiten el orden nativo de foco", async () => {
  render(h("div", null, h("button", null, "Anterior"), h(Picker)));
  const input = screen.getByRole("combobox"); await user().click(input); await user().keyboard("{ArrowDown}");
  await user().tab(); assert.equal(document.activeElement.textContent, "Siguiente control"); assert.equal(input.getAttribute("aria-expanded"), "false");
  await user().click(input); await user().tab({ shift: true });
  assert.equal(document.activeElement.textContent, "Anterior"); assert.equal(input.getAttribute("aria-expanded"), "false");
});

test("IME, modificadores, repetición de Enter y Home/End no disparan acciones", async () => {
  const selected = []; render(h(Picker, { choose: value => selected.push(value), multiple: true }));
  const input = screen.getByRole("combobox"); await user().click(input); await user().keyboard("{ArrowDown}");
  for (const props of [{ isComposing: true }, { keyCode: 229 }, { ctrlKey: true }, { altKey: true }, { metaKey: true }, { repeat: true }]) fireEvent.keyDown(input, { key: "Enter", ...props });
  fireEvent.keyDown(input, { key: "Home" }); fireEvent.keyDown(input, { key: "End" });
  assert.equal(selected.length, 0);
});

test("el editor de rutinas cede Enter y flechas al selector sin cambiar de campo ni guardar", async () => {
  const selected = []; render(h(Picker, { insideEditor: true, choose: value => selected.push(value) }));
  const input = screen.getByRole("combobox"); await user().click(input); await user().keyboard("{ArrowDown}{Enter}");
  assert.deepEqual(selected.map(item => item.id), ["ana"]); assert.equal(document.activeElement, input);
});

test("selector real compartido: selección múltiple, cupo y estado ARIA", async () => {
  const students = all.filter(item => !item.disabled).map(item => ({ id: item.id, firstName: item.name, lastName: "Prueba", phone: "123", status: "activo" }));
  function Assignments() {
    const [query, setQuery] = React.useState(""); const [ids, setIds] = React.useState([]);
    return h(StudentAssignmentOptions, { students, query, onQueryChange: setQuery, selectedIds: ids, isDisabled: item => ids.length >= 1 && !ids.includes(item.id), toggle: id => setIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]) });
  }
  render(h(Assignments)); const input = screen.getByRole("combobox"); await user().click(input); await user().keyboard("{ArrowDown}{Enter}");
  assert.equal(screen.getByRole("option", { name: /Ana/ }).getAttribute("aria-selected"), "true");
  assert.equal(screen.getByRole("option", { name: /Bruno/ }).disabled, true);
  await user().keyboard("{ArrowDown}{Enter}");
  assert.equal(screen.getByRole("option", { name: /Ana/ }).getAttribute("aria-selected"), "false");
  assert.equal(document.activeElement, input);
});

test("modal: foco inicial, Tab cíclico, Shift+Tab, omitir ocultos/deshabilitados y restaurar foco", async () => {
  function Modal() {
    const [open, setOpen] = React.useState(false);
    return h("div", null, h("button", { onClick: () => setOpen(true) }, "Abrir"), open && h(KeyboardDialog, { onClose: () => setOpen(false), "aria-label": "Prueba" },
      h("button", null, "Primero"), h("button", { disabled: true }, "Deshabilitado"), h("button", { hidden: true }, "Oculto"), h("button", null, "Último")));
  }
  render(h(Modal)); await user().click(screen.getByText("Abrir")); await frame();
  assert.equal(document.activeElement.textContent, "Primero");
  await user().tab({ shift: true }); assert.equal(document.activeElement.textContent, "Último");
  await user().tab(); assert.equal(document.activeElement.textContent, "Primero");
  await user().keyboard("{Escape}"); await frame();
  assert.equal(screen.queryByRole("dialog"), null); assert.equal(document.activeElement.textContent, "Abrir");
});

test("Escape cierra sugerencias primero y después el modal; prioridad BM Command conservada", async () => {
  function Layers() {
    const [open, setOpen] = React.useState(true); const [command, setCommand] = React.useState(false);
    useEscapeLayer(command, () => setCommand(false), { priority: 100 });
    return h("div", null, open && h(KeyboardDialog, { onClose: () => setOpen(false), "aria-label": "Editor" }, h(Picker), h("button", { onClick: () => setCommand(true) }, "Command")), command && h("button", { autoFocus: true }, "BM Command"));
  }
  render(h(Layers)); await user().click(screen.getByRole("combobox")); await user().keyboard("{ArrowDown}{Escape}");
  assert.ok(screen.getByRole("dialog")); assert.equal(screen.getByRole("combobox").getAttribute("aria-expanded"), "false");
  await user().click(screen.getByText("Command")); await user().keyboard("{Escape}"); await frame();
  assert.equal(screen.queryByText("BM Command"), null); assert.ok(screen.getByRole("dialog"));
  await user().click(screen.getByRole("combobox")); await user().keyboard("{Escape}{Escape}");
  assert.equal(screen.queryByRole("dialog"), null);
});

test("modal no envía desde campos; textarea y controles nativos conservan sus teclas", async () => {
  let submits = 0; render(h(KeyboardDialog, { as: "form", onClose: () => {}, onSubmit: event => { event.preventDefault(); submits++; }, "aria-label": "Formulario" },
    h("input", { "aria-label": "Nombre" }), h("textarea", { "aria-label": "Notas" }), h("input", { type: "number", "aria-label": "Series", defaultValue: 2 }), h("button", { type: "submit" }, "Guardar")));
  await user().click(screen.getByLabelText("Nombre")); await user().keyboard("texto{Enter}"); assert.equal(submits, 0);
  await user().click(screen.getByLabelText("Notas")); await user().keyboard("una{Enter}dos"); assert.equal(screen.getByLabelText("Notas").value, "una\ndos");
  const event = new dom.window.KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true });
  screen.getByLabelText("Series").dispatchEvent(event); assert.equal(event.defaultPrevented, false);
  await user().click(screen.getByText("Guardar")); assert.equal(submits, 1);
});

test("modal ocupado consume Escape sin cerrar otra capa ni mover el foco afuera", async () => {
  let closes = 0; render(h(KeyboardDialog, { onClose: () => closes++, dismissible: false }, h("input", { "aria-label": "Dato" })));
  const input = screen.getByLabelText("Dato"); await user().click(input); await user().keyboard("{Escape}"); await frame();
  assert.equal(closes, 0); assert.equal(document.activeElement, input);
});

test("resultados: flechas desde búsqueda y opciones; Enter nativo, Escape al buscador; texto ajeno intacto", async () => {
  let chosen = 0; render(h(KeyboardResults, null, h("input", { "data-keyboard-results-search": true, "aria-label": "Buscar" }),
    h("button", { "data-keyboard-result": true, onClick: () => chosen++ }, "Resultado 1"), h("button", { "data-keyboard-result": true, disabled: true }, "No disponible"), h("button", { "data-keyboard-result": true }, "Resultado 2"), h("input", { "aria-label": "Otro texto" })));
  const search = screen.getByLabelText("Buscar"); await user().click(search); await user().keyboard("{ArrowDown}{Enter}");
  assert.equal(chosen, 1); assert.equal(document.activeElement.textContent, "Resultado 1");
  await user().keyboard("{ArrowDown}"); assert.equal(document.activeElement.textContent, "Resultado 2");
  await user().keyboard("{Escape}"); assert.equal(document.activeElement, search);
  const text = screen.getByLabelText("Otro texto"); const event = new dom.window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }); text.dispatchEvent(event); assert.equal(event.defaultPrevented, false);
});

test("menú: foco inicial, ↑↓ y Home/End omiten deshabilitados; Escape restaura disparador", async () => {
  function Menu() { const [open, setOpen] = React.useState(false); return h("div", null, h("button", { onClick: () => setOpen(true) }, "Acciones"), open && h(KeyboardMenu, { onClose: () => setOpen(false) }, h("button", { role: "menuitem" }, "Editar"), h("button", { role: "menuitem", disabled: true }, "Eliminar"), h("button", { role: "menuitem" }, "Historial"))); }
  render(h(Menu)); await user().click(screen.getByText("Acciones")); await frame(); assert.equal(document.activeElement.textContent, "Editar");
  await user().keyboard("{ArrowDown}"); assert.equal(document.activeElement.textContent, "Historial");
  await user().keyboard("{Home}"); assert.equal(document.activeElement.textContent, "Editar");
  await user().keyboard("{End}{Escape}"); await frame(); assert.equal(screen.queryByRole("menu"), null); assert.equal(document.activeElement.textContent, "Acciones");
});

test("Escape cierra filtros antes del modal y vuelve al botón de filtros", async () => {
  render(h(KeyboardDialog, { onClose: () => assert.fail("must close filters first") }, h(SearchWithFilters, { search: h("input", { "aria-label": "Buscar" }), activeCount: 0 }, h("input", { "aria-label": "Filtro" }))));
  await user().click(screen.getByRole("button", { name: "Filtros" })); await user().click(screen.getByLabelText("Filtro")); await user().keyboard("{Escape}");
  assert.equal(document.activeElement.getAttribute("aria-label"), "Filtros"); assert.ok(screen.getByRole("dialog"));
});

test("Escape cierra un menú details antes del modal y restaura su summary", async () => {
  let closes = 0; render(h(KeyboardDialog, { onClose: () => closes++ },
    h("details", { open: true }, h("summary", null, "Más acciones"), h("button", null, "Acción interna"))));
  await user().click(screen.getByText("Acción interna")); await user().keyboard("{Escape}");
  assert.equal(document.querySelector("details").open, false);
  assert.equal(closes, 0); assert.equal(document.activeElement.textContent, "Más acciones");
  await user().keyboard("{Escape}"); assert.equal(closes, 1);
});

test("los select y datalist conservan Escape nativo, sin cerrar el formulario", async () => {
  let closes = 0; render(h(KeyboardDialog, { onClose: () => closes++ },
    h("select", { "aria-label": "Plan" }, h("option", null, "Pro")), h("input", { list: "plans", "aria-label": "Sugerencia nativa" }), h("datalist", { id: "plans" }, h("option", { value: "Pro" }))));
  await user().click(screen.getByLabelText("Plan")); await user().keyboard("{Escape}");
  await user().click(screen.getByLabelText("Sugerencia nativa")); await user().keyboard("{Escape}");
  assert.equal(closes, 0);
});

test("biblioteca real: buscar, abrir detalle con Enter, volver y agregar conservan el foco", async (t) => {
  const exercise = JSON.parse(readFileSync("data/bm-exercise-library.json", "utf8"))[0];
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url) => {
    assert.ok(String(url).startsWith("/api/exercise-library"));
    return Response.json(url === "/api/exercise-library"
      ? { total: 1, items: [exercise], facets: { bodyParts: [], equipment: [], targets: [] }, mediaEnabled: false }
      : { exercise });
  };
  const { ExerciseLibraryPicker } = sourceModule("componentes/exercise-library.tsx");
  const selected = [];
  render(h(ExerciseLibraryPicker, { open: true, integrated: true, onClose: () => {}, onSelect: value => selected.push(value.id) }));
  await screen.findByText(exercise.displayNameEs);
  const search = screen.getByRole("searchbox", { name: "Buscar ejercicio" });
  await user().click(search); await user().keyboard("{ArrowDown}{Enter}");
  const back = await screen.findByRole("button", { name: "← Volver a resultados" }); await frame();
  assert.equal(document.activeElement, back);
  await user().click(back); await frame(); assert.equal(document.activeElement, screen.getByRole("searchbox"));
  await user().keyboard("{ArrowDown}{Enter}");
  await user().click(await screen.findByRole("button", { name: "Seleccionar ejercicio" })); await frame();
  assert.deepEqual(selected, [exercise.id]); assert.equal(document.activeElement, screen.getByRole("searchbox"));
});
