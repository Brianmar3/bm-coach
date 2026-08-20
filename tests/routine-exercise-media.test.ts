import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { applyLibraryExerciseSelection, createEmptyRoutineExerciseDraft, persistedRoutineExerciseVideoUrl, removeRoutineExerciseDraft, unlinkLibraryExercise } from "../lib/routine-exercise-draft.ts";
import { isValidRoutineVideoUrl, libraryExerciseMediaUrl, libraryExerciseReferenceUrl, resolveManualVideoPlayback, resolveRoutineExerciseMedia } from "../lib/routine-exercise-media.ts";
import { validateExercise } from "../lib/rutinas.ts";
import type { BMExercise } from "../types/exercise-library.ts";

const editor = readFileSync(new URL("../app/rutinas/page.tsx", import.meta.url), "utf8");
const portal = readFileSync(new URL("../componentes/portal-section.tsx", import.meta.url), "utf8");
const mediaComponent = readFileSync(new URL("../componentes/routine-exercise-media.tsx", import.meta.url), "utf8");
const updateApi = readFileSync(new URL("../app/api/rutinas/[id]/route.ts", import.meta.url), "utf8");
const routinesPersistence = readFileSync(new URL("../lib/rutinas.ts", import.meta.url), "utf8");
const globalStyles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

const libraryExercise: BMExercise = {
  id: "dataset:0042",
  sourceId: "0042",
  name: "kettlebell thruster",
  displayName: "Thruster con kettlebell",
  displayNameEs: "Thruster con kettlebell",
  aliases: ["kettlebell thruster", "thruster con kettlebell"],
  translationStatus: "EXCEPTION",
  translationPass: 1,
  bodyPart: "upper legs",
  bodyPartLabelEs: "Muslos",
  equipment: "kettlebell",
  equipmentLabelEs: "Kettlebell",
  targetMuscle: "quadriceps",
  targetMuscleLabelEs: "Cuádriceps",
  muscleGroup: "Piernas",
  muscleGroupLabelEs: "Piernas",
  secondaryMuscles: ["glutes"],
  secondaryMusclesEs: ["Glúteos"],
  instructionsEs: "Mantené el torso estable.",
  instructionStepsEs: ["Sostené la pesa.", "Extendé cadera y brazos."],
  thumbnailPath: "images/0042.jpg",
  gifPath: "videos/0042.gif",
  attribution: "Exercise data source",
  source: "EXERCISES_DATASET",
  searchableText: "kettlebell thruster quadriceps",
};

test("resuelve una única fuente de media con compatibilidad legacy", () => {
  const reference = libraryExerciseReferenceUrl(libraryExercise.id);
  assert.deepEqual(resolveRoutineExerciseMedia(reference, true), {
    hasMedia: true,
    source: "LIBRARY",
    libraryExerciseId: libraryExercise.id,
    mediaUrl: libraryExerciseMediaUrl(libraryExercise.id),
    thumbnailUrl: libraryExerciseMediaUrl(libraryExercise.id, "thumbnail"),
  });
  assert.deepEqual(resolveRoutineExerciseMedia(reference, false), {
    hasMedia: false,
    source: "LIBRARY",
    libraryExerciseId: libraryExercise.id,
    mediaUrl: null,
    thumbnailUrl: null,
  });
  assert.equal(resolveRoutineExerciseMedia("https://cdn.example.com/demo.mp4", false).source, "MANUAL");
  assert.equal(resolveRoutineExerciseMedia("", true).source, "NONE");
  assert.equal(isValidRoutineVideoUrl(reference), true);
  assert.match(reference, /^bm-library:\/\/exercise\/dataset%3A0042$/);
  assert.doesNotMatch(reference, /bm-training\.local/);
  assert.equal(resolveRoutineExerciseMedia("https://bm-training.local/api/exercise-library/media?id=dataset%3A0042&kind=gif", true).libraryExerciseId, libraryExercise.id);
  assert.equal(isValidRoutineVideoUrl("https://cdn.example.com/demo.mp4"), true);
  assert.equal(isValidRoutineVideoUrl("https://youtube.com/watch?v=demo"), true);
  assert.equal(isValidRoutineVideoUrl(""), true);
  assert.equal(isValidRoutineVideoUrl("javascript:alert(1)"), false);
});

test("resuelve videos manuales dentro de la app sin navegación externa", () => {
  assert.deepEqual(resolveManualVideoPlayback("https://cdn.example.com/demo.mp4"), { kind: "VIDEO", url: "https://cdn.example.com/demo.mp4" });
  assert.deepEqual(resolveManualVideoPlayback("https://youtu.be/dQw4w9WgXcQ"), { kind: "EMBED", url: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" });
  assert.deepEqual(resolveManualVideoPlayback("https://vimeo.com/123456"), { kind: "EMBED", url: "https://player.vimeo.com/video/123456" });
  assert.deepEqual(resolveManualVideoPlayback("https://example.com/watch/123"), { kind: "UNAVAILABLE", url: null });
});

test("cada alta crea un objeto independiente y completamente limpio", () => {
  let sequence = 0;
  const createId = () => `exercise-${++sequence}`;
  const first = createEmptyRoutineExerciseDraft(1, "STRENGTH", createId);
  const second = createEmptyRoutineExerciseDraft(2, "STRENGTH", createId);
  first.name = "Sentadilla goblet";
  first.muscleGroup = "Piernas";
  first.equipment = "kettlebell";
  first.videoUrl = "https://cdn.example.com/goblet.mp4";
  first.observations = "Controlar la bajada";
  first.alternativeExercise = "Sentadilla a banco";
  first.weight = 20;
  assert.notEqual(first.clientId, second.clientId);
  assert.deepEqual({ name: second.name, libraryExerciseId: second.libraryExerciseId, muscleGroup: second.muscleGroup, equipment: second.equipment, weight: second.weight, alternativeExercise: second.alternativeExercise, videoUrl: second.videoUrl, observations: second.observations }, { name: "", libraryExerciseId: undefined, muscleGroup: "", equipment: "", weight: null, alternativeExercise: "", videoUrl: "", observations: "" });
  assert.equal(first.name, "Sentadilla goblet");
  assert.equal(second.sets, 3);
  assert.equal(second.repetitions, "10-12");
  assert.equal(second.effortValue, 2);
  assert.equal(second.restSeconds, 90);
});

test("seleccionar biblioteca modifica sólo la tarjeta destinataria", () => {
  const first = createEmptyRoutineExerciseDraft(1, "STRENGTH", () => "first");
  const second = createEmptyRoutineExerciseDraft(2, "STRENGTH", () => "second");
  first.name = "Ejercicio manual existente";
  first.videoUrl = "https://cdn.example.com/manual.mp4";
  second.observations = "No cierres las rodillas y controlá la bajada.";
  const updated = applyLibraryExerciseSelection([first, second], second.clientId, libraryExercise);
  assert.equal(updated[0], first);
  assert.equal(updated[0].name, "Ejercicio manual existente");
  assert.equal(updated[0].videoUrl, "https://cdn.example.com/manual.mp4");
  assert.equal(updated[1].name, libraryExercise.displayNameEs);
  assert.equal(updated[1].libraryExerciseId, libraryExercise.id);
  assert.equal(updated[1].muscleGroup, libraryExercise.targetMuscleLabelEs);
  assert.equal(updated[1].equipment, libraryExercise.equipmentLabelEs);
  assert.equal(updated[1].videoUrl, libraryExerciseReferenceUrl(libraryExercise.id));
  assert.equal(updated[1].observations, "No cierres las rodillas y controlá la bajada.");
});

test("Biblioteca sin media conserva identidad, carga e indicaciones al guardar o activar", () => {
  const first = applyLibraryExerciseSelection(
    [createEmptyRoutineExerciseDraft(1, "STRENGTH", () => "first")],
    "first",
    libraryExercise,
  )[0];
  first.sets = 4;
  first.repetitions = "8-10";
  first.restSeconds = 120;
  first.observations = "Controlá la bajada y mantené las rodillas alineadas.";
  const second = createEmptyRoutineExerciseDraft(2, "STRENGTH", () => "second");
  second.name = "Sentadilla goblet";
  second.muscleGroup = "Piernas";
  second.equipment = "mancuerna";
  second.videoUrl = "https://cdn.example.com/goblet.mp4";
  assert.equal(validateExercise(first, "STRENGTH"), null);
  assert.equal(validateExercise(second, "STRENGTH"), null);
  const persisted = JSON.parse(JSON.stringify([
    { ...first, videoUrl: persistedRoutineExerciseVideoUrl(first) },
    { ...second, videoUrl: persistedRoutineExerciseVideoUrl(second) },
  ])) as typeof first[];
  assert.equal(persisted.length, 2);
  assert.equal(persisted[0].videoUrl, libraryExerciseReferenceUrl(libraryExercise.id));
  assert.equal(resolveRoutineExerciseMedia(persisted[0].videoUrl, false).hasMedia, false);
  assert.equal(resolveRoutineExerciseMedia(persisted[0].videoUrl, false).source, "LIBRARY");
  assert.equal(persisted[0].sets, 4);
  assert.equal(persisted[0].repetitions, "8-10");
  assert.equal(persisted[0].restSeconds, 120);
  assert.equal(persisted[0].observations, "Controlá la bajada y mantené las rodillas alineadas.");
  assert.equal(persisted[1].name, "Sentadilla goblet");
  assert.equal(persisted[1].videoUrl, "https://cdn.example.com/goblet.mp4");
});

test("la referencia de Biblioteca se consolida desde sourceId aunque la media no esté disponible", () => {
  const exercise = createEmptyRoutineExerciseDraft(1, "STRENGTH", () => "library");
  exercise.libraryExerciseId = libraryExercise.id;
  exercise.videoUrl = "";
  exercise.name = libraryExercise.displayNameEs;
  exercise.muscleGroup = libraryExercise.targetMuscleLabelEs;
  assert.equal(persistedRoutineExerciseVideoUrl(exercise), libraryExerciseReferenceUrl(libraryExercise.id));
  assert.equal(validateExercise({ ...exercise, videoUrl: persistedRoutineExerciseVideoUrl(exercise) }, "STRENGTH"), null);
});

test("quitar el vínculo conserva la fila y las indicaciones", () => {
  const selected = applyLibraryExerciseSelection([createEmptyRoutineExerciseDraft(1, "STRENGTH", () => "library")], "library", libraryExercise)[0];
  selected.observations = "Mantené el abdomen firme.";
  const unlinked = unlinkLibraryExercise(selected);
  assert.equal(unlinked.clientId, selected.clientId);
  assert.equal(unlinked.name, selected.name);
  assert.equal(unlinked.observations, selected.observations);
  assert.equal(unlinked.libraryExerciseId, undefined);
  assert.equal(unlinked.videoUrl, "");
});

test("eliminar funciona igual para ejercicios manuales y de Biblioteca y reordena", () => {
  const library = applyLibraryExerciseSelection([createEmptyRoutineExerciseDraft(1, "STRENGTH", () => "library")], "library", libraryExercise)[0];
  const manual = createEmptyRoutineExerciseDraft(2, "STRENGTH", () => "manual");
  manual.name = "Peso muerto manual";
  const withoutLibrary = removeRoutineExerciseDraft([library, manual], "library");
  assert.deepEqual(withoutLibrary.map(({ clientId, order }) => ({ clientId, order })), [{ clientId: "manual", order: 1 }]);
  assert.deepEqual(removeRoutineExerciseDraft([library, manual], "manual").map((exercise) => exercise.clientId), ["library"]);
});

test("el aislamiento también se aplica a todas las estaciones de circuitos", () => {
  for (const type of ["INTERVAL", "EMOM", "AMRAP", "FOR_TIME"] as const) {
    const first = createEmptyRoutineExerciseDraft(1, type, () => `${type}-1`);
    const second = createEmptyRoutineExerciseDraft(2, type, () => `${type}-2`);
    first.name = `${type} estación uno`;
    first.videoUrl = libraryExerciseReferenceUrl(libraryExercise.id);
    assert.equal(second.name, "");
    assert.equal(second.videoUrl, "");
    assert.equal(second.libraryExerciseId, undefined);
  }
});

test("el editor integra Biblioteca BM por ejercicio y reinicia su selección", () => {
  assert.match(editor, /openLibraryFor\(exercise\.clientId\)/);
  assert.match(editor, /applyLibraryExerciseSelection\(current\.exercises, libraryTargetId, item\)/);
  assert.match(editor, /key=\{librarySession\}/);
  assert.match(editor, /createEmptyRoutineExerciseDraft\(order, type\)/);
  assert.match(editor, /name="intent" value="draft"/);
  assert.match(editor, /name="intent" value="activate"/);
  assert.match(editor, /videoUrl: persistedRoutineExerciseVideoUrl\(exercise\)/);
  assert.match(editor, /removeRoutineExerciseDraft\(current\.exercises, clientId\)/);
  assert.match(updateApi, /!retainedExerciseIds\.has\(exercise\.id\)/);
  assert.match(updateApi, /trainingRoutineExercise\.(?:update|delete)/);
});

test("el entrenador ve estado vinculado y nunca el identificador interno", () => {
  assert.match(editor, /"Biblioteca BM"/);
  assert.match(editor, /Ejercicio vinculado/);
  assert.match(editor, /media\.hasMedia && .*Demostración disponible/);
  assert.match(editor, /Ver demostración/);
  assert.match(editor, /Cambiar desde Biblioteca/);
  assert.match(editor, /Quitar vínculo/);
  assert.match(editor, /URL manual opcional o Biblioteca BM/);
  assert.match(editor, /input type="url"/);
  assert.match(editor, /library-video-linked/);
  assert.match(editor, /onMediaAvailabilityChange=\{setLibraryMediaEnabled\}/);
  assert.match(editor, /libraryExerciseId && media\.hasMedia && <RoutineExerciseMediaButton/);
  assert.match(globalStyles, /\.library-video-linked label:has\(> input\[type="url"\]\)/);
  assert.doesNotMatch(editor, /Video de Biblioteca BM vinculado/);
  assert.doesNotMatch(editor, /https:\/\/bm-training\.local\/api\/exercise-library\/media/);
});

test("la persistencia y el portal mantienen Observaciones como Indicaciones sin depender de media", () => {
  assert.match(routinesPersistence, /observations: input\.observations\?\.trim\(\) \?\? ""/);
  assert.match(routinesPersistence, /videoUrl: input\.videoUrl\?\.trim\(\) \|\| null/);
  assert.match(portal, /separateWorkoutInstructions\(programmed\?\.observations\)/);
  assert.match(portal, />Indicaciones<\/summary>/);
  assert.ok(portal.indexOf("programmed?.observations") < portal.indexOf("RoutineExerciseMediaButton exercise={programmed}"));
  assert.match(mediaComponent, /if \(!media\.hasMedia\) return null/);
});

test("Nueva rutina abre el selector de origen desde la acción principal y el acceso flotante", () => {
  assert.match(editor, /<TrainerFloatingActions/);
  assert.match(editor, /mode="direct"/);
  assert.match(editor, /label: "Nueva rutina"/);
  assert.match(editor, />\+ Nueva rutina<\/button>/);
  assert.match(editor, /setCreationOpen\(true\)/);
  assert.doesNotMatch(editor, /action=\{activeTab/);
});

test("actualizar usa un timeout explícito y reporta expiración transaccional", () => {
  assert.match(updateApi, /maxWait: 10_000/);
  assert.match(updateApi, /timeout: 30_000/);
  assert.match(updateApi, /error\.code === "P2028"/);
  assert.match(updateApi, /fue revertida de forma segura/);
  assert.match(updateApi, /export async function PUT/);
});

test("el alumno muestra detalle seguro, instrucciones y atribución sin duplicar video", () => {
  assert.match(portal, /RoutineExerciseMediaButton exercise=\{programmed\} libraryMediaEnabled=\{data\.exerciseMediaEnabled\} separated/);
  assert.match(portal, />Indicaciones<\/summary>/);
  assert.match(mediaComponent, /data-exercise-video-action/);
  assert.ok(portal.indexOf(">Indicaciones</summary>") < portal.indexOf("RoutineExerciseMediaButton exercise={programmed}"));
  assert.doesNotMatch(portal, />Ver técnica<\/summary>/);
  assert.doesNotMatch(portal, /Abrir video técnico/);
  assert.match(mediaComponent, /<ExerciseDetail exercise=\{activeLibraryExercise\}/);
  assert.doesNotMatch(mediaComponent, /Indicaci.n de tu entrenador|exercise\.observations &&/);
  assert.match(mediaComponent, /<ManualExerciseDetail exercise=\{exercise\}/);
  assert.match(mediaComponent, /<video controls playsInline/);
  assert.match(mediaComponent, /<iframe/);
  assert.match(mediaComponent, /Este video no puede reproducirse dentro de la aplicación/);
  assert.match(mediaComponent, /items-end/);
  assert.match(mediaComponent, /sm:items-center/);
  assert.match(mediaComponent, /sm:max-w-lg/);
  assert.doesNotMatch(mediaComponent, /window\.open|target="_blank"|<a\s+href=/);
  assert.doesNotMatch(mediaComponent, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(`${portal}\n${mediaComponent}`, /bm-library:\/\/|bm-training\.local/);
  assert.doesNotMatch(mediaComponent, />\{media\.mediaUrl\}</);
});

test("los circuitos usan thumbnail estático, abren el mismo detalle y conservan timers", () => {
  assert.match(portal, /RoutineExerciseMediaButton exercise=\{source\} libraryMediaEnabled=\{libraryMediaEnabled\} thumbnail/);
  assert.match(mediaComponent, /media\.thumbnailUrl/);
  assert.match(mediaComponent, /loading="lazy"/);
  assert.match(mediaComponent, /if \(!media\.hasMedia\) return null/);
  assert.doesNotMatch(mediaComponent.slice(0, mediaComponent.indexOf("{open &&")), /kind=\"gif\"/);
  assert.match(portal, /<WorkoutBlockTimer/);
  assert.match(portal, /isTimedBlockType\(block\.blockType\)/);
});
