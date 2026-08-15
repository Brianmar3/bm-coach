import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const globals = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const moduleShell = readFileSync(new URL("../componentes/module-shell.tsx", import.meta.url), "utf8");
const portalShell = readFileSync(new URL("../componentes/portal-shell.tsx", import.meta.url), "utf8");

test("la tipografía y los campos reutilizados conservan legibilidad móvil", () => {
  assert.match(globals, /font-family: var\(--font-geist-sans\)/);
  assert.match(moduleShell, /text-base/);
  assert.match(moduleShell, /sm:text-sm/);
  assert.match(moduleShell, /min-h-11/);
  assert.match(moduleShell, /placeholder:text-zinc-500/);
});

test("la navegación móvil respeta safe area y deja espacio al contenido", () => {
  assert.match(portalShell, /env\(safe-area-inset-bottom\)/);
  assert.match(portalShell, /pb-\[calc\(env\(safe-area-inset-bottom\)\+8\.25rem\)\]/);
  assert.match(portalShell, /min-h-11 min-w-0/);
  assert.match(portalShell, /aria-current=\{active \? "page" : undefined\}/);
});
