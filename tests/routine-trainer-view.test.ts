import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { searchStudents } from "../lib/student-search.ts";
import { isActivePainReport, routineTrainingLocation } from "../lib/routine-follow-up-filters.ts";
import { routineArrowDirection, routineControlNeedsScroll } from "../lib/routine-keyboard-navigation.ts";

const page = readFileSync(new URL("../app/rutinas/page.tsx", import.meta.url), "utf8");

test("el buscador de asignaciones filtra nombre, apellido y tildes con máximo ocho", () => {
  const students = [
    { id: "1", firstName: "Ángela", lastName: "Pérez" },
    { id: "2", firstName: "Bruno", lastName: "Pereyra" },
    ...Array.from({ length: 10 }, (_, index) => ({ id: `x${index}`, firstName: "Alumno", lastName: `Prueba ${index}` })),
  ];
  assert.equal(searchStudents(students, "angela", []).map((student) => student.id).join(), "1");
  assert.equal(searchStudents(students, "perez", []).map((student) => student.id).join(), "1");
  assert.equal(searchStudents(students, "alumno", []).length, 8);
  assert.equal(searchStudents(students, "", []).length, 0);
  assert.equal(searchStudents(students, "angela", ["1"]).length, 0);
});

test("la selección de alumno empieza cerrada y se compacta al elegir", () => {
  for (const text of ["Buscar alumno", "Escribí para buscar alumnos", "No se encontraron alumnos", "Alumno seleccionado", "Cambiar alumno"]) assert.match(page, new RegExp(text));
  assert.match(page, /searchStudents\(students, query, selectedIds\)/);
  assert.match(page, /min-w-0 overflow-hidden/);
});
const table = readFileSync(new URL("../componentes/routine-table-view.tsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../app/api/rutinas/[id]/route.ts", import.meta.url), "utf8");
const routinesLib = readFileSync(new URL("../lib/rutinas.ts", import.meta.url), "utf8");
const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(new URL("../prisma/migrations/20260802120000_add_routine_day_warmup/migration.sql", import.meta.url), "utf8");
const management = readFileSync(new URL("../componentes/routine-management-panel.tsx", import.meta.url), "utf8");
const followUp = readFileSync(new URL("../componentes/routine-follow-up.tsx", import.meta.url), "utf8");
const followUpApi = readFileSync(new URL("../app/api/seguimiento/route.ts", import.meta.url), "utf8");
const routinesApi = readFileSync(new URL("../app/api/rutinas/route.ts", import.meta.url), "utf8");
const keyboardNavigation = readFileSync(new URL("../componentes/use-routine-keyboard-navigation.ts", import.meta.url), "utf8");
const editor = page.slice(page.indexOf("function RoutineEditor"), page.indexOf("function ExerciseEditor"));
const submitFlow = page.slice(page.indexOf("async function submit"), page.indexOf("async function duplicate"));
const editorActions = editor.slice(editor.lastIndexOf('<div className="mt-6 flex flex-wrap justify-end gap-3">'));
const activeActions = editorActions.slice(editorActions.indexOf("{updatingActiveRoutine ?"), editorActions.indexOf(": <>"));
const draftActions = editorActions.slice(editorActions.indexOf(": <>"));

test("Rutinas usa un listado compacto de gestión y conserva el editor separado", () => {
  assert.match(page, /<RoutineManagementPanel/);
  assert.doesNotMatch(page, /function RoutineCard/);
  for (const heading of ["Rutina", "Alumno", "Objetivo", "Estado", "Volumen", "Última sesión", "Progreso", "Acciones"]) assert.match(management, new RegExp(heading));
  assert.match(management, /min-h-\[78px\]/);
});

test("las acciones visibles son Abrir plan, seguimiento y menú contextual", () => {
  assert.match(management, /Abrir plan/);
  assert.match(management, /aria-label="Abrir seguimiento"/);
  assert.match(management, /aria-label="Más acciones"/);
  for (const action of ["Editar", "Duplicar", "Usar como plantilla", "Cambiar asignación", "Archivar", "Eliminar rutina"]) assert.match(management, new RegExp(action));
  assert.doesNotMatch(management, /Ver contenido/);
});

test("Ver contenido separa series de fuerza, bloques, circuitos y distribución semanal", () => {
  assert.match(table, /routineSeriesMetrics\(routine\)/);
  for (const content of ["Series de fuerza", "Bloques", "Circuitos", "Min. programados", "Distribución semanal", "Ver desglose por día"]) assert.match(table, new RegExp(content.replace(".", "\\.")));
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
  assert.match(management, /disabled=\{routine\.status === "archivada"\}/);
});

test("la eliminación directa usa modal propio, protege doble toque y preserva historial", () => {
  assert.match(management, /role="dialog"/);
  assert.match(management, /Las sesiones realizadas, cargas, marcas, puntos y datos del alumno se conservarán/);
  assert.doesNotMatch(page.slice(page.indexOf("async function remove"), page.indexOf("async function archive")), /window\.confirm/);
  assert.match(api, /requireAdminApiResponse/);
  assert.doesNotMatch(api, /ARCHIVE_FIRST/);
  assert.match(schema, /routine\s+TrainingRoutine\?\s+@relation\(fields: \[routineId\], references: \[id\], onDelete: SetNull\)/);
  assert.match(schema, /exercise\s+TrainingRoutineExercise\?\s+@relation\(fields: \[exerciseId\], references: \[id\], onDelete: SetNull\)/);
  assert.doesNotMatch(api, /workoutSession\.(?:delete|deleteMany)/);
});

test("el panel lateral muestra datos reales, tendencia y molestias sin inventar porcentaje", () => {
  for (const content of ["Sesiones completadas", "Última sesión", "Duración promedio", "Progreso general", "Progreso reciente", "Molestia reportada", "Abrir seguimiento completo"]) assert.match(management, new RegExp(content));
  assert.match(management, /progressPercentage/);
  assert.match(management, /Sin métrica válida/);
});

test("Seguimiento usa una bandeja compacta y prioriza molestias o ausencia de registros", () => {
  assert.match(followUp, /Necesitan atención/);
  assert.match(followUp, /student\.latestPainReport \|\| student\.sessionCount === 0/);
  assert.match(followUp, /grid-cols-\[1\.2fr_1\.2fr_100px_80px_90px_90px_110px\]/);
  assert.doesNotMatch(followUp, /grid items-stretch gap-4/);
});

test("la navegación principal de Rutinas queda en tres pestañas sin perder las acciones de asignación", () => {
  const navigation = page.slice(page.indexOf('<nav className="mb-4'), page.indexOf('{activeTab === "seguimiento"'));
  for (const tab of ["Rutinas", "Plantillas", "Seguimiento"]) assert.match(navigation, new RegExp(`"${tab}"`));
  assert.doesNotMatch(navigation, /Asignaciones/);
  for (const action of ["Usar plantilla", "Cambiar asignación"]) assert.match(management, new RegExp(action));
});

test("Plantillas muestra sólo búsqueda y objetivo y no aplica estado ni alumno", () => {
  assert.match(page, /activeTab === "plantillas"\) return routine\.kind === "template" && matchesQuery && \(objectiveFilter/);
  assert.match(page, /activeTab !== "plantillas" && <select aria-label="Estado"/);
  assert.match(page, /activeTab !== "plantillas" && <select aria-label="Alumno"/);
});

test("el editor elimina la navegación visual adicional y conserva las tarjetas de días", () => {
  assert.doesNotMatch(editor, /Día anterior|Día siguiente|Día \{currentDayIndex \+ 1\} de/);
  assert.match(editor, /aria-label="Días de la rutina"/);
  assert.match(editor, /setActiveDay\(day\.dayNumber\)/);
});

test("ArrowRight y ArrowLeft recorren controles en orden DOM sin alterar el formulario", () => {
  assert.equal(routineArrowDirection("ArrowRight", { tagName: "INPUT", selectionStart: 4, selectionEnd: 4, valueLength: 4 }), 1);
  assert.equal(routineArrowDirection("ArrowLeft", { tagName: "INPUT", selectionStart: 0, selectionEnd: 0, valueLength: 4 }), -1);
  assert.match(page, /onKeyDownCapture=\{handleKeyboardNavigation\}/);
  assert.match(keyboardNavigation, /querySelectorAll<HTMLElement>\(navigableControlSelector\)/);
  assert.match(keyboardNavigation, /controls\[currentIndex \+ direction\]/);
  assert.doesNotMatch(keyboardNavigation, /setForm|clientId|submit|requestSubmit|click\(/);
});

test("las flechas horizontales respetan el cursor y la selección en texto", () => {
  assert.equal(routineArrowDirection("ArrowRight", { tagName: "INPUT", selectionStart: 2, selectionEnd: 2, valueLength: 4 }), null);
  assert.equal(routineArrowDirection("ArrowLeft", { tagName: "INPUT", selectionStart: 2, selectionEnd: 2, valueLength: 4 }), null);
  assert.equal(routineArrowDirection("ArrowRight", { tagName: "INPUT", selectionStart: 1, selectionEnd: 3, valueLength: 4 }), null);
});

test("textarea sólo navega desde sus límites", () => {
  assert.equal(routineArrowDirection("ArrowDown", { tagName: "TEXTAREA", selectionStart: 3, selectionEnd: 3, valueLength: 6 }), null);
  assert.equal(routineArrowDirection("ArrowDown", { tagName: "TEXTAREA", selectionStart: 6, selectionEnd: 6, valueLength: 6 }), 1);
  assert.equal(routineArrowDirection("ArrowUp", { tagName: "TEXTAREA", selectionStart: 0, selectionEnd: 0, valueLength: 6 }), -1);
});

test("selects, fechas y flechas verticales numéricas conservan su comportamiento nativo", () => {
  assert.equal(routineArrowDirection("ArrowDown", { tagName: "SELECT" }), null);
  assert.equal(routineArrowDirection("ArrowRight", { tagName: "SELECT" }), 1);
  assert.equal(routineArrowDirection("ArrowRight", { tagName: "INPUT", inputType: "date" }), null);
  assert.equal(routineArrowDirection("ArrowUp", { tagName: "INPUT", inputType: "number" }), null);
  assert.equal(routineArrowDirection("ArrowRight", { tagName: "INPUT", inputType: "number" }), 1);
  assert.equal(routineArrowDirection("ArrowDown", { tagName: "INPUT", hasList: true, selectionStart: 2, selectionEnd: 2, valueLength: 2 }), null);
});

test("Tab, Shift Tab y Enter nunca son capturados por la navegación", () => {
  for (const key of ["Tab", "Enter", " "]) assert.equal(routineArrowDirection(key, { tagName: "INPUT", selectionStart: 0, selectionEnd: 0, valueLength: 0 }), null);
  assert.match(keyboardNavigation, /event\.shiftKey/);
  assert.match(keyboardNavigation, /if \(direction === null\) return/);
});

test("el orden DOM continúa entre ejercicios y bloques sin incluir botones de acción", () => {
  assert.equal(keyboardNavigation.includes("button"), false);
  assert.match(keyboardNavigation, /input:not\(\[type="hidden"\]\):not\(\[disabled\]\), select:not\(\[disabled\]\), textarea:not\(\[disabled\]\)/);
  assert.ok(editor.indexOf("currentDay.blocks") < editor.indexOf("<BlockEditor"));
  assert.match(page, /block\.exercises\.map/);
});

test("el foco evita saltos y sólo desplaza controles fuera del viewport", () => {
  assert.equal(routineControlNeedsScroll({ top: 20, left: 20, right: 300, bottom: 100 }, { width: 390, height: 844 }), false);
  assert.equal(routineControlNeedsScroll({ top: 20, left: 20, right: 300, bottom: 850 }, { width: 390, height: 844 }), true);
  assert.match(keyboardNavigation, /focus\(\{ preventScroll: true \}\)/);
  assert.match(keyboardNavigation, /scrollIntoView\(\{ behavior: "smooth", block: "nearest", inline: "nearest" \}\)/);
});

test("Seguimiento reemplaza rutina por lugar estructurado y molestia activa", () => {
  assert.doesNotMatch(followUp, /Todas las rutinas/);
  for (const option of ["Todos los lugares", "Gimnasio", "Salón", "Casa", "Con molestia activa"]) assert.match(followUp, new RegExp(option));
  assert.match(followUp, /student\.activeRoutine\?\.location/);
  assert.match(followUpApi, /location: assignment\.routine\.location/);
});

test("el lugar se clasifica sólo desde valores estructurados reconocidos", () => {
  assert.equal(routineTrainingLocation("Gimnasio completo"), "gym");
  assert.equal(routineTrainingLocation("Salón BM Training"), "studio");
  assert.equal(routineTrainingLocation("Casa"), "home");
  assert.equal(routineTrainingLocation("Rutina de gimnasio en casa"), null);
});

test("una molestia es activa hasta siete días y deja de alertar desde el octavo", () => {
  const today = new Date("2026-08-12T12:00:00Z");
  assert.equal(isActivePainReport("2026-08-12", today), true);
  assert.equal(isActivePainReport("2026-08-06", today), true);
  assert.equal(isActivePainReport("2026-08-05", today), true);
  assert.equal(isActivePainReport("2026-08-04", today), false);
  assert.equal(isActivePainReport("2026-08-05", new Date("2026-08-13T02:30:00Z")), true);
  assert.match(followUpApi, /isActivePainReport\(latestPain\.date\)/);
  assert.match(routinesApi, /isActivePainReport\(pain\.date, now\)/);
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

test("el entrenador edita una entrada en calor independiente por cada día", () => {
  assert.match(editor, />Entrada en calor<textarea/);
  assert.match(editor, /value=\{currentDay\.warmup\}/);
  assert.match(editor, /warmup: event\.target\.value/);
  assert.match(editor, /Ej\.: movilidad, activación y ejercicios preparatorios\.\.\./);
  assert.ok(editor.indexOf("Objetivo del día") < editor.indexOf("Entrada en calor"));
  assert.ok(editor.indexOf("Entrada en calor") < editor.indexOf(">Observaciones<textarea"));
  assert.match(page, /warmup: day\.warmup/);
  assert.match(page, /warmup: source\.warmup/);
});

test("la entrada en calor se persiste con compatibilidad para rutinas antiguas", () => {
  assert.match(schema, /warmup\s+String\s+@default\(""\)/);
  assert.match(migration, /ADD COLUMN "warmup" TEXT NOT NULL DEFAULT ''/);
  assert.match(routinesLib, /warmup: day\.warmup\?\.trim\(\) \?\? ""/);
  assert.match(routinesLib, /warmup: day\.warmup/);
  assert.match(api, /warmup: dayInput\.warmup\?\.trim\(\) \?\? ""/);
  assert.match(api, /warmup: day\.warmup \?\? ""/);
});

test("Ver contenido muestra la entrada en calor antes de los ejercicios y conserva líneas", () => {
  assert.match(table, /day\.warmup\.trim\(\)/);
  assert.match(table, /Entrada en calor/);
  assert.match(table, /whitespace-pre-wrap/);
  assert.ok(table.indexOf("day.warmup.trim()") < table.indexOf("conditioningBlocks.map"));
});

test("actualizar una rutina activa incluye warmup sin duplicar rutina ni tocar sesiones", () => {
  assert.match(submitFlow, /warmup: day\.warmup/);
  assert.match(api, /trainingRoutineDay\.update/);
  assert.match(api, /routineVersionSnapshot\(updateInput\)/);
  assert.doesNotMatch(api, /transaction\.workoutSession\.(?:update|delete|deleteMany)/);
  assert.doesNotMatch(api, /transaction\.trainingRoutine\.create\(/);
});
