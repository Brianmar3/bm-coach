import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("../componentes/trainer-floating-actions.tsx", import.meta.url), "utf8");
const dashboardWrapper = readFileSync(new URL("../componentes/dashboard-floating-actions.tsx", import.meta.url), "utf8");
const students = readFileSync(new URL("../app/alumnos/page.tsx", import.meta.url), "utf8");
const classes = readFileSync(new URL("../app/clases/page.tsx", import.meta.url), "utf8");
const routines = readFileSync(new URL("../app/rutinas/page.tsx", import.meta.url), "utf8");
const payments = readFileSync(new URL("../app/pagos/page.tsx", import.meta.url), "utf8");

function componentCount(source: string) {
  return source.match(/<TrainerFloatingActions/g)?.length ?? 0;
}

test("el acceso flotante reutiliza exactamente el lenguaje del Dashboard", () => {
  assert.match(dashboardWrapper, /<TrainerFloatingActions/);
  assert.match(component, /data-trainer-floating-trigger/);
  assert.match(component, /rounded-full/);
  assert.match(component, /bg-yellow-400/);
  assert.match(component, /bottom-\[calc\(env\(safe-area-inset-bottom\)\+1rem\)\]/);
  assert.match(component, /shadow-\[0_10px_35px_rgba\(250,204,21,\.28\)\]/);
});

test("el sheet cierra por overlay, botón y Escape y administra el foco", () => {
  assert.match(component, /event\.key === "Escape"/);
  assert.match(component, /onPointerDown=\{\(\) => close\(\)\}/);
  assert.match(component, /aria-label="Cerrar acciones rápidas"/);
  assert.match(component, /firstActionRef\.current\?\.focus\(\)/);
  assert.match(component, /triggerRef\.current\?\.focus\(\)/);
  assert.match(component, /aria-modal="true"/);
});

test("Alumnos tiene hero limpio y abre Nuevo alumno desde un único acceso flotante", () => {
  const shell = students.slice(students.indexOf("return <ModuleShell"), students.indexOf("{error && !open"));
  assert.doesNotMatch(shell, /action=|\+ Nuevo alumno/);
  assert.equal(componentCount(students), 1);
  assert.match(students, /label: "Nuevo alumno"/);
  assert.match(students, /onSelect: \(\) => void begin\(\)/);
});

test("Clases expone Crear horario y Tomar asistencia sin repetir el CTA grande", () => {
  assert.equal(componentCount(classes), 1);
  assert.doesNotMatch(classes, /\+ Crear horario →/);
  assert.match(classes, /label: "Crear horario"/);
  assert.match(classes, /label: "Tomar asistencia"/);
  assert.match(classes, /href: "\/asistencias"/);
});

test("Rutinas conserva creación y plantillas en un único acceso flotante", () => {
  const shell = routines.slice(routines.indexOf("return <ModuleShell"), routines.indexOf("{error && !open"));
  assert.doesNotMatch(shell, /action=/);
  assert.equal(componentCount(routines), 1);
  assert.match(routines, /label: "Crear rutina"/);
  assert.match(routines, /label: "Crear plantilla"/);
});

test("Pagos deja el hero limpio y ofrece Registrar pago y Resumen mensual", () => {
  const hero = payments.slice(payments.indexOf('<header className="admin-welcome'), payments.indexOf("</header>"));
  assert.doesNotMatch(hero, /Agregar pago|Registrar pago|Resumen mensual/);
  assert.equal(componentCount(payments), 1);
  assert.match(payments, /label: "Registrar pago"/);
  assert.match(payments, /label: "Resumen mensual"/);
  assert.match(payments, /href: "\/resumen-mensual"/);
});

test("ningún panel agrega navegación inferior nueva", () => {
  for (const source of [students, classes, routines, payments, component]) {
    assert.doesNotMatch(source, /BottomNavigation|bottom navigation|<nav[^>]+fixed[^>]+bottom/i);
  }
});
