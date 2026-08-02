import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/rutinas/page.tsx", import.meta.url), "utf8");
const table = readFileSync(new URL("../componentes/routine-table-view.tsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../app/api/rutinas/[id]/route.ts", import.meta.url), "utf8");
const card = page.slice(page.indexOf("function RoutineCard"), page.indexOf("function Info"));
const editor = page.slice(page.indexOf("function RoutineEditor"), page.indexOf("function ExerciseEditor"));
const submitFlow = page.slice(page.indexOf("async function submit"), page.indexOf("async function duplicate"));
const editorActions = editor.slice(editor.lastIndexOf('<div className="mt-6 flex flex-wrap justify-end gap-3">'));
const activeActions = editorActions.slice(editorActions.indexOf("{updatingActiveRoutine ?"), editorActions.indexOf(": <>"));
const draftActions = editorActions.slice(editorActions.indexOf(": <>"));

test("la tarjeta usa una fuente única y muestra cuatro métricas en dos columnas", () => {
  assert.match(page, /import \{ routineSeriesMetrics \}/);
  assert.match(card, /const metrics = routineSeriesMetrics\(routine\)/);
  assert.match(card, /grid grid-cols-2 gap-3/);
  assert.match(card, /Series totales/);
  assert.match(card, /metrics\.totalSeries/);
});

test("la tarjeta principal ya no ofrece historial y mantiene acciones importantes", () => {
  assert.doesNotMatch(card, /Ver historial/);
  for (const action of ["Ver contenido", "Ver seguimiento", "Editar", "Duplicar", "Guardar plantilla", "Copiar a alumno", "Archivar"]) {
    assert.match(card, new RegExp(action));
  }
  assert.match(card, /Más acciones/);
});

test("Ver contenido resume series, días, ejercicios y distribución semanal", () => {
  assert.match(table, /routineSeriesMetrics\(routine\)/);
  for (const content of ["Series totales", "Distribución semanal", "Ver desglose por día"]) assert.match(table, new RegExp(content));
  assert.match(table, /weeklyDistribution\.map/);
  assert.match(table, /perDay\.map/);
  assert.match(table, /item\.percentage/);
});

test("Ver contenido muestra los días antes que las métricas", () => {
  assert.ok(table.indexOf("{routine.days.map") < table.indexOf('aria-label="Métricas y distribución de la rutina"'));
});

test("la distribución semanal aparece después de todo el contenido de la rutina", () => {
  const metricsSection = table.indexOf('aria-label="Métricas y distribución de la rutina"');
  assert.ok(metricsSection > table.indexOf("{routine.days.map"));
  assert.ok(table.indexOf("Distribución semanal", metricsSection) > metricsSection);
});

test("el orden móvil conserva acordeones compactos antes del resumen", () => {
  assert.match(table, /openDayId/);
  assert.match(table, /aria-expanded=\{open\}/);
  assert.match(table, /md:hidden/);
  assert.ok(table.indexOf("aria-expanded={open}") < table.indexOf('aria-label="Métricas y distribución de la rutina"'));
});

test("una rutina activa muestra Actualizar rutina", () => {
  assert.match(activeActions, /Actualizar rutina/);
  assert.match(activeActions, /Actualizando…/);
});

test("una rutina activa no muestra Activar rutina", () => {
  assert.doesNotMatch(activeActions, />Activar rutina</);
});

test("una rutina activa no muestra Guardar como Activa", () => {
  assert.doesNotMatch(activeActions, /Guardar como/);
  assert.doesNotMatch(editorActions, /Guardar como \$\{label\(form\.status\)\}/);
});

test("la actualización fuerza el estado ACTIVA en cliente y servidor", () => {
  assert.match(submitFlow, /updatingActiveRoutine \? "activa"/);
  assert.match(api, /existing\.status === "ACTIVA" \? \{ \.\.\.input, status: "activa" as const \} : input/);
  assert.match(api, /routineData\(updateInput\)/);
});

test("actualizar usa PUT sobre el mismo registro y no crea otra rutina", () => {
  assert.match(submitFlow, /editing \? `\/api\/rutinas\/\$\{editing\.id\}`/);
  assert.match(submitFlow, /method: editing \? "PUT" : "POST"/);
  assert.match(api, /trainingRoutine\.update\(\{ where: \{ id \}/);
  assert.doesNotMatch(api, /transaction\.trainingRoutine\.create\(/);
});

test("actualizar no duplica asignaciones existentes", () => {
  assert.match(api, /existingStudentIds = new Set\(existing\.assignments/);
  assert.match(api, /newStudentIds = updateInput\.studentIds\.filter/);
  assert.match(api, /if \(newStudentIds\.length\) await transaction\.trainingRoutineAssignment\.createMany/);
});

test("actualizar conserva y sincroniza los alumnos seleccionados", () => {
  assert.match(api, /selectedStudentIds = new Set\(updateInput\.kind === "assigned" \? updateInput\.studentIds/);
  assert.match(api, /routineId_studentId: \{ routineId: id, studentId: assignment\.studentId \}/);
});

test("días y ejercicios retirados con historial se archivan", () => {
  assert.match(api, /const hasHistory = removed\.workoutLogs\.length > 0/);
  assert.match(api, /data: \{ active: false, archivedAt: new Date\(\) \}/);
  assert.match(api, /removedDay\.workoutSessions\.length > 0/);
});

test("cada actualización conserva una versión histórica", () => {
  assert.match(api, /trainingRoutineVersion\.create/);
  assert.match(api, /routineVersionSnapshot\(updateInput\)/);
  assert.match(api, /changeSummary\(currentInput, updateInput\)/);
});

test("la actualización no modifica ni elimina sesiones finalizadas", () => {
  assert.doesNotMatch(api, /transaction\.workoutSession\.(?:update|delete|deleteMany)/);
});

test("una rutina nueva o borrador muestra Guardar borrador", () => {
  assert.match(draftActions, /Guardar borrador/);
});

test("una rutina nueva o borrador muestra Activar rutina", () => {
  assert.match(draftActions, /Activar rutina/);
});

test("el guardado bloquea doble toque", () => {
  assert.match(submitFlow, /if \(saving\) return/);
  assert.match(editorActions, /disabled=\{saving\}/);
});

test("una actualización activa informa el mensaje correcto", () => {
  assert.match(submitFlow, /Rutina actualizada correctamente/);
  assert.match(submitFlow, /updatingActiveRoutine \? "Rutina actualizada correctamente"/);
});

test("un error conserva el formulario abierto y sus datos", () => {
  const errorBranch = submitFlow.slice(submitFlow.indexOf("catch (saveError)"));
  assert.match(errorBranch, /setError/);
  assert.doesNotMatch(errorBranch, /setForm\(|setOpen\(false\)|setEditing\(null\)/);
});

test("las rutinas archivadas continúan sin acceso de edición", () => {
  assert.match(card, /\{!archived && <button type="button" onClick=\{edit\}/);
});

test("la vista de escritorio conserva la tabla completa", () => {
  assert.match(table, /hidden overflow-x-auto md:block/);
  for (const heading of ["Ejercicio", "Series", "Reps", "Carga", "Descanso", "Observaciones", "Video"]) assert.match(table, new RegExp(heading));
});

test("el selector móvil conserva ancho, desplazamiento y conteo legible", () => {
  assert.match(editor, /aria-label="Días de la rutina"/);
  assert.match(editor, /snap-x snap-mandatory/);
  assert.match(editor, /overflow-x-auto/);
  assert.match(editor, /w-36 shrink-0 snap-start/);
  assert.match(editor, /whitespace-nowrap font-bold">Día/);
  assert.match(editor, /day\.exercises\.length/);
  assert.match(editor, />\+ Día</);
});

test("las acciones del día quedan compactas y ordenadas sin cambiar handlers", () => {
  assert.match(editor, /grid grid-cols-2 gap-2/);
  assert.match(editor, /Mover izquierda/);
  assert.match(editor, /Mover derecha/);
  assert.match(editor, /onClick=\{duplicateDay\}/);
  assert.match(editor, /onClick=\{addExercise\}/);
  assert.match(editor, /onClick=\{removeDay\}/);
  assert.match(editor, /col-span-2 min-h-10/);
});
