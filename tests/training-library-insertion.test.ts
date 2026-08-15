import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { BlockInput } from "../lib/rutinas.ts";
import { editableBlockToLibrarySnapshot, librarySnapshotToEditableBlock } from "../lib/training-library-block-draft.ts";

const page = readFileSync(new URL("../app/rutinas/page.tsx", import.meta.url), "utf8");
const picker = readFileSync(new URL("../componentes/training-library-block-picker.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/training-library/blocks/[id]/route.ts", import.meta.url), "utf8");

function sourceBlock(): BlockInput {
  return {
    type: "EMOM", name: "EMOM Full Body 12'", order: 1, rounds: null, durationSeconds: 720, workSeconds: null, restSeconds: null, restBetweenRoundsSeconds: null, targetRounds: 4, instructions: "Rotar cada minuto",
    exercises: [{ name: "Sentadilla goblet", muscleGroup: "Cuádriceps", sets: 1, repetitions: "12", weight: 20, effortType: "RPE", effortValue: 8, restSeconds: 15, observations: "Controlar profundidad", videoUrl: "bm-library://exercise/goblet-squat", tempo: "3-1-1", alternativeExercise: "Sentadilla al cajón", equipment: "Mancuerna", optional: false, targetType: "REPS", targetSeconds: null, targetRepetitions: "12", targetDistance: "", targetSide: "Bilateral", order: 1 }],
  };
}

function idFactory() {
  let index = 0;
  return () => `local-${++index}`;
}

test("insertar una plantilla crea una copia con IDs locales nuevos e independiente", () => {
  const source = sourceBlock();
  const original = structuredClone(source);
  const inserted = librarySnapshotToEditableBlock(source, 3, idFactory());
  assert.equal(inserted.order, 3);
  assert.equal(inserted.id, undefined);
  assert.equal(inserted.clientId, "local-1");
  assert.equal(inserted.exercises[0].id, undefined);
  assert.equal(inserted.exercises[0].clientId, "local-2");
  inserted.name = "Copia editada";
  inserted.exercises[0].weight = 30;
  assert.deepEqual(source, original);
  source.instructions = "Template modificado después";
  assert.equal(inserted.instructions, "Rotar cada minuto");
});

test("round-trip conserva configuración, ejercicios, esfuerzo, equipamiento y multimedia", () => {
  const firstDraft = librarySnapshotToEditableBlock(sourceBlock(), 1, idFactory());
  const saved = editableBlockToLibrarySnapshot(firstDraft, "EMOM guardado");
  const secondDraft = librarySnapshotToEditableBlock(saved, 2, idFactory());
  assert.deepEqual(editableBlockToLibrarySnapshot(secondDraft), saved);
  assert.equal(secondDraft.order, 2);
  assert.equal(secondDraft.exercises[0].effortType, "RPE");
  assert.equal(secondDraft.exercises[0].effortValue, 8);
  assert.equal(secondDraft.exercises[0].restSeconds, 15);
  assert.equal(secondDraft.exercises[0].equipment, "Mancuerna");
  assert.equal(secondDraft.exercises[0].videoUrl, "bm-library://exercise/goblet-squat");
});

test("Agregar bloque ofrece Crear nuevo y Desde Biblioteca en ambos editores", () => {
  assert.match(page, /function BlockAdder/);
  assert.match(page, />Crear nuevo</);
  assert.match(page, />Desde Biblioteca</);
  assert.equal((page.match(/<BlockAdder /g) ?? []).length, 2);
  assert.match(page, /addNew\(type\)/);
  assert.match(page, /newBlock\(type, day\.blocks\.length \+ 1\)/);
});

test("el selector reutiliza filtros, muestra sólo activos y no inserta con Enter", () => {
  assert.match(picker, /filterTrainingLibraryBlocks/);
  assert.match(picker, /status: "active"/);
  for (const field of ["Carpeta", "Tipo de bloque", "Tag"]) assert.match(picker, new RegExp(`aria-label="${field}"`));
  assert.match(picker, /event\.key === "Enter"/);
  assert.match(picker, /event\.preventDefault\(\)/);
  assert.match(picker, /Agregar desde Biblioteca/);
});

test("la inserción ocurre en el día actual, al final, sin guardar la rutina", () => {
  assert.equal((page.match(/librarySnapshotToEditableBlock\(block\.content, day\.blocks\.length \+ 1\)/g) ?? []).length, 2);
  const insertion = page.slice(page.indexOf("function BlockAdder"), page.indexOf("function ClassTemplateEditor"));
  assert.match(insertion, /addFromLibrary\(block\)/);
  assert.doesNotMatch(insertion, /\/api\/rutinas|submit\(/);
});

test("lastUsedAt es metadata secundaria y sólo acepta templates activos", () => {
  assert.match(route, /action === "markUsed"/);
  assert.match(route, /updateMany\(\{ where: \{ id, status: "ACTIVE" \}/);
  const insertion = page.slice(page.indexOf("function BlockAdder"), page.indexOf("function ClassTemplateEditor"));
  assert.ok(insertion.indexOf("addFromLibrary(block)") < insertion.indexOf('action: "markUsed"'));
  assert.match(insertion, /\.catch\(\(\) => undefined\)/);
});

test("Guardar en Biblioteca usa formulario corto, evita Enter y conserva el editor", () => {
  assert.match(page, /Guardar en Biblioteca/);
  assert.match(page, /compact \? "Guardar en Biblioteca"/);
  assert.match(page, />Nombre<input/);
  assert.match(page, />Carpeta<select/);
  assert.match(page, />Tags<input/);
  assert.match(page, /if \(!\(submitter instanceof HTMLButtonElement\)\) return/);
  assert.match(page, /setEditorNotice\("Bloque guardado en Biblioteca\."\)/);
  assert.match(page, /editableBlockToLibrarySnapshot\(libraryBlockDraft\)/);
});

test("doble inserción y doble guardado quedan bloqueados", () => {
  assert.match(page, /insertionInFlight\.current/);
  assert.match(page, /if \(insertionInFlight\.current \|\| block\.status !== "active"\) return/);
  assert.match(page, /if \(!libraryBlockDraft \|\| librarySaving\) return/);
  assert.match(picker, /disabled=\{Boolean\(busyId\)\}/);
});
