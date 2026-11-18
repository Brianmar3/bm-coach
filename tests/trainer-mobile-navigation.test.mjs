import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sidebar = readFileSync(new URL("../componentes/sidebar.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../componentes/trainer-mobile-navigation.module.css", import.meta.url), "utf8");
const topbar = readFileSync(new URL("../componentes/admin-topbar.tsx", import.meta.url), "utf8");
const frame = readFileSync(new URL("../componentes/app-frame.tsx", import.meta.url), "utf8");

test("la barra móvil conserva exactamente los cinco accesos de la referencia", () => {
  const primary = sidebar.slice(sidebar.indexOf("const primary ="), sidebar.indexOf("const secondary ="));
  assert.deepEqual([...primary.matchAll(/\["([^"]+)", "\/[^\"]+",/g)].map((match) => match[1]), ["Inicio", "Alumnos", "Clases", "Rutinas"]);
  assert.match(sidebar, /<MoreIcon \/><span>Más<\/span>/);
  assert.doesNotMatch(sidebar, /Abrir menú|BmMenuIcon/);
  assert.match(topbar, /<AppBrandIdentity branding=\{branding\}/);
});

test("Más abre panel inferior con orden, cierre y foco conservados", () => {
  assert.deepEqual([...sidebar.slice(sidebar.indexOf("const links ="), sidebar.indexOf("const primary =")).matchAll(/\["([^"]+)", "\/[^\"]+",/g)].map((match) => match[1]).slice(4), ["Evaluaciones", "Pagos", "Resumen mensual", "Configuración"]);
  assert.match(sidebar, /role="dialog" aria-modal="true"/);
  assert.match(sidebar, /useDialogKeyboard\(dialogRef, open, closeMore/);
  assert.match(sidebar, /popstate/);
  assert.match(sidebar, /onPointerDown=\{\(event\)/);
  assert.match(sidebar, /closeMore\(\); touchStart\.current = null/);
  assert.match(sidebar, /\/api\/admin\/auth\/logout/);
  assert.match(styles, /border-radius: 2rem 2rem 0 0/);
});

test("barra y botón flotante respetan el espacio inferior y el teclado", () => {
  assert.match(frame, /pb-\[calc\(4\.9rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(styles, /data-trainer-keyboard/);
  assert.match(styles, /data-trainer-more/);
  assert.match(styles, /grid-template-columns: repeat\(5,minmax\(0,1fr\)\)/);
});
