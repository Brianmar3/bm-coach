import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/pagos/page.tsx", import.meta.url), "utf8");
const sidebar = readFileSync(new URL("../componentes/sidebar.tsx", import.meta.url), "utf8");
const paymentsApi = readFileSync(new URL("../app/api/pagos/route.ts", import.meta.url), "utf8");
const paymentsReadModel = readFileSync(new URL("../lib/payments.ts", import.meta.url), "utf8");

test("Pagos usa un hero propio y limpio; las acciones pasan al acceso flotante", () => {
  const hero = source.slice(source.indexOf('<header className="admin-welcome'), source.indexOf("</header>"));
  assert.match(source, /Gestión BM Training/);
  assert.match(source, /Cuotas, cobros e historial\./);
  assert.doesNotMatch(hero, /Resumen mensual|Agregar pago|Registrar pago/);
  assert.match(source, /<TrainerFloatingActions/);
  assert.match(source, /label: "Registrar pago"/);
  assert.doesNotMatch(source, /<TrainerFloatingActions[^\n]+Resumen mensual/);
  assert.match(sidebar, /\["Resumen mensual", "\/resumen-mensual"/);
  assert.match(source, /hideHeader flushTop/);
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

test("guardar un pago refresca inmediatamente la fuente real y cierra el modal", () => {
  assert.match(source, /setData\(saved\.dashboard\);\s*setForm\(null\)/);
  assert.match(paymentsApi, /studentRecord\.update/);
  assert.match(paymentsApi, /dueDate: nextDueDate/);
  assert.match(paymentsApi, /\[input\.dueDate \?\? "", calculatedNextDueDate\]\.filter\(isDateKey\)\.sort\(\)\.at\(-1\)/);
  assert.match(paymentsApi, /dashboard: await paymentDashboard\(\)/);
  assert.match(paymentsReadModel, /lastPaymentDate: lastPayment\?\.paidDate/);
  assert.match(paymentsReadModel, /effectiveNextDueDate\(student\.dueDate \?\? "", record\.payments\)/);
});

test("el duplicado sigue bloqueado sin crear ni sumar otro pago", () => {
  const duplicateCheck = paymentsApi.indexOf("const duplicate = await transaction.studentPayment.findFirst");
  const create = paymentsApi.indexOf("transaction.studentPayment.create");
  assert.ok(duplicateCheck >= 0 && duplicateCheck < create);
  assert.match(paymentsApi, /studentId: input\.studentId[\s\S]{0,180}status: "PAGADO"[\s\S]{0,180}paidDate[\s\S]{0,180}billingPeriod/);
  assert.match(paymentsApi, /if \(duplicate\) throw new Error\("DUPLICATE_PAYMENT"\)/);
});
