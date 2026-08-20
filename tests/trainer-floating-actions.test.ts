import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("../componentes/trainer-floating-actions.tsx", import.meta.url), "utf8");
const dashboardWrapper = readFileSync(new URL("../componentes/dashboard-floating-actions.tsx", import.meta.url), "utf8");
const students = readFileSync(new URL("../app/alumnos/page.tsx", import.meta.url), "utf8");
const classes = readFileSync(new URL("../app/clases/page.tsx", import.meta.url), "utf8");
const routines = readFileSync(new URL("../app/rutinas/page.tsx", import.meta.url), "utf8");
const payments = readFileSync(new URL("../app/pagos/page.tsx", import.meta.url), "utf8");
const evaluations = readFileSync(new URL("../componentes/professional-evaluations-dashboard.tsx", import.meta.url), "utf8");
const sidebar = readFileSync(new URL("../componentes/sidebar.tsx", import.meta.url), "utf8");

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
  assert.match(component, /function PlusIcon/);
  assert.match(component, /M12 5v14M5 12h14/);
  assert.match(component, /focus-visible:ring-2/);
  assert.doesNotMatch(component, /<span aria-hidden="true"[^>]*>\+<\/span>/);
});

test("el sheet cierra por overlay, botón y Escape y administra el foco", () => {
  assert.match(component, /useEscapeLayer\(open, \(\) => close\(\), \{ priority: 60, triggerRef \}\)/);
  assert.match(component, /onPointerDown=\{\(\) => close\(\)\}/);
  assert.match(component, /aria-label="Cerrar acciones rápidas"/);
  assert.match(component, /firstActionRef\.current\?\.focus\(\)/);
  assert.match(component, /triggerRef\.current\?\.focus\(\)/);
  assert.match(component, /aria-modal="true"/);
});

test("el modo directo ejecuta una sola acción sin overlay ni segundo toque", () => {
  const directMode = component.slice(component.indexOf('if (mode === "direct")'), component.indexOf("return <>", component.indexOf('if (mode === "direct")') + 30));
  assert.match(component, /mode\?: "direct" \| "menu"/);
  assert.match(directMode, /onClick=\{directAction\.onSelect\}/);
  assert.doesNotMatch(directMode, /role="dialog"|aria-modal|setOpen/);
});

test("Alumnos tiene hero limpio y abre Nuevo alumno desde un único acceso flotante", () => {
  const shell = students.slice(students.indexOf("return <ModuleShell"), students.indexOf("{error && !open"));
  assert.doesNotMatch(shell, /action=|\+ Nuevo alumno/);
  assert.equal(componentCount(students), 1);
  assert.match(students, /<TrainerFloatingActions mode="direct"/);
  assert.match(students, /label: "Nuevo alumno"/);
  assert.match(students, /onSelect: \(\) => void begin\(\)/);
  assert.match(students, /enabled=\{!open && !viewing\}/);
});

test("Clases expone Crear horario y Tomar asistencia sin repetir el CTA grande", () => {
  assert.equal(componentCount(classes), 1);
  assert.doesNotMatch(classes, /\+ Crear horario →/);
  const floatingAction = classes.slice(classes.indexOf("<TrainerFloatingActions"), classes.indexOf("/>", classes.indexOf("<TrainerFloatingActions")));
  assert.match(floatingAction, /mode="direct"/);
  assert.match(floatingAction, /label: "Crear horario"/);
  assert.doesNotMatch(floatingAction, /Tomar asistencia|\/asistencias/);
  assert.match(classes, /Tomar asistencia/);
  assert.match(classes, /scheduleId=.*attendanceDate/);
  assert.match(classes, /enabled=\{!editorOpen && !viewing\}/);
});

test("Rutinas conserva creación y plantillas en un único acceso flotante", () => {
  const shell = routines.slice(routines.indexOf("return <ModuleShell"), routines.indexOf("{error && !open"));
  assert.doesNotMatch(shell, /action=/);
  assert.equal(componentCount(routines), 1);
  const floatingAction = routines.slice(routines.indexOf("<TrainerFloatingActions"), routines.indexOf("/>", routines.indexOf("<TrainerFloatingActions")));
  assert.match(floatingAction, /mode="direct"/);
  assert.match(floatingAction, /label: "Nueva rutina"/);
  assert.doesNotMatch(floatingAction, /Crear plantilla/);
  assert.match(routines, /activeTab === "plantillas"/);
  assert.match(routines, /onClick=\{\(\) => begin\(undefined, "template"\)\}/);
  assert.match(routines, />\+ Crear clase completa<\/button>/);
  assert.match(routines, /enabled=\{!open && !libraryDialogOpen[\s\S]*!creationOpen\}/);
});

test("Pagos usa el hero estándar y ofrece Registrar pago desde el acceso flotante", () => {
  assert.match(payments, /<ModuleShell title="Pagos" subtitle="Cuotas, cobros e historial\."/);
  assert.doesNotMatch(payments, /admin-welcome/);
  assert.equal(componentCount(payments), 1);
  const floatingAction = payments.slice(payments.indexOf("<TrainerFloatingActions"), payments.indexOf("/>", payments.indexOf("<TrainerFloatingActions")));
  assert.match(floatingAction, /mode="direct"/);
  assert.match(floatingAction, /label: "Registrar pago"/);
  assert.doesNotMatch(floatingAction, /Resumen mensual|\/resumen-mensual/);
  assert.match(sidebar, /\["Resumen mensual", "\/resumen-mensual"/);
  assert.match(payments, /enabled=\{!form && !historyAccount\}/);
});

test("Evaluaciones inicia el flujo directo o enfoca el selector de alumno", () => {
  assert.equal(componentCount(evaluations), 1);
  assert.match(evaluations, /<TrainerFloatingActions mode="direct"/);
  assert.match(evaluations, /label: "Nueva evaluación"/);
  assert.match(evaluations, /if \(studentId\)[\s\S]{0,80}createEvaluation\(\)/);
  assert.match(evaluations, /getElementById\("evaluation-student-search"\)/);
  assert.match(evaluations, /enabled=\{!editor && !selectedEvaluation && !deleteTarget && !creating\}/);
});

test("Dashboard conserva explícitamente el modo menú", () => {
  assert.match(dashboardWrapper, /mode="menu"/);
  assert.match(component, /role="dialog"/);
});

test("ningún panel agrega navegación inferior nueva", () => {
  for (const source of [students, classes, routines, payments, evaluations, component]) {
    assert.doesNotMatch(source, /BottomNavigation|bottom navigation|<nav[^>]+fixed[^>]+bottom/i);
  }
});
