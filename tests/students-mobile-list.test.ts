import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/alumnos/page.tsx", import.meta.url), "utf8");
const hero = '<ModuleShell title="Alumnos" subtitle="Alta rápida, planes y seguimiento de tu cartera de alumnos.">';

test("el hero de Alumnos conserva exactamente su contenido", () => {
  assert.equal(page.split(hero).length - 1, 3);
});

test("mobile usa tarjetas compactas y desktop conserva su tabla", () => {
  assert.match(page, /function StudentMobileCard/);
  assert.match(page, /space-y-2 p-2 pb-20 md:hidden/);
  assert.match(page, /hidden overflow-x-auto md:block/);
  assert.match(page, /grid grid-cols-2 gap-x-3 gap-y-2/);
  assert.match(page, /grid grid-cols-3 border-t/);
});

test("buscador, filtros, datos y acciones mantienen su funcionalidad", () => {
  for (const value of ["Buscar por nombre, apellido o teléfono", "Todos los estados", "Todos los planes", "Todos los servicios", "Sin correo", "Sin horario principal", "Ver ficha", "Editar", "Dar de baja"]) assert.match(page, new RegExp(value));
  for (const icon of ["BmSearchIcon", "BmCalendarIcon", "BmPaymentIcon", "BmPhoneIcon", "BmMailIcon", "BmTimerIcon", "BmEyeIcon", "BmEditIcon", "BmUserIcon"]) assert.match(page, new RegExp(icon));
  assert.match(page, /view=\{\(\) => setViewing\(item\)\}/);
  assert.match(page, /edit=\{\(\) => void begin\(item\)\}/);
  assert.match(page, /remove=\{\(\) => void remove\(item\)\}/);
});

test("las tarjetas protegen textos largos y mantienen targets táctiles", () => {
  assert.match(page, /title=\{value\} className="block truncate/);
  assert.match(page, /<h2 className="truncate/);
  assert.match(page, /min-h-11 min-w-0/);
});
