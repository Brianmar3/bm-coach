import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { routineValidationIssues, validateBlock, validateExercise, type BlockInput, type ExerciseInput, type RoutineInput } from "../lib/rutinas.ts";
import { focusRoutineValidationField } from "../lib/routine-validation-focus.ts";
import { editableBlockToLibrarySnapshot, librarySnapshotToEditableBlock } from "../lib/training-library-block-draft.ts";

const page = readFileSync(new URL("../app/rutinas/page.tsx", import.meta.url), "utf8");

function intervalExercise(): ExerciseInput {
  return { name: "Remo", muscleGroup: "", sets: 1, repetitions: "1", weight: null, effortType: "RIR", effortValue: null, restSeconds: null, observations: "", videoUrl: "", tempo: "", alternativeExercise: "", equipment: "", optional: false, targetType: "TIME", targetSeconds: null, targetRepetitions: "", targetDistance: "", targetSide: "", order: 1 };
}

function intervalBlock(restSeconds: number | null): BlockInput {
  return { type: "INTERVAL", name: "Intervalos", order: 1, rounds: 3, durationSeconds: null, workSeconds: 40, restSeconds, restBetweenRoundsSeconds: null, targetRounds: null, instructions: "", exercises: [intervalExercise()] };
}

function routine(block: BlockInput): RoutineInput {
  return { name: "Plan", kind: "assigned", description: "", objective: "Funcional", level: "principiante", status: "borrador", startDate: "", durationWeeks: null, priorityMuscles: [], location: "", equipment: [], tags: [], studentIds: [], days: [{ dayNumber: 1, name: "Día 1", objective: "", warmup: "", observations: "", estimatedMinutes: null, exercises: [], blocks: [block] }] };
}

test("Zona muscular es opcional sólo para INTERVAL", () => {
  assert.equal(validateExercise(intervalExercise(), "INTERVAL"), null);
  assert.match(validateExercise(intervalExercise(), "ROUNDS") ?? "", /grupo muscular/);
  assert.equal(validateBlock(intervalBlock(20)), null);
  assert.match(page, /Zona muscular <span className="text-xs font-normal text-zinc-500">\(opcional\)<\/span>/);
});

test("un intervalo sin descanso señala el campo exacto y se limpia al corregirlo", () => {
  const invalid = routineValidationIssues(routine(intervalBlock(null)));
  assert.ok(invalid.some((issue) => issue.key === "day.1.block.1.restSeconds" && /descanso/.test(issue.message)));
  assert.equal(routineValidationIssues(routine(intervalBlock(20))).length, 0);
  assert.match(page, /aria-invalid/);
  assert.match(page, /focusRoutineValidationField/);
  assert.match(page, /setActiveDay\(firstIssue\.dayNumber\)/);
  assert.match(page, /focus:ring-2 focus:ring-red-400\/30/);
});

test("el helper enfoca y acerca al viewport el primer campo inválido", () => {
  let focused = false;
  let scrolled = false;
  const target = { focus: () => { focused = true; }, getBoundingClientRect: () => ({ top: 900, bottom: 940 }), scrollIntoView: () => { scrolled = true; } };
  const root = { querySelector: (selector: string) => selector.includes("day.2.block.1.restSeconds") ? target : null } as unknown as ParentNode;
  assert.equal(focusRoutineValidationField("day.2.block.1.restSeconds", root, 800), true);
  assert.equal(focused, true);
  assert.equal(scrolled, true);
});

test("Biblioteca conserva un INTERVAL sin zona muscular", () => {
  const snapshot = editableBlockToLibrarySnapshot({ ...intervalBlock(20), clientId: "block", exercises: [{ ...intervalExercise(), clientId: "exercise" }] });
  const restored = librarySnapshotToEditableBlock(snapshot, 1, () => crypto.randomUUID());
  assert.equal(restored.exercises[0].muscleGroup, "");
  assert.equal(validateBlock(restored), null);
});
