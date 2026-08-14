import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { filterTrainerCommands, nextCommandIndex, quickAddCommands, shouldIgnoreGlobalShortcut, studentCommandIntent, studentSearchTerms, trainerCommands } from "../lib/trainer-commands.ts";

const palette = readFileSync(new URL("../componentes/trainer-command-palette.tsx", import.meta.url), "utf8");
const appFrame = readFileSync(new URL("../componentes/app-frame.tsx", import.meta.url), "utf8");
const dashboardQuickAdd = readFileSync(new URL("../componentes/dashboard-floating-actions.tsx", import.meta.url), "utf8");
const searchApi = readFileSync(new URL("../app/api/admin/command-search/route.ts", import.meta.url), "utf8");
const payments = readFileSync(new URL("../app/pagos/page.tsx", import.meta.url), "utf8");
const classes = readFileSync(new URL("../app/clases/page.tsx", import.meta.url), "utf8");

test("Ctrl K abre BM Command y Escape lo cierra desde un único listener global", () => {
  assert.match(appFrame, /<TrainerCommandPalette/);
  assert.match(palette, /event\.ctrlKey \|\| event\.metaKey/);
  assert.match(palette, /event\.key\.toLocaleLowerCase\("es"\) === "k"/);
  assert.match(palette, /useEscapeLayer\(open, close, \{ priority: 100 \}\)/);
  assert.equal(palette.match(/document\.addEventListener\("keydown"/g)?.length, 1);
  assert.doesNotMatch(palette, /Buscar o ejecutar/);
});

test("flechas recorren en ciclo y Enter ejecuta el resultado seleccionado", () => {
  assert.equal(nextCommandIndex(0, "ArrowDown", 3), 1);
  assert.equal(nextCommandIndex(0, "ArrowUp", 3), 2);
  assert.equal(nextCommandIndex(2, "ArrowDown", 3), 0);
  assert.match(palette, /event\.key === "Enter"/);
  assert.match(palette, /execute\(items\[selectedIndex\]\)/);
});

test("shortcuts de una tecla se ignoran dentro de controles editables", () => {
  for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) assert.equal(shouldIgnoreGlobalShortcut({ tagName } as unknown as EventTarget), true);
  assert.equal(shouldIgnoreGlobalShortcut({ tagName: "DIV", isContentEditable: true } as unknown as EventTarget), true);
  assert.equal(shouldIgnoreGlobalShortcut({ tagName: "BUTTON" } as unknown as EventTarget), false);
  assert.match(palette, /shouldIgnoreGlobalShortcut\(event\.target\)/);
});

test("la búsqueda encuentra acciones sin duplicarlas", () => {
  assert.deepEqual(filterTrainerCommands("nuevo alumno").map((item) => item.id), ["new-student"]);
  assert.deepEqual(filterTrainerCommands("pago").map((item) => item.id), ["payment", "payments"]);
  assert.equal(new Set(trainerCommands.map((item) => item.id)).size, trainerCommands.length);
});

test("consultas con intención separan la acción del nombre del alumno", () => {
  assert.equal(studentCommandIntent("pago Caro"), "payment");
  assert.equal(studentCommandIntent("rutina Juani"), "routine");
  assert.equal(studentCommandIntent("evaluar Jesi"), "evaluation");
  assert.equal(studentSearchTerms("pago Caro Gorgo"), "caro gorgo");
});

test("Quick Add y BM Command comparten el mismo registry", () => {
  assert.match(dashboardQuickAdd, /quickAddCommands/);
  assert.match(palette, /trainerCommands/);
  assert.deepEqual(quickAddCommands.map((item) => item.id), ["new-student", "payment", "attendance", "new-class", "evaluation", "event"]);
});

test("la búsqueda de alumnos es autorizada, acotada y no carga el padrón al abrir", () => {
  assert.match(searchApi, /requireAdminApiResponse/);
  assert.match(searchApi, /query\.length < 2/);
  assert.match(searchApi, /slice\(0, 8\)/);
  assert.match(palette, /window\.setTimeout/);
  assert.match(palette, /controller\.abort\(\)/);
  assert.doesNotMatch(palette, /fetch\("\/api\/alumnos"/);
});

test("pago y clase reutilizan sus formularios actuales mediante parámetros", () => {
  assert.match(payments, /params\.get\("accion"\) === "nuevo"/);
  assert.match(payments, /dashboard\.students\.find/);
  assert.match(classes, /get\("accion"\) === "nueva"/);
  assert.match(classes, /setEditorOpen\(true\)/);
});

test("el diálogo conserva foco, trap, roles y ayuda compacta", () => {
  assert.match(palette, /role="dialog"/);
  assert.match(palette, /aria-modal="true"/);
  assert.match(palette, /previousFocus\.current\?\.focus\(\)/);
  assert.match(palette, /event\.key === "Tab" && open/);
  for (const shortcut of ["Ctrl K", "Nuevo alumno", "Registrar pago", "Asistencia", "Cerrar"]) assert.match(palette, new RegExp(shortcut));
});
