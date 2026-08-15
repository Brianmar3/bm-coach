import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

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

test("formularios, historial y operaciones existentes permanecen conectados", () => {
  assert.match(source, /<PaymentModal/);
  assert.match(source, /<HistoryModal/);
  assert.match(source, /method: form\.paymentId \? "PUT" : "POST"/);
  assert.match(source, /method: "PATCH"/);
  assert.match(source, /fetch\("\/api\/pagos"/);
});
