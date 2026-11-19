import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildSuggestedTrainingBlocks, SUGGESTED_BLOCK_DEFINITIONS } from "../lib/suggested-training-blocks.ts";
import { editableBlockToLibrarySnapshot, librarySnapshotToEditableBlock } from "../lib/training-library-block-draft.ts";
import { validateBlock, validateRoutine, type RoutineInput } from "../lib/rutinas.ts";
import { libraryExerciseIdFromMediaUrl } from "../lib/routine-exercise-media.ts";
import { routineDayAsBlocks } from "../lib/routine-block-builder.ts";
import type { BMExercise } from "../types/exercise-library.ts";
import type { TrainingRoutineDay } from "../types/gestion.ts";

const catalog = JSON.parse(readFileSync(new URL("../data/bm-exercise-library.json", import.meta.url), "utf8")) as BMExercise[];

test("los doce bloques sugeridos usan ejercicios reales y parámetros válidos", () => {
  const blocks = buildSuggestedTrainingBlocks(catalog);
  assert.equal(blocks.length, 12);
  assert.equal(new Set(blocks.map(block => block.name)).size, 12);
  assert.deepEqual(blocks.map(block => block.name), SUGGESTED_BLOCK_DEFINITIONS.map(block => block.name));
  assert.ok(blocks.every(block => block.icon && !/[♧◇⊕↔↟⌃▤⊞◉✧]/u.test(block.icon)));
  for (const block of blocks) {
    assert.ok(block.content.exercises.length >= 3);
    assert.equal(validateBlock(block.content), null, block.name);
    for (const exercise of block.content.exercises) {
      assert.ok(catalog.some(item => item.displayNameEs === exercise.name && libraryExerciseIdFromMediaUrl(exercise.videoUrl) === item.id), exercise.name);
      assert.equal(exercise.weight, null);
      assert.equal(exercise.effortValue, null);
    }
  }
});

test("volver del editor y continuar conserva la prescripción editada sin reutilizar IDs", () => {
  const source = buildSuggestedTrainingBlocks(catalog)[0];
  const edited = librarySnapshotToEditableBlock(source.content, 1);
  edited.exercises[0].sets = 4;
  edited.exercises[0].repetitions = "10";
  edited.exercises[0].restSeconds = 90;
  edited.exercises[0].tempo = "3-1-1";
  edited.exercises[0].observations = "Controlar la técnica";
  const assembled = editableBlockToLibrarySnapshot(edited);
  const continued = librarySnapshotToEditableBlock(assembled, 1);
  const prescription = (exercises: typeof edited.exercises) => exercises.map(exercise => [exercise.name, exercise.sets, exercise.repetitions, exercise.restSeconds, exercise.tempo, exercise.observations]);
  assert.deepEqual(prescription(continued.exercises), prescription(edited.exercises));
  assert.notEqual(continued.clientId, edited.clientId);
  assert.equal(source.content.exercises[0].sets, 2);
});

test("cada inserción crea IDs independientes y no altera la plantilla", () => {
  const source = buildSuggestedTrainingBlocks(catalog)[0];
  const first = librarySnapshotToEditableBlock(source.content, 1);
  const second = librarySnapshotToEditableBlock(source.content, 2);
  first.exercises[0].sets = 5;
  assert.notEqual(first.clientId, second.clientId);
  assert.notEqual(first.exercises[0].clientId, second.exercises[0].clientId);
  assert.equal(second.exercises[0].sets, 2);
  assert.equal(source.content.exercises[0].sets, 2);
});

test("copiar un día conserva la prescripción pero excluye IDs y cargas personales", () => {
  const source = buildSuggestedTrainingBlocks(catalog)[0];
  const day = { id: "day-a", dayNumber: 1, name: "Día previo", objective: "Fuerza",
    warmup: "Movilidad", observations: "", estimatedMinutes: 45, exercises: [],
    blocks: [{ ...source.content, id: "block-a", exercises: source.content.exercises.map((exercise, index) => ({
      ...exercise, id: `exercise-${index}`, blockId: "block-a", weight: 80, effortValue: 8,
    })) }] } as TrainingRoutineDay;
  const [copy] = routineDayAsBlocks(day);
  assert.equal(copy.content.exercises.length, 4);
  assert.ok(copy.content.exercises.every(exercise => exercise.id === undefined && exercise.blockId === undefined && exercise.weight === null && exercise.effortValue === null));
  assert.equal(day.blocks[0].exercises[0].weight, 80);
});

test("una rutina de dos días con varios bloques pasa la validación de guardado existente", () => {
  const suggested = buildSuggestedTrainingBlocks(catalog);
  const input: RoutineInput = {
    name: "Plan combinado", kind: "assigned", trainerNotificationsEnabled: true,
    description: "", objective: "Fuerza", level: "principiante", status: "borrador",
    startDate: "", durationWeeks: null, priorityMuscles: [], location: "", equipment: [], tags: [], studentIds: [],
    days: [[suggested[0], suggested[6]], [suggested[2], suggested[3]]].map((blocks, index) => ({
      dayNumber: index + 1, name: `Día ${index + 1}`, objective: "", warmup: "", observations: "",
      estimatedMinutes: null, exercises: [], blocks: blocks.map((block, order) => ({ ...block.content, order: order + 1 })),
    })),
  };
  assert.equal(validateRoutine(input), null);
});
