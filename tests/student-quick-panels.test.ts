import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("../componentes/student-quick-panels.tsx", import.meta.url), "utf8");
const studentPage = readFileSync(new URL("../app/alumnos/page.tsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../app/api/admin/alumnos/[id]/quick-panel/route.ts", import.meta.url), "utf8");

test("las cuatro acciones rápidas abren un único panel dentro de la ficha", () => {
  for (const label of ["Ver asistencias", "Registrar pago", "Ver rutina", "Ver clases"]) assert.match(component, new RegExp(label));
  assert.match(component, /const \[active, setActive\]/);
  assert.match(component, /current === panel \? null : panel/);
  assert.doesNotMatch(studentPage, /href="\/asistencias"[^>]*>Ver asistencias/);
  assert.doesNotMatch(studentPage, /href="\/pagos"[^>]*>Registrar pago/);
});

test("los datos se cargan bajo demanda, se cachean y contemplan error recuperable", () => {
  assert.match(component, /if \(!refresh && data\[panel\]\) return/);
  assert.match(component, /quick-panel\?panel=\$\{panel\}/);
  assert.match(component, /PanelSkeleton/);
  assert.match(component, /Reintentar/);
});

test("el pago reutiliza la API existente y evita el doble envío", () => {
  assert.match(component, /fetch\("\/api\/pagos"/);
  assert.match(component, /if \(saving\) return/);
  assert.match(component, /requestKey/);
  assert.match(component, /crypto\.randomUUID/);
  assert.match(component, /await refresh\(\)/);
});

test("el endpoint exige sesión administrativa y limita todas las consultas al alumno", () => {
  assert.match(api, /verifyAdminSessionValue/);
  assert.match(api, /studentId: id/g);
  assert.doesNotMatch(api, /searchParams\.get\("studentId"\)/);
  assert.match(api, /take: 10/);
  assert.match(api, /take: 5/);
});

test("solo muestra rutina activa y horarios activos asignados", () => {
  assert.match(api, /kind: "ASSIGNED", status: "ACTIVA"/);
  assert.match(api, /assignments: \{ some: \{ studentId: id, active: true \} \}/);
  assert.match(api, /where: \{ active: true, assignments/);
  assert.match(api, /weekdayOrder/);
});

test("la ficha móvil usa tarjetas y no tablas horizontales", () => {
  assert.doesNotMatch(component, /<table/);
  assert.match(component, /grid grid-cols-2/);
  assert.match(component, /rounded-xl border/);
});

