import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { moveRoutineBlock, routineBlockDropIndex, routineBlockScrollSpeed } from "../lib/routine-block-reorder.ts";

const page = readFileSync("app/rutinas/page.tsx", "utf8");
const sorter = readFileSync("componentes/routine-block-sorter.tsx", "utf8");
const require = createRequire(import.meta.url);
const sample = () => ["a", "b", "c", "d"].map((clientId, index) => ({ clientId, id: `saved-${clientId}`, order: index + 1, name: `Bloque ${clientId}`, type: "INTERVAL", rounds: index + 2, workSeconds: 42, restSeconds: 20, restBetweenRoundsSeconds: 45, instructions: `Notas ${clientId}`, exercises: [{ id: `exercise-${clientId}`, clientId: `draft-${clientId}`, name: `Ejercicio ${clientId}`, order: 1, repetitions: "8-12", equipment: "Banda", observations: "Conservar" }] }));

test("mover primero, último e intermedio cambia sólo order y conserva IDs, ejercicios y configuración", () => {
  const blocks = sample();
  const original = structuredClone(blocks);
  for (const [id, position, expected] of [["a", 3, "bcda"], ["d", 0, "dabc"], ["b", 2, "acbd"], ["c", 1, "acbd"]] as const) {
    const result = moveRoutineBlock(blocks, id, position);
    assert.equal(result.map((block) => block.clientId).join(""), expected);
    assert.deepEqual(result.map((block) => block.order), [1, 2, 3, 4]);
    for (const item of result) {
      const before = blocks.find((block) => block.clientId === item.clientId)!;
      assert.deepEqual({ ...item, order: before.order }, before);
      assert.equal(item.exercises, before.exercises);
    }
    assert.deepEqual(blocks, original);
  }
});

test("IDs ajenos al día, índices inválidos y movimientos sin cambio no alteran el borrador", () => {
  const blocks = sample();
  for (const [id, position] of [["other-day", 1], ["a", -1], ["d", 4], ["a", 0], ["a", 1.5]] as const) assert.equal(moveRoutineBlock(blocks, id, position), blocks);
  assert.deepEqual(moveRoutineBlock([], "a", 0), []);
  const only = blocks.slice(0, 1);
  assert.equal(moveRoutineBlock(only, "a", 0), only);
});

test("destinos se calculan con tarjetas de distinta altura, huecos y extremos", () => {
  const cards = [{ top: 100, bottom: 180 }, { top: 200, bottom: 600 }, { top: 620, bottom: 710 }];
  assert.equal(routineBlockDropIndex(20, cards), 0);
  assert.equal(routineBlockDropIndex(190, cards), 1);
  assert.equal(routineBlockDropIndex(450, cards), 2);
  assert.equal(routineBlockDropIndex(900, cards), 3);
  assert.equal(routineBlockDropIndex(500, []), 0);
  assert.equal(routineBlockScrollSpeed(300, 80, 600), 0);
  assert.equal(routineBlockScrollSpeed(0, 80, 600), -12);
  assert.equal(routineBlockScrollSpeed(900, 80, 600), 12);
});

test("el serializador real de borrador y activación guarda el orden nuevo con los mismos IDs", () => {
  const start = page.indexOf("const payload = {", page.indexOf("async function submit(event: FormEvent)"));
  const end = page.indexOf("const nextIssues", start);
  assert.ok(start >= 0 && end > start);
  const code = ts.transpileModule(`function serialize() { ${page.slice(start, end)} return payload; }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const requestedStatus of ["borrador", "activa"]) {
    const blocks = moveRoutineBlock(sample(), "d", 1);
    const payload = runInNewContext(`${code}; serialize()`, { requestedStatus, replaceOnActivate: false, classTemplate: false, persistedRoutineExerciseVideoUrl: () => "", form: { name: "Rutina", kind: "assigned", description: "", objective: "Fuerza", level: "intermedio", studentIds: [], days: [{ id: "day-1", dayNumber: 1, name: "Día 1", blocks }] } });
    assert.equal(payload.status, requestedStatus);
    assert.equal(payload.days[0].blocks.map((block: { id: string }) => block.id).join(), "saved-a,saved-d,saved-b,saved-c");
    assert.equal(payload.days[0].blocks.map((block: { order: number }) => block.order).join(), "1,2,3,4");
    assert.equal(payload.days[0].blocks[1].workSeconds, 42);
    assert.equal(payload.days[0].blocks[1].exercises[0].id, "exercise-d");
  }
});

type Element = { type: unknown; props: Record<string, unknown> };
type Handler = (event: Record<string, unknown>) => void;

/** Execute the actual handlers with React hook state and a pointer-capture/geometry fixture. */
function pointerHarness() {
  let blocks = sample();
  const commits: string[] = [];
  const slots: unknown[] = [];
  const effects: (() => void)[] = [];
  const timers = new Map<number, () => void>();
  const frames = new Map<number, (time: number) => void>();
  const listeners = new Map<string, (event: Record<string, unknown>) => void>();
  let cursor = 0;
  let timerId = 0;
  let tree: Element;
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  const hooks = {
    useCallback: (callback: unknown) => callback,
    useRef: (value: unknown) => { const index = cursor++; return slots[index] ??= { current: value }; },
    useId: () => "drag-instructions",
    useState: (value: unknown) => { const index = cursor++; slots[index] ??= value; return [slots[index], (next: unknown) => { slots[index] = next; }]; },
    useEffect: (callback: () => void, deps: unknown[]) => {
      const index = cursor++;
      const previous = slots[index] as unknown[] | undefined;
      if (!previous || deps.some((value, i) => value !== previous[i])) { effects.push(callback); slots[index] = deps; }
    },
  };
  const loaded = { exports: {} as { RoutineBlockSorter: (props: unknown) => Element } };
  const code = ts.transpileModule(sorter, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, {
    module: loaded, exports: loaded.exports,
    require: (name: string) => name === "react" ? hooks : name === "react/jsx-runtime" ? { jsx, jsxs: jsx } : name === "react-dom" ? { createPortal: (child: Element) => child } : name === "@/lib/routine-block-reorder" ? { routineBlockDropIndex, routineBlockScrollSpeed } : require(name),
    setTimeout: (callback: () => void) => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: (id: number) => timers.delete(id),
    requestAnimationFrame: (callback: (time: number) => void) => { frames.set(++timerId, callback); return timerId; },
    cancelAnimationFrame: (id: number) => frames.delete(id),
    getComputedStyle: () => ({ overflowY: "auto", getPropertyValue: () => "#d4a72c" }),
    document: { body: {}, addEventListener: (type: string, callback: (event: Record<string, unknown>) => void) => listeners.set(type, callback), removeEventListener: () => {} },
    window: { innerHeight: 800, addEventListener: () => {}, removeEventListener: () => {}, scrollBy: () => {} },
  });
  const scrollParent = { scrollHeight: 1200, clientHeight: 800, scrollTop: 0, parentElement: null, getBoundingClientRect: () => ({ top: 0, bottom: 800 }) };
  const cards = () => [...blocks].sort((a, b) => a.order - b.order).map((block, index) => ({ dataset: { routineBlockId: block.clientId }, parentElement: scrollParent, getBoundingClientRect: () => ({ top: index * 120 + 100 - scrollParent.scrollTop, bottom: index * 120 + 200 - scrollParent.scrollTop, left: 16, width: 360 }) }));
  function render(disabled = false) {
    cursor = 0;
    tree = loaded.exports.RoutineBlockSorter({ blocks, disabled, reorder: (id: string, target: number) => { blocks = moveRoutineBlock(blocks, id, target); commits.push(blocks.map((block) => block.clientId).join("")); }, renderBlock: (_block: unknown, handle: Element) => handle });
    const children = tree.props.children as Element[];
    const list = children.find((element) => element?.props?.className === "mt-4 space-y-2")!;
    (list.props.ref as { current: unknown }).current = { children: cards() };
    effects.splice(0).forEach((effect) => effect());
    return list.props.children as Element[];
  }
  function handle(id: string) {
    const wrapper = render().find((element) => element.props["data-routine-block-id"] === id)!;
    const button = wrapper.props.children as Element;
    const captured = new Set<number>();
    const node = { isConnected: true, focus: () => {}, closest: () => cards().find((card) => card.dataset.routineBlockId === id), setPointerCapture: (pointerId: number) => captured.add(pointerId), hasPointerCapture: (pointerId: number) => captured.has(pointerId), releasePointerCapture: (pointerId: number) => captured.delete(pointerId) };
    return { props: button.props, event: (y: number, pointerType = "touch") => ({ pointerType, pointerId: 1, button: 0, isPrimary: true, clientX: 300, clientY: y, currentTarget: node, preventDefault: () => {} }), captured };
  }
  return { handle, render, commits, timers, frames, listeners, scrollParent, getBlocks: () => blocks };
}

for (const pointerType of ["touch", "mouse"]) test(`${pointerType}: captura desde el handle, destino intermedio y commit sólo al soltar`, () => {
  const harness = pointerHarness();
  const handle = harness.handle("a");
  (handle.props.onPointerDown as Handler)(handle.event(130, pointerType));
  assert.equal(handle.captured.has(1), true);
  if (pointerType === "touch") [...harness.timers.values()].forEach((callback) => callback());
  (handle.props.onPointerMove as Handler)(handle.event(410, pointerType));
  harness.render();
  assert.equal(harness.commits.length, 0);
  assert.equal(harness.getBlocks().map((block) => block.clientId).join(""), "abcd");
  (handle.props.onPointerUp as Handler)(handle.event(410, pointerType));
  assert.equal(harness.commits.join(), "bcad");
  assert.equal(handle.captured.size, 0);
  assert.equal(harness.frames.size, 1); // focus restoration only; the scroll loop was cancelled
});

test("tap no reordena; pointercancel, pérdida de captura y Escape descartan el movimiento", () => {
  for (const cancel of ["tap", "onPointerCancel", "onLostPointerCapture", "Escape"]) {
    const harness = pointerHarness();
    const handle = harness.handle("a");
    (handle.props.onPointerDown as Handler)(handle.event(130));
    if (cancel === "tap") (handle.props.onPointerUp as Handler)(handle.event(130));
    else {
      (handle.props.onPointerMove as Handler)(handle.event(600));
      if (cancel === "Escape") harness.listeners.get("keydown")!({ key: "Escape", preventDefault: () => {}, stopImmediatePropagation: () => {} });
      else (handle.props[cancel] as Handler)({});
    }
    assert.equal(harness.commits.length, 0);
    assert.equal(harness.frames.size, 0);
    assert.equal(harness.timers.size, 0);
    assert.equal(handle.captured.size, 0);
  }
});

test("teclado reordena por flechas e Inicio/Fin sin perder el bloque ni cruzar límites", () => {
  const harness = pointerHarness();
  const key = (id: string, value: string) => (harness.handle(id).props.onKeyDown as Handler)({ key: value, preventDefault: () => {}, stopPropagation: () => {} });
  key("a", "ArrowUp");
  assert.equal(harness.commits.length, 0);
  key("a", "End");
  assert.equal(harness.getBlocks().map((block) => block.clientId).join(""), "bcda");
  key("a", "Home");
  key("b", "ArrowDown");
  assert.equal(harness.getBlocks().map((block) => block.clientId).join(""), "acbd");
});

test("arrastre cerca del borde desplaza el contenedor del editor", () => {
  const harness = pointerHarness();
  const handle = harness.handle("a");
  (handle.props.onPointerDown as Handler)(handle.event(130));
  (handle.props.onPointerMove as Handler)(handle.event(760));
  [...harness.frames.values()][0](16.67);
  assert.ok(harness.scrollParent.scrollTop > 0);
  (handle.props.onPointerCancel as Handler)({});
});
