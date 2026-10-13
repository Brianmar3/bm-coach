import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { assembleExerciseLibrary, validateCustomExercise, readExerciseCatalog, findSimilarExercises, CUSTOM_FILE } from "../lib/exercise-library-catalog.mjs";
import { addBMExercise } from "../scripts/add-bm-exercise.mjs";
import { filterExerciseLibrary, exerciseLibraryFacets, getExerciseMediaUrl } from "../lib/exercise-library.ts";
import { exerciseMediaAvailable, resolveExerciseMediaSource } from "../lib/exercise-library-server.ts";
import { analyze } from "../scripts/audit-exercise-library-inventory.mjs";
import { transformExerciseLibrary } from "../lib/exercise-library-transform.mjs";
import { applyLibraryExerciseSelection, createEmptyRoutineExerciseDraft, persistedRoutineExerciseVideoUrl } from "../lib/routine-exercise-draft.ts";
import { libraryExerciseReferenceUrl, resolveRoutineExerciseMedia } from "../lib/routine-exercise-media.ts";
import type { BMExercise } from "../types/exercise-library.ts";

const uuid = "67c1849f-e780-4c55-b7ed-f057dcba23f4";
const input = { id: `bm:${uuid}`, name: "Romanian deadlift with dumbbells", displayNameEs: "Peso muerto rumano con mancuernas", aliases: ["RDL BM"], bodyPart: "upper legs", bodyPartLabelEs: "Piernas", targetMuscle: "hamstrings", targetMuscleLabelEs: "Isquiotibiales", equipment: "dumbbell", equipmentLabelEs: "Mancuernas", secondaryMuscles: ["glutes"], secondaryMusclesEs: ["Glúteos"], instructionStepsEs: ["Mantené la espalda neutra."] };
const own = () => validateCustomExercise(input) as BMExercise;
const base = { ...own(), id: "dataset:demo", sourceId: "demo", source: "EXERCISES_DATASET", aliases: ["RDL"] } as BMExercise;
async function environment(t: { after: (fn: () => Promise<void>) => void }) {
  const root = await mkdtemp(path.join(tmpdir(), "bm-custom-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "data"));
  await writeFile(path.join(root, "data", "bm-exercise-library.json"), JSON.stringify([base]));
  await writeFile(path.join(root, "data", CUSTOM_FILE), "[]\n");
  const inputPath = path.join(root, "input.json");
  await writeFile(inputPath, JSON.stringify(input));
  return { root, inputPath };
}

test("ensambla base sola y base + BM sin modificar fuentes", () => {
  const before = JSON.stringify(base);
  assert.deepEqual(assembleExerciseLibrary([base], []), [base]);
  const merged = assembleExerciseLibrary([base], [input]);
  assert.equal(merged.length, 2);
  assert.equal(merged[1].source, "BM_CUSTOM");
  assert.equal(JSON.stringify(base), before);
  assert.equal(validateCustomExercise({ ...input, displayNameEs: "Nombre editado" }).id, input.id);
  assert.deepEqual(validateCustomExercise(own()), own());
});

test("IDs, esquema y colisiones fallan antes de incorporar", () => {
  for (const id of ["dataset:demo", "bm:nombre", `bm:${uuid.toUpperCase()}`]) assert.throws(() => validateCustomExercise({ ...input, id }), /ID inválido/);
  assert.throws(() => validateCustomExercise({ ...input, equipment: "" }), /equipment/);
  assert.throws(() => validateCustomExercise({ ...input, aliases: null }), /Lista inválida/);
  assert.throws(() => validateCustomExercise({ ...input, futureField: true }), /desconocido/);
  assert.throws(() => validateCustomExercise({ ...input, source: "EXERCISES_DATASET" }), /derivado/);
  assert.throws(() => assembleExerciseLibrary([base], [input, input]), /duplicado/);
  assert.throws(() => assembleExerciseLibrary([{ ...base, id: input.id }], [input]), /duplicado/);
});

test("búsqueda, aliases, músculos, equipo y facets incluyen BM", () => {
  const item = own();
  const items = assembleExerciseLibrary([], [item]) as BMExercise[];
  for (const query of ["RDL BM", "peso muerto rumano", "glúteos"]) assert.deepEqual(filterExerciseLibrary(items, { query }), [item]);
  assert.equal(filterExerciseLibrary(items, { targetMuscle: "hamstrings", equipment: "dumbbell" }).length, 1);
  assert.equal(filterExerciseLibrary(items, { equipment: "barbell" }).length, 0);
  assert.deepEqual(exerciseLibraryFacets(items).equipment, [{ value: "dumbbell", label: "Mancuernas" }]);
});

test("sin multimedia y sin instrucciones opcionales es válido y reproducible", () => {
  const item = validateCustomExercise({ ...input, instructionStepsEs: [] });
  assert.equal(item.instructionsEs, "");
  assert.deepEqual(validateCustomExercise(item), item);
  assert.equal(getExerciseMediaUrl(item as BMExercise, "gif", true), null);
});

test("media propia declarada se resuelve sin external; rutas inseguras fallan", async t => {
  const { root } = await environment(t);
  const thumbnailPath = `exercise-media/bm/${uuid}/demo.webp`;
  const gifPath = `exercise-media/bm/${uuid}/demo.gif`;
  const item = validateCustomExercise({ ...input, thumbnailPath, gifPath });
  assert.match(getExerciseMediaUrl(item as BMExercise, "gif", true)!, /bm%3A/);
  assert.equal(getExerciseMediaUrl(item as BMExercise, "gif", false), null);
  const env = { NODE_ENV: "production", EXERCISE_MEDIA_ENABLED: "true" };
  assert.deepEqual(await resolveExerciseMediaSource(gifPath, { env, projectRoot: root }), { kind: "unavailable", reason: "ASSET_NOT_FOUND" });
  await mkdir(path.dirname(path.join(root, "public", gifPath)), { recursive: true });
  await writeFile(path.join(root, "public", gifPath), "gif test");
  await writeFile(path.join(root, "data", CUSTOM_FILE), JSON.stringify([item]));
  assert.equal(await exerciseMediaAvailable(env, root), true);
  assert.deepEqual(await resolveExerciseMediaSource(gifPath, { env, projectRoot: root }), { kind: "local", filePath: path.join(root, "public", gifPath) });
  assert.equal(await exerciseMediaAvailable({ ...env, EXERCISE_MEDIA_ENABLED: "false" }, root), false);
  for (const thumbnailPath of ["https://example.com/photo.jpg", "../secret.jpg", `exercise-media/bm/${uuid}/../photo.jpg`, "images/base.jpg"]) assert.throws(() => validateCustomExercise({ ...input, thumbnailPath }), /Media inválida/);
});

test("similares detecta nombres normalizados, alias, traducción existente y fuzzy en ambas fuentes", () => {
  assert.equal(findSimilarExercises({ ...input, id: "another" }, [base])[0].match, "EXACT_NAME_OR_ALIAS");
  assert.equal(findSimilarExercises({ ...input, id: "another", name: "RDL", displayNameEs: "RDL", aliases: [] }, [base])[0].score, 1);
  assert.equal(findSimilarExercises({ ...input, id: "another", name: "PESO MUERTO RUMANO CON MANCUERNAS", displayNameEs: "PESO MUERTO RUMANO CON MANCUERNAS", aliases: [] }, [base])[0].score, 1);
  const fuzzy = findSimilarExercises({ ...input, id: "another", name: "Romanian deadlif with dumbbells", displayNameEs: "Peso muerto rumano con mancuerna", aliases: [] }, [own()]);
  assert.equal(fuzzy[0].match, "SIMILAR_NAME");
  assert.equal(findSimilarExercises({ ...input, id: "another", equipment: "barbell" }, [base])[0].possibleVariant, true);
  assert.equal(findSimilarExercises({ name: "completamente diferente", aliases: [] }, [base]).length, 0);
});

test("CLI preview no escribe; write conserva ID, advierte y no bloquea similares", async t => {
  const { root, inputPath } = await environment(t);
  const logs: string[] = [];
  const report = (message: string) => { logs.push(message); };
  const preview = await addBMExercise({ root, inputPath, report });
  assert.equal(preview.written, false);
  assert.equal((await readExerciseCatalog(root)).custom.length, 0);
  const result = await addBMExercise({ root, inputPath, write: true, report });
  assert.equal(result.similar.length, 1);
  assert.match(logs[1], /Encontramos ejercicios similares/);
  const catalog = await readExerciseCatalog(root);
  assert.equal(catalog.items[1].id, input.id);
  const before = await readFile(path.join(root, "data", CUSTOM_FILE), "utf8");
  await assert.rejects(addBMExercise({ root, inputPath, write: true, report }), /duplicado/);
  assert.equal(await readFile(path.join(root, "data", CUSTOM_FILE), "utf8"), before);
});

test("CLI genera UUID una vez, valida antes de escribir y respeta lock de otro proceso", async t => {
  const { root, inputPath } = await environment(t);
  await writeFile(inputPath, JSON.stringify({ ...input, id: undefined }));
  const result = await addBMExercise({ root, inputPath, write: true, report: () => {} });
  assert.match(result.exercise.id, /^bm:[0-9a-f-]{36}$/);
  await writeFile(inputPath, JSON.stringify({ ...input, equipment: "" }));
  await assert.rejects(addBMExercise({ root, inputPath, write: true, report: () => {} }), /equipment/);
  await writeFile(inputPath, JSON.stringify(input));
  const lock = path.join(root, "data", `${CUSTOM_FILE}.lock`);
  await writeFile(lock, "other process");
  await assert.rejects(addBMExercise({ root, inputPath, write: true, report: () => {} }), /EEXIST/);
  assert.equal(await readFile(lock, "utf8"), "other process");
  assert.equal((await readExerciseCatalog(root)).custom.length, 1);
});

test("audit distingue fuentes y compara también BASE contra BM", () => {
  const audit = analyze(assembleExerciseLibrary([base], [input]));
  assert.deepEqual(audit.sources, { BASE: 1, BM_CUSTOM: 1, TOTAL: 2 });
  assert.equal(audit.crossSourceSimilarities[0].customId, input.id);
  assert.equal(audit.pairs.length, 1);
});

test("regenerar base desde fixture preserva bytes BM e IDs guardados", async t => {
  const { root, inputPath } = await environment(t);
  await addBMExercise({ root, inputPath, write: true, report: () => {} });
  const customPath = path.join(root, "data", CUSTOM_FILE);
  const before = await readFile(customPath, "utf8");
  const fixture = JSON.parse(await readFile(new URL("fixtures/exercise-library-source.json", import.meta.url), "utf8"));
  const localization = JSON.parse(await readFile(new URL("../data/exercise-localization-es.json", import.meta.url), "utf8"));
  const { library } = transformExerciseLibrary(fixture, localization);
  await writeFile(path.join(root, "data", "bm-exercise-library.json"), JSON.stringify(library));
  assert.equal(await readFile(customPath, "utf8"), before);
  assert.ok((await readExerciseCatalog(root)).items.some((item: BMExercise) => item.id === input.id));
});

test("Rutinas conserva referencia BM estable y resuelve media por el mismo endpoint", () => {
  const empty = createEmptyRoutineExerciseDraft(1);
  const [draft] = applyLibraryExerciseSelection([empty], empty.clientId, own());
  assert.equal(draft.libraryExerciseId, input.id);
  assert.equal(persistedRoutineExerciseVideoUrl(draft), libraryExerciseReferenceUrl(input.id));
  assert.equal(resolveRoutineExerciseMedia(persistedRoutineExerciseVideoUrl(draft), true).source, "LIBRARY");
});
