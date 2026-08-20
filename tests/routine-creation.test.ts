import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { cleanRoutineCopyName, routineCreationClasses, routineCreationSources } from "../lib/routine-creation.ts";
import type { TrainingRoutine } from "../types/gestion.ts";

const page = readFileSync(new URL("../app/rutinas/page.tsx", import.meta.url), "utf8");
const dialog = readFileSync(new URL("../componentes/routine-creation-dialog.tsx", import.meta.url), "utf8");
const copyApi = readFileSync(new URL("../app/api/rutinas/[id]/duplicar/route.ts", import.meta.url), "utf8");

function routine(overrides: Partial<TrainingRoutine> = {}): TrainingRoutine {
  return { id: "routine-1", name: "Plan base", kind: "assigned", description: "", objective: "Fuerza", level: "principiante", status: "activa", startDate: "", durationWeeks: null, priorityMuscles: [], location: "", equipment: [], tags: [], studentIds: ["student-1"], assignedStudents: [], historicalStudents: [{ id: "student-1", name: "Ana Pérez" }], createdAt: "2026-08-20", updatedAt: "2026-08-20", days: [{ id: "day-1", dayNumber: 1, name: "Día 1", objective: "", warmup: "", observations: "", estimatedMinutes: 45, blocks: [], exercises: [] }], ...overrides } as TrainingRoutine;
}

test("el selector ofrece los tres orígenes y conserva accesibilidad de diálogo", () => {
  assert.match(dialog, /Desde cero/);
  assert.match(dialog, /Desde clase completa/);
  assert.match(dialog, /Desde rutina existente/);
  assert.match(dialog, /role="dialog"/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /event\.key === "Escape"/);
  assert.match(dialog, /event\.key !== "Tab"/);
  assert.match(dialog, /actionInFlight\.current/);
});

test("clases y rutinas elegibles se filtran sin mezclar fuentes", () => {
  const completeClass = routine({ id: "class", kind: "template", status: "borrador", days: [routine().days[0]] });
  const archivedClass = routine({ id: "old-class", kind: "template", status: "archivada", days: [routine().days[0]] });
  const archivedRoutine = routine({ id: "archived", status: "archivada", name: "Plan Ana" });
  assert.deepEqual(routineCreationClasses([completeClass, archivedClass, archivedRoutine]).map((item) => item.id), ["class"]);
  assert.deepEqual(routineCreationSources([completeClass, archivedClass, archivedRoutine], "ana").map((item) => item.id), ["archived"]);
});

test("la copia explícita usa un nombre canónico sin cadenas", () => {
  assert.equal(cleanRoutineCopyName("Copia de Copia de Plan base (copia) (copia 2)"), "Copia de Plan base");
  assert.match(copyApi, /cleanRoutineCopyName\(source\.name\)/);
  assert.doesNotMatch(copyApi, /copyToStudent/);
});

test("cero y clase abren el editor sin crear registros y la copia tiene guardia", () => {
  const classStart = page.slice(page.indexOf("function startRoutineFromClass"), page.indexOf("async function submit"));
  assert.doesNotMatch(classStart, /fetch\(|\/api\/rutinas/);
  assert.match(classStart, /beginFromClassBase\("routine", source\)/);
  const duplicateStart = page.slice(page.indexOf("async function duplicateForEditing"), page.indexOf("async function createCopy"));
  assert.match(duplicateStart, /copyRequestInFlight\.current/);
  assert.match(duplicateStart, /method: "POST"/);
  assert.match(duplicateStart, /begin\(copy\)/);
  assert.match(page, /async function updateAssignments[\s\S]*method: "PUT"/);
});
