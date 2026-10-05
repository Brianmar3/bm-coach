import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateRoutine, type RoutineInput } from "../lib/rutinas.ts";

const page = readFileSync(new URL("../app/rutinas/page.tsx", import.meta.url), "utf8");
const creation = readFileSync(new URL("../componentes/routine-creation-dialog.tsx", import.meta.url), "utf8");
const picker = readFileSync(new URL("../componentes/training-library-block-picker.tsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../app/api/rutinas/route.ts", import.meta.url), "utf8");
const editor = page.slice(page.indexOf("function RoutineEditor"), page.indexOf("type BlockEditorProps"));

function emptyRoutine(status: RoutineInput["status"]): RoutineInput {
  return { kind: "assigned", name: "Plan sin alumno", objective: "Fuerza", level: "principiante", status, description: "", startDate: "", durationWeeks: null, priorityMuscles: [], location: "", equipment: [], tags: [], studentIds: [], days: [{ dayNumber: 1, name: "Día 1", objective: "", warmup: "", observations: "", estimatedMinutes: null, blocks: [], exercises: [] }] };
}

test("borrador y rutina activa sin alumnos cumplen la validación actual", () => {
  assert.equal(validateRoutine(emptyRoutine("borrador")), null);
  assert.equal(validateRoutine(emptyRoutine("activa")), null);
  assert.match(api, /input\.studentIds\.map/);
});

test("el inicio pide sólo datos esenciales y permite armar días sin asignación", () => {
  for (const label of ["Nombre", "Objetivo", "Nivel", "Cantidad de días", "Crear y empezar a armar"]) assert.match(creation, new RegExp(label));
  assert.match(page, /blocks: \[\], exercises: \[\]/);
  assert.doesNotMatch(editor, /form\.studentIds\.length === 0 \? <StudentAssignmentPicker/);
  assert.match(editor, /Rutina sin asignar/);
  assert.match(editor, /Asignar alumnos/);
});

test("editor conserva días, biblioteca, bloques, notificaciones y activación sin asignar", () => {
  for (const label of ["Opciones avanzadas", "Detalles del día", "Duplicar día", "Eliminar día", "Notificaciones de esta rutina", "Guardar borrador", "Activar rutina", "Seguir sin asignar"]) assert.match(editor, new RegExp(label));
  assert.match(editor, /<BlockAdder/);
  assert.match(editor, /<BlockEditor[^>]+compact/);
  assert.match(page, /librarySnapshotToEditableBlock\(block\.content/);
  assert.match(page, /function duplicateBlock/);
  assert.match(page, /function removeBlock/);
});

test("selector interno conserva el orden Todos, Favoritos y Recientes", () => {
  assert.match(picker, /\['all', 'Todos'\], \['favorites', 'Favoritos'\], \['recent', 'Recientes'\]/);
  assert.match(picker, /Buscar bloque/);
  assert.match(picker, /aria-label="Carpeta"/);
  assert.match(picker, /aria-label="Tipo de bloque"/);
  assert.match(picker, /aria-label="Tag"/);
});
