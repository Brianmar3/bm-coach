import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/rutinas/page.tsx", import.meta.url), "utf8");
const listApi = readFileSync(new URL("../app/api/rutinas/route.ts", import.meta.url), "utf8");
const assignmentsApi = readFileSync(new URL("../app/api/rutinas/[id]/asignaciones/route.ts", import.meta.url), "utf8");
const copyApi = readFileSync(new URL("../app/api/rutinas/[id]/duplicar/route.ts", import.meta.url), "utf8");
const blockApi = readFileSync(new URL("../app/api/training-library/blocks/[id]/route.ts", import.meta.url), "utf8");
const picker = readFileSync(new URL("../componentes/training-library-block-picker.tsx", import.meta.url), "utf8");
const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");

test("una rutina admite múltiples alumnos mediante la relación existente", () => {
  assert.match(schema, /assignments\s+TrainingRoutineAssignment\[\]/);
  assert.match(schema, /model TrainingRoutineAssignment/);
  assert.match(schema, /@@id\(\[routineId, studentId\]\)/);
  assert.match(page, /type="checkbox" checked=\{checked\}/);
  assert.match(page, /Guardar asignaciones \(\$\{studentIds\.length\}\)/);
});

test("administrar asignaciones actualiza la misma rutina y no crea copias", () => {
  const updateStart = page.indexOf("async function updateAssignments");
  const updateEnd = page.indexOf("async function", updateStart + 20);
  const updateSource = page.slice(updateStart, updateEnd);
  assert.match(updateSource, /\/asignaciones/);
  assert.match(updateSource, /method: "PUT"/);
  assert.doesNotMatch(updateSource, /\/duplicar|createCopy/);
  assert.match(assignmentsApi, /trainingRoutineAssignment\.update/);
  assert.match(assignmentsApi, /trainingRoutineAssignment\.createMany/);
  assert.doesNotMatch(assignmentsApi, /trainingRoutine\.create/);
});

test("sólo las acciones explícitas de duplicar o usar base crean una rutina nueva", () => {
  assert.doesNotMatch(copyApi, /copyToStudent/);
  assert.match(copyApi, /type CopyMode = "duplicate" \| "saveAsTemplate" \| "useTemplate"/);
  assert.match(copyApi, /copyName\(source\.name\)/);
  assert.match(copyApi, /trainingRoutine\.create/);
  assert.match(copyApi, /requestedStudentIds\.map/);
});

test("las métricas compartidas nunca mezclan el progreso de varios alumnos", () => {
  assert.match(schema, /model WorkoutSession[\s\S]*studentId\s+String/);
  assert.match(listApi, /select: \{ routineId: true, studentId: true/);
  assert.match(listApi, /activeStudentIds\.length !== 1/);
  assert.match(listApi, /session\.studentId === activeStudentIds\[0\]/);
});

test("eliminar un bloque borra sólo la fuente reusable y no sus copias insertadas", () => {
  assert.match(schema, /model TrainingBlockTemplate[\s\S]*content\s+Json/);
  assert.match(blockApi, /trainingBlockTemplate\.delete/);
  assert.doesNotMatch(blockApi, /trainingRoutine(?:Block)?\.(?:delete|update)/);
});

test("el selector abre en Todos y la vista previa es separada de Agregar", () => {
  assert.match(picker, /useState<TrainingLibraryView>\("all"\)/);
  assert.match(picker, /\[\['all', 'Todos'\], \['favorites', 'Favoritos'\], \['recent', 'Recientes'\]\]/);
  assert.match(picker, /setExpandedId\(expanded \? "" : block\.id\)/);
  assert.match(picker, /aria-expanded=\{expanded\}/);
  assert.match(picker, /onClick=\{\(\) => add\(block\)\}/);
});
