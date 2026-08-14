import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { cleanLibraryBlockPayload, filterTrainingLibraryBlocks, normalizeLibraryText, normalizedLibraryTags, validateLibraryBlockPayload } from "../lib/training-library.ts";
import type { BlockInput } from "../lib/rutinas.ts";
import type { TrainingLibraryBlock, TrainingLibraryBlockPayload } from "../types/training-library.ts";

const exercise = {
  name: " Sentadilla ", muscleGroup: " Cuádriceps ", sets: 4, repetitions: "8", weight: 80, effortType: "RPE" as const, effortValue: 8,
  restSeconds: 90, observations: " Técnica ", videoUrl: "", tempo: "3-1-1", alternativeExercise: "Prensa", equipment: "Barra", optional: false,
  targetType: "REPS" as const, targetSeconds: null, targetRepetitions: "8", targetDistance: "", targetSide: "", order: 7,
};

const block: BlockInput = {
  type: "STRENGTH", name: " Piernas ", order: 9, rounds: null, durationSeconds: null, workSeconds: null, restSeconds: null,
  restBetweenRoundsSeconds: null, targetRounds: null, instructions: " Controlar técnica ", exercises: [exercise, { ...exercise, name: "Peso muerto", order: 12 }],
};

const payload: TrainingLibraryBlockPayload = { name: " Piernas ", folderId: " folder-1 ", tags: ["Fuerza", " fuerza ", "Técnica"], block };

test("normaliza búsquedas y tags sin distinguir tildes, mayúsculas ni espacios", () => {
  assert.equal(normalizeLibraryText("  TÉCNICA   de Fuerza "), "tecnica de fuerza");
  assert.deepEqual(normalizedLibraryTags(["Core", " córé ", "CORE", "Movilidad"]), [
    { name: "Core", normalizedName: "core" },
    { name: "Movilidad", normalizedName: "movilidad" },
  ]);
});

test("valida con las mismas reglas del editor y limpia una copia independiente", () => {
  assert.equal(validateLibraryBlockPayload(payload), null);
  assert.match(validateLibraryBlockPayload({ ...payload, name: "" }) ?? "", /nombre/i);
  const cleaned = cleanLibraryBlockPayload(payload);
  assert.equal(cleaned.name, "Piernas");
  assert.equal(cleaned.block.order, 1);
  assert.deepEqual(cleaned.block.exercises.map((item) => item.order), [1, 2]);
  assert.equal(cleaned.block.exercises[0].name, "Sentadilla");
  assert.deepEqual(cleaned.tags, ["Fuerza", "Técnica"]);
  cleaned.block.exercises[0].name = "Copia modificada";
  assert.equal(payload.block.exercises[0].name, " Sentadilla ");
});

function item(input: Partial<TrainingLibraryBlock> & Pick<TrainingLibraryBlock, "id" | "name">): TrainingLibraryBlock {
  return {
    id: input.id, name: input.name, type: input.type ?? "STRENGTH", content: input.content ?? block,
    folder: input.folder ?? null, tags: input.tags ?? [], status: input.status ?? "active", isFavorite: false,
    lastUsedAt: "", archivedAt: "", createdAt: "2026-08-14T10:00:00.000Z", updatedAt: input.updatedAt ?? "2026-08-14T10:00:00.000Z",
  };
}

test("filtra bloques por búsqueda, carpeta, tipo, tag y estado", () => {
  const blocks = [
    item({ id: "1", name: "Fuerza de piernas", folder: { id: "lower", name: "Tren inferior" }, tags: ["Técnica"], updatedAt: "2026-08-14T12:00:00.000Z" }),
    item({ id: "2", name: "EMOM cardio", type: "EMOM", tags: ["Acondicionamiento"] }),
    item({ id: "3", name: "Archivado", status: "archived" }),
  ];
  assert.deepEqual(filterTrainingLibraryBlocks(blocks, { query: "tecnica", folderId: "all", type: "all", tag: "all", status: "active" }).map((value) => value.id), ["1"]);
  assert.deepEqual(filterTrainingLibraryBlocks(blocks, { query: "", folderId: "lower", type: "STRENGTH", tag: "TÉCNICA", status: "active" }).map((value) => value.id), ["1"]);
  assert.deepEqual(filterTrainingLibraryBlocks(blocks, { query: "", folderId: "unfiled", type: "EMOM", tag: "all", status: "active" }).map((value) => value.id), ["2"]);
  assert.deepEqual(filterTrainingLibraryBlocks(blocks, { query: "", folderId: "all", type: "all", tag: "all", status: "archived" }).map((value) => value.id), ["3"]);
});

const page = readFileSync(new URL("../app/rutinas/page.tsx", import.meta.url), "utf8");
const panel = readFileSync(new URL("../componentes/training-library-blocks.tsx", import.meta.url), "utf8");
const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(new URL("../prisma/migrations/20260814190000_training_library_phase_2a/migration.sql", import.meta.url), "utf8");
const blocksApi = readFileSync(new URL("../app/api/training-library/blocks/route.ts", import.meta.url), "utf8");
const foldersApi = readFileSync(new URL("../app/api/training-library/folders/[id]/route.ts", import.meta.url), "utf8");

test("Biblioteca separa clases completas y bloques sin reemplazar las plantillas actuales", () => {
  for (const text of ["Clases completas", "Bloques", "Nuevo bloque", "Crear clase completa"]) assert.match(page, new RegExp(text));
  assert.match(page, /mode="plantillas"/);
  assert.match(page, /begin\(undefined, "template"\)/);
  assert.match(page, /<BlockEditor standalone/);
});

test("la vista de bloques ofrece filtros, archivo, restauración y gestión de carpetas", () => {
  for (const text of ["Gestionar carpetas", "Todas las carpetas", "Todos los tipos", "Todos los tags", "Archivados", "Restaurar"]) assert.match(panel, new RegExp(text));
  assert.match(panel, /md:grid-cols-2 2xl:grid-cols-3/);
  assert.doesNotMatch(panel, /overflow-x-auto/);
});

test("Prisma modela bloques independientes, carpeta opcional y tags muchos a muchos", () => {
  for (const model of ["TrainingBlockTemplate", "TrainingLibraryFolder", "TrainingLibraryTag", "TrainingBlockTemplateTag"]) assert.match(schema, new RegExp(`model ${model}`));
  assert.match(schema, /folderId\s+String\?/);
  assert.match(schema, /isFavorite\s+Boolean\s+@default\(false\)/);
  assert.match(schema, /lastUsedAt\s+DateTime\?/);
  assert.doesNotMatch(migration, /^\s*(DROP|TRUNCATE|UPDATE|DELETE\s+FROM|INSERT\s+INTO)\b/im);
  assert.doesNotMatch(migration, /ALTER TABLE "training_routines"/i);
});

test("las APIs requieren sesión, validan contenido y protegen carpetas con bloques", () => {
  assert.match(blocksApi, /requireAdminApiResponse/);
  assert.match(blocksApi, /validateLibraryBlockPayload/);
  assert.match(blocksApi, /trainingBlockTemplate\.create/);
  assert.match(foldersApi, /trainingBlockTemplate\.count\(\{ where: \{ folderId: id \} \}\)/);
  assert.match(foldersApi, /La carpeta contiene bloques y no puede eliminarse/);
});
