import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { actionMenuPosition } from "../lib/action-menu-position.ts";
import "./payment-notifications.test.ts";

const source = readFileSync(new URL("../app/pagos/page.tsx", import.meta.url), "utf8");
const sidebar = readFileSync(new URL("../componentes/sidebar.tsx", import.meta.url), "utf8");

test("Pagos reutiliza la cabecera estándar; las acciones pasan al acceso flotante", () => {
  assert.match(source, /<ModuleShell title="Pagos" subtitle="Cuotas, cobros e historial\."/);
  assert.match(source, /Cuotas, cobros e historial\./);
  assert.doesNotMatch(source, /admin-welcome/);
  assert.match(source, /<TrainerFloatingActions/);
  assert.match(source, /label: "Registrar pago"/);
  assert.doesNotMatch(source, /<TrainerFloatingActions[^\n]+Resumen mensual/);
  assert.match(sidebar, /\["Resumen mensual", "\/resumen-mensual"/);
  assert.doesNotMatch(source, /hideHeader flushTop/);
  assert.doesNotMatch(source, /kettlebell|pesa rusa/i);
});

test("el resumen conserva todos los indicadores reales del read model", () => {
  for (const field of ["collectedThisMonth", "overdueCount", "dueSoonCount", "currentCount", "noPaymentCount", "estimatedOutstanding"]) assert.match(source, new RegExp(`summary\\.${field}`));
  for (const label of ["Cobrado este mes", "Vencidos", "Vencen pronto", "Al día", "Sin pagos", "Pendiente estimado"]) assert.match(source, new RegExp(label));
});

test("buscador y filtros siguen siendo interactivos y mobile-first", () => {
  assert.match(source, /Buscar nombre, plan, teléfono o estado/);
  assert.match(source, /aria-pressed=\{filter === item\.value\}/);
  assert.match(source, /overflow-x-auto/);
  assert.match(source, /min-h-10 shrink-0/);
});

test("las cuentas usan cards escaneables sin eliminar sus acciones", () => {
  assert.match(source, /Alumnos y cuotas/);
  assert.match(source, /initials\(account\.student\)/);
  assert.match(source, /statusAccent\[account\.status\]/);
  assert.match(source, /Acciones de \$\{account\.student\}/);
  for (const action of ["Agregar pago", "Pagó hoy", "Ver historial", "Editar configuración de pago"]) assert.match(source, new RegExp(action));
});

test("el menú de Pagos abre hacia abajo o arriba según el espacio disponible", () => {
  const size = { width: 224, height: 270 };
  const viewport = { width: 390, height: 800 };
  const below = actionMenuPosition({ top: 100, bottom: 144, right: 360 }, size, viewport);
  const above = actionMenuPosition({ top: 700, bottom: 744, right: 360 }, size, viewport);
  assert.equal(below.placement, "below");
  assert.equal(above.placement, "above");
  assert.equal(below.top, 152);
  assert.equal(above.top, 422);
});

test("el menú de Pagos respeta los bordes y limita la altura en móviles bajos", () => {
  for (const [anchor, viewport] of [
    [{ top: 200, bottom: 244, right: 38 }, { width: 320, height: 360 }],
    [{ top: 70, bottom: 114, right: 308 }, { width: 320, height: 360 }],
  ] as const) {
    const menu = actionMenuPosition(anchor, { width: 224, height: 350 }, viewport);
    assert.ok(menu.left >= 8);
    assert.ok(menu.left + menu.width <= viewport.width - 8);
    assert.ok(menu.top >= 8);
    assert.ok(menu.top + menu.maxHeight <= viewport.height - 8);
    assert.ok(menu.maxHeight < 350);
  }
});

test("Pagos reutiliza el popover de Rutinas y conserva cierre y acciones", () => {
  assert.match(source, /import \{ actionMenuPosition \} from "@\/lib\/action-menu-position"/);
  assert.match(source, /createPortal\(/);
  assert.match(source, /className="fixed z-\[100\] w-56 overflow-y-auto overscroll-contain/);
  assert.match(source, /getBoundingClientRect\(\)/);
  assert.match(source, /document\.addEventListener\("pointerdown", outside\)/);
  assert.match(source, /event\.key !== "Escape"/);
  assert.match(source, /window\.addEventListener\("scroll", scroll, true\)/);
  assert.match(source, /const run = \(action: \(\) => void\) => \{/);
  assert.match(source, /close\(false\);\s+action\(\);/);
  for (const action of ["Agregar pago", "Pagó hoy", "Ver historial", "Editar configuración de pago", "Abrir WhatsApp"]) assert.match(source, new RegExp(action));
  assert.doesNotMatch(source, /max-sm:w-auto|max-sm:rounded-t-2xl/);
});

test("formularios, historial y operaciones existentes permanecen conectados", () => {
  assert.match(source, /<PaymentModal/);
  assert.match(source, /<HistoryModal/);
  assert.match(source, /method: form\.paymentId \? "PUT" : "POST"/);
  assert.match(source, /method: "PATCH"/);
  assert.match(source, /fetch\("\/api\/pagos"/);
});
