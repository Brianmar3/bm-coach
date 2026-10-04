import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { actionMenuPosition } from "../lib/action-menu-position.ts";

const component = readFileSync(new URL("../componentes/routine-management-panel.tsx", import.meta.url), "utf8");

test("abre hacia abajo cuando entra completo", () => {
  const result = actionMenuPosition({ top: 100, bottom: 136, right: 300 }, { width: 208, height: 288 }, { width: 1000, height: 800 });
  assert.deepEqual(result, { placement: "below", top: 144, left: 92, width: 208, maxHeight: 288 });
});

test("abre hacia arriba cerca del borde inferior", () => {
  const result = actionMenuPosition({ top: 700, bottom: 736, right: 900 }, { width: 208, height: 288 }, { width: 1000, height: 800 });
  assert.deepEqual(result, { placement: "above", top: 404, left: 692, width: 208, maxHeight: 288 });
});

test("mantiene el menú dentro del viewport, incluso en pantallas pequeñas", () => {
  for (const [anchor, menu, viewport] of [
    [{ top: 190, bottom: 226, right: 30 }, { width: 208, height: 350 }, { width: 180, height: 400 }],
    [{ top: 50, bottom: 86, right: 995 }, { width: 208, height: 500 }, { width: 1000, height: 400 }],
  ] as const) {
    const result = actionMenuPosition(anchor, menu, viewport);
    assert.ok(result.left >= 8);
    assert.ok(result.left + result.width <= viewport.width - 8);
    assert.ok(result.top >= 8);
    assert.ok(result.top + result.maxHeight <= viewport.height - 8);
  }
});

test("el popover sale del overflow de la tabla y cierra con ESC, clic externo, scroll y acciones", () => {
  assert.match(component, /import \{ actionMenuPosition \} from "@\/lib\/action-menu-position"/);
  assert.match(component, /createPortal\(/);
  assert.match(component, /className="fixed z-\[70\]/);
  assert.match(component, /getBoundingClientRect\(\)/);
  assert.match(component, /event\.key !== "Escape"/);
  assert.match(component, /document\.addEventListener\("pointerdown", outside\)/);
  assert.match(component, /window\.addEventListener\("scroll", scroll, true\)/);
  assert.match(component, /const closeAndRun = .*toggleMenu\(\); action\(\)/);
  for (const action of ["Editar", "Usar como plantilla", "Asignar alumnos", "Historial de versiones", "Archivar", "Eliminar rutina"]) {
    assert.match(component, new RegExp(`label="${action}"`));
  }
  assert.match(component, /"Duplicar"/);
});
