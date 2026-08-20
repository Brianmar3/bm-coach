import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateRoutine, type RoutineInput } from "../lib/rutinas.ts";
import { routinesForStatusSection } from "../lib/routine-list-organization.ts";
import type { TrainingRoutine } from "../types/gestion.ts";

const page = readFileSync(new URL("../app/rutinas/page.tsx", import.meta.url), "utf8");
const exerciseLibrary = readFileSync(new URL("../componentes/exercise-library.tsx", import.meta.url), "utf8");
const classEditor = page.slice(page.indexOf("function ClassTemplateEditor"), page.indexOf("function RoutineEditor"));
const routineEditor = page.slice(page.indexOf("function RoutineEditor"), page.indexOf("function BlockEditor"));
const submitFlow = page.slice(page.indexOf("async function submit"), page.indexOf("async function duplicate"));

test("Crear clase completa usa una cabecera y campos propios de una sesión", () => {
  for (const text of ["Nueva clase completa", "Diseñá una sesión lista para reutilizar", "Nombre de la clase", "Tipo de clase", "Duración estimada", "Nivel", "Objetivo de la clase", "Equipamiento", "Tags / Etiquetas"]) {
    assert.match(classEditor, new RegExp(text));
  }
});

test("el editor de clase oculta conceptos de planificación y activación", () => {
  for (const text of ["Fecha de inicio", "Duración (semanas)", "Músculos prioritarios", "+ Día", "Duplicar día", "Eliminar día", "Guardar borrador", "Activar rutina"]) {
    assert.doesNotMatch(classEditor, new RegExp(text.replace(/[()+]/g, "\\$&")));
  }
  assert.doesNotMatch(classEditor, /Estado<select/);
  assert.doesNotMatch(classEditor, /Días de la rutina/);
});

test("la clase conserva entrada en calor, bloques, observaciones y guardado específico", () => {
  for (const text of ["Entrada en calor", "Bloques de la clase", "Cierre / observaciones", "Guardar clase"]) assert.match(classEditor, new RegExp(text));
  assert.match(page, /\+ Agregar bloque/);
  assert.match(classEditor, /<BlockAdder/);
  for (const handler of ["addBlock", "moveBlock", "duplicateBlock", "removeBlock"]) assert.match(classEditor, new RegExp(handler));
  assert.match(classEditor, /<BlockEditor/);
  assert.match(classEditor, /useRoutineKeyboardNavigation/);
});

test("los ocho tipos reales siguen disponibles y el tipo de clase usa un tag reservado", () => {
  for (const type of ["STRENGTH", "ROUNDS", "INTERVAL", "EMOM", "AMRAP", "FOR_TIME", "FREE", "MOBILITY"]) assert.match(page, new RegExp(type));
  for (const type of ["Funcional", "GAP", "Kids", "Personalizado", "Gimnasio", "Casa", "Otro"]) assert.match(page, new RegExp(`"${type}"`));
  assert.match(page, /classTypeTagPrefix = CLASS_TYPE_TAG_PREFIX/);
  assert.match(submitFlow, /classTagsWithType/);
  assert.match(classEditor, /value=\{visibleClassTags\(form\.tags\)\}/);
  assert.match(classEditor, /classTagsWithType\(tags, classType\)/);
});

test("guardar clase mantiene kind template, un solo día y valores neutrales", () => {
  const input: RoutineInput = {
    name: "Funcional Fuerza + EMOM", kind: "template", description: "Sesión reutilizable", objective: "Fuerza + resistencia", level: "intermedio",
    status: "borrador", startDate: "", durationWeeks: null, priorityMuscles: [], location: "", equipment: ["Mancuernas"], tags: ["Tipo de clase: Funcional"], studentIds: [],
    days: [{ dayNumber: 1, name: "Funcional Fuerza + EMOM", objective: "Fuerza + resistencia", warmup: "Movilidad + activación", observations: "Vuelta a la calma final", estimatedMinutes: 60, exercises: [], blocks: [] }],
  };
  assert.equal(validateRoutine(input), null);
  assert.match(submitFlow, /classTemplate \? editing\?\.status \?\? "borrador"/);
  assert.match(submitFlow, /name: classTemplate \? form\.name\.trim\(\) : day\.name/);
  assert.match(submitFlow, /objective: classTemplate \? form\.objective\.trim\(\) : day\.objective/);
});

test("las clases no se mezclan con Activas o Borradores de Rutinas", () => {
  const assigned = { id: "assigned", kind: "assigned", status: "borrador", updatedAt: "2026-08-14T10:00:00.000Z" } as TrainingRoutine;
  const template = { id: "template", kind: "template", status: "borrador", updatedAt: "2026-08-14T11:00:00.000Z" } as TrainingRoutine;
  assert.deepEqual(routinesForStatusSection([template, assigned], "borradores").map((routine) => routine.id), ["assigned"]);
  assert.match(page, /routine\.kind === "template"/);
  assert.match(page, /setItems\(\(current\) => editing \? current\.map/);
});

test("editar una clase de un día vuelve al editor específico", () => {
  assert.match(page, /open && <RoutineValidationContext\.Provider[^\n]+form\.kind === "template" && form\.days\.length === 1/);
  assert.match(page, /<ClassTemplateEditor/);
  assert.match(page, /edit: begin/);
});

test("templates legacy multidía conservan el editor completo sin perder días", () => {
  assert.match(page, /legacyMultiDayTemplate = form\.kind === "template" && form\.days\.length > 1/);
  assert.match(routineEditor, /Editar plantilla multidía/);
  assert.match(routineEditor, /se mantiene el editor por días para no perder contenido/);
  assert.match(routineEditor, /aria-label="Días de la rutina"/);
  assert.match(routineEditor, />\+ Día</);
});

test("Nueva rutina conserva semanas, estado, días y acciones originales", () => {
  for (const text of ["Nueva rutina", "Fecha de inicio", "Duración (semanas)", "Estado", "Días de la rutina", "+ Día", "Guardar borrador", "Activar rutina"]) assert.match(routineEditor, new RegExp(text.replace(/[()+]/g, "\\$&")));
});

test("Enter sin submitter no guarda y Escape respeta la capa superior", () => {
  assert.match(submitFlow, /if \(!\(submitter instanceof HTMLButtonElement\)\) return/);
  assert.match(classEditor, /aria-label="Biblioteca de ejercicios BM"/);
  assert.match(classEditor, /aria-labelledby="block-library-picker-title"/);
  assert.match(classEditor, /aria-labelledby="library-block-dialog-title"/);
  assert.match(exerciseLibrary, /event\.key === "Escape"/);
  assert.match(exerciseLibrary, /onClose\(\)/);
});

test("Usar plantilla continúa usando la copia independiente existente", () => {
  assert.match(page, /flow\.mode === "useTemplate"/);
  assert.match(page, /mode: "useTemplate"/);
  assert.match(page, /Se creará una copia independiente/);
});
