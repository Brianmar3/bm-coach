import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { EXERCISE_LIBRARY_PAGE_SIZE, exerciseLibraryFacets, exerciseLibrarySummaries, filterExerciseLibrary, getExerciseMediaUrl, normalizeLibraryText, paginateExerciseLibrary, resolveExerciseLibraryMatch } from "../lib/exercise-library.ts";
import type { BMExercise } from "../types/exercise-library.ts";

const library = JSON.parse(readFileSync(new URL("../data/bm-exercise-library.json", import.meta.url), "utf8")) as BMExercise[];
const source = JSON.parse(readFileSync(new URL("../external/exercises-dataset-main/data/exercises.json", import.meta.url), "utf8")) as Array<{ id: string; name: string; body_part: string; equipment: string; target: string; secondary_muscles: string[]; instructions: { es: string }; instruction_steps: { es: string[] }; image?: string; gif_url?: string; attribution?: string }>;
const sourceById = new Map(source.map((item) => [item.id, item]));
const component = readFileSync(new URL("../componentes/exercise-library.tsx", import.meta.url), "utf8");
const apiRoute = readFileSync(new URL("../app/api/exercise-library/route.ts", import.meta.url), "utf8");
const editor = readFileSync(new URL("../app/rutinas/page.tsx", import.meta.url), "utf8");
const server = readFileSync(new URL("../lib/exercise-library-server.ts", import.meta.url), "utf8");
const nextConfig = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
const audit = JSON.parse(readFileSync(new URL("../reports/exercise-library-audit.json", import.meta.url), "utf8"));
const translationAudit = JSON.parse(readFileSync(new URL("../reports/exercise-library-translation-audit.json", import.meta.url), "utf8"));

test("carga los 1.324 ejercicios con IDs únicos", () => {
  assert.equal(source.length, 1324);
  assert.equal(library.length, 1324);
  assert.equal(new Set(library.map((item) => item.id)).size, 1324);
  assert.deepEqual(library.map((item) => item.sourceId).toSorted(), source.map((item) => item.id).toSorted());
  assert.ok(library.every((item) => item.id === `dataset:${item.sourceId}`));
});

test("la proyección usada por la API conserva los 1.324 registros", () => {
  assert.equal(exerciseLibrarySummaries(library).length, 1324);
  assert.match(apiRoute, /total: library\.length/);
  assert.match(apiRoute, /exerciseLibrarySummaries\(library\)/);
});

test("preserva todos los campos obligatorios y el español real", () => {
  for (const [index, item] of library.entries()) {
    const original = sourceById.get(item.sourceId)!;
    assert.ok(item.name && item.equipment && item.targetMuscle && item.bodyPart, `registro ${index}`);
    assert.equal(item.name, original.name);
    assert.equal(item.equipment, original.equipment);
    assert.equal(item.bodyPart, original.body_part);
    assert.equal(item.targetMuscle, original.target);
    assert.ok(item.displayNameEs && item.equipmentLabelEs && item.bodyPartLabelEs && item.targetMuscleLabelEs, `localización ${item.id}`);
    assert.ok(item.instructionsEs, `instructions.es ${item.id}`);
    assert.ok(item.instructionStepsEs.length, `instruction_steps.es ${item.id}`);
    assert.equal(item.instructionsEs, original.instructions.es);
    assert.deepEqual(item.instructionStepsEs, original.instruction_steps.es);
    assert.equal(item.thumbnailPath, original.image);
    assert.equal(item.gifPath, original.gif_url);
    assert.equal(item.attribution, original.attribution);
  }
});

test("deriva filtros del catálogo real", () => {
  const facets = exerciseLibraryFacets(library);
  assert.ok(facets.equipment.some((item) => item.value === "barbell" && item.label === "Barra"));
  assert.ok(facets.bodyParts.some((item) => item.value === "chest" && item.label === "Pecho"));
  assert.ok(facets.targets.some((item) => item.value === "pectorals" && item.label === "Pectorales"));
  assert.deepEqual(facets.equipment.map((item) => item.label), facets.equipment.map((item) => item.label).toSorted((a, b) => a.localeCompare(b, "es")));
});

test("filtra por equipamiento, parte corporal y target", () => {
  assert.ok(filterExerciseLibrary(library, { equipment: "barbell" }).every((item) => item.equipment === "barbell"));
  assert.ok(filterExerciseLibrary(library, { bodyPart: "back" }).every((item) => item.bodyPart === "back"));
  assert.ok(filterExerciseLibrary(library, { targetMuscle: "biceps" }).every((item) => item.targetMuscle === "biceps"));
});

test("busca parcialmente por nombre y equipamiento", () => {
  const bench = filterExerciseLibrary(library, { query: "bench" });
  const barbell = filterExerciseLibrary(library, { query: "barbell" });
  assert.ok(bench.length > 0 && bench.some((item) => normalizeLibraryText(item.name).includes("bench")));
  assert.ok(barbell.length > 0 && barbell.some((item) => item.equipment === "barbell"));
});

test("las búsquedas de control recorren el catálogo completo", () => {
  for (const query of ["bench", "deadlift", "curl", "barbell", "dumbbell", "ez barbell", "shoulders", "glutes"]) {
    assert.ok(filterExerciseLibrary(library, { query }).length > 0, query);
  }
});

test("la búsqueda funciona en español e inglés", () => {
  for (const query of ["peso muerto", "sentadilla", "remo", "pecho", "espalda", "mancuerna", "barra", "glúteos", "bíceps"]) assert.ok(filterExerciseLibrary(library, { query }).length > 0, query);
  for (const query of ["deadlift", "squat", "row", "bench", "barbell"]) assert.ok(filterExerciseLibrary(library, { query }).length > 0, query);
});

test("localiza implementos, partes, músculos y secundarios sin alterar fuentes", () => {
  const hipThrust = library.find((item) => item.name === "barbell lying lifting (on hip)")!;
  assert.equal(hipThrust.displayNameEs, "Hip thrust con barra");
  assert.equal(hipThrust.equipment, "barbell");
  assert.equal(hipThrust.equipmentLabelEs, "Barra");
  assert.equal(hipThrust.targetMuscleLabelEs, "Glúteos");
  assert.ok(hipThrust.secondaryMusclesEs.every((item, index) => item !== hipThrust.secondaryMuscles[index]));
});

test("los movimientos de control usan terminología natural de gimnasio", () => {
  const expected = new Map([
    ["barbell bench press", "Press de banca con barra"],
    ["barbell incline bench press", "Press de banca inclinado con barra"],
    ["barbell full squat", "Sentadilla trasera con barra"],
    ["barbell front squat", "Sentadilla frontal con barra"],
    ["dumbbell goblet squat", "Sentadilla goblet con mancuerna"],
    ["barbell romanian deadlift", "Peso muerto rumano con barra"],
    ["barbell deadlift", "Peso muerto convencional con barra"],
    ["barbell lying lifting (on hip)", "Hip thrust con barra"],
    ["barbell bent over row", "Remo inclinado con barra"],
    ["cable lat pulldown full range of motion", "Jalón al pecho en polea con recorrido completo"],
    ["pull-up", "Dominada pronada"],
    ["dumbbell seated shoulder press", "Press de hombros sentado con mancuerna"],
    ["dumbbell lateral raise", "Elevación lateral con mancuernas"],
    ["dumbbell biceps curl", "Curl de bíceps con mancuerna"],
    ["dumbbell hammer curl", "Curl martillo con mancuernas"],
    ["cable triceps pushdown (v-bar)", "Extensión de tríceps en polea con barra V"],
    ["lever leg extension", "Extensión de cuádriceps en máquina"],
    ["lever seated leg curl", "Curl femoral sentado en máquina"],
    ["barbell standing calf raise", "Elevación de gemelos de pie con barra"],
    ["front plank with twist", "Plancha frontal con giro"],
    ["burpee", "Burpee"],
    ["kettlebell swing", "Swing con kettlebell"],
    ["barbell thruster", "Thruster con barra"]
  ]);
  for (const [name, displayNameEs] of expected) assert.equal(library.find((item) => item.name === name)?.displayNameEs, displayNameEs, name);
});

test("la búsqueda encuentra ejercicios fuera de la primera página", () => {
  const outsideFirstPage = library[EXERCISE_LIBRARY_PAGE_SIZE + 25];
  const results = filterExerciseLibrary(library, { query: outsideFirstPage.name });
  assert.ok(results.some((item) => item.id === outsideFirstPage.id));
});

test("combina búsqueda y filtros", () => {
  const results = filterExerciseLibrary(library, { query: "press", equipment: "barbell", targetMuscle: "pectorals" });
  assert.ok(results.length > 0);
  assert.ok(results.every((item) => item.equipment === "barbell" && item.targetMuscle === "pectorals"));
});

test("normaliza tildes, puntuación, espacios y abreviaturas simples", () => {
  assert.equal(normalizeLibraryText("  PÉCHO--Press  "), "pecho press");
  assert.equal(normalizeLibraryText("DB curl"), "dumbbell curl");
});

test("resuelve coincidencias sin reemplazar ambigüedades", () => {
  assert.equal(resolveExerciseLibraryMatch(library[0].name, library).status, "EXACT");
  assert.equal(resolveExerciseLibraryMatch("nombre inexistente BM", library).status, "NO_MATCH");
  assert.ok(audit.libraryAmbiguities.length > 0);
});

test("detalle usa instrucciones españolas sin duplicar indicaciones del entrenador", () => {
  assert.match(component, /instructionStepsEs\.length/);
  assert.match(component, /instructionsEs/);
  assert.doesNotMatch(component, /Indicación de tu entrenador|trainerInstruction/);
  assert.match(component, /secondaryMusclesEs/);
  assert.match(component, /displayNameEs/);
  assert.match(component, /targetMuscleLabelEs/);
  assert.match(component, /equipmentLabelEs/);
});

test("las traducciones REVIEW conservan un fallback seguro y quedan auditadas", () => {
  const review = library.filter((item) => item.translationStatus === "REVIEW");
  assert.equal(review.length, translationAudit.review);
  assert.ok(review.length > 0);
  assert.ok(review.every((item) => item.displayNameEs === item.name));
  assert.equal(translationAudit.total, 1324);
  assert.equal(translationAudit.automaticallyTranslated + translationAudit.translatedByException + translationAudit.review, 1324);
});

test("la segunda pasada supera 95% sin modificar los 1.013 nombres ya aceptados", () => {
  assert.equal(translationAudit.previousReview, 311);
  assert.equal(translationAudit.previouslyAcceptedModified, 0);
  assert.equal(translationAudit.secondPassResolved + translationAudit.remainingReview, 311);
  assert.equal(translationAudit.remainingReview, translationAudit.review);
  assert.ok(translationAudit.secondPassResolved > 0);
  assert.ok(translationAudit.remainingReview < translationAudit.previousReview);
  assert.ok(translationAudit.coveragePercentage >= 95);
  assert.equal(translationAudit.reliableTranslations + translationAudit.review, 1324);
});

test("marca la pasada de traducción y conserva aliases en español e inglés", () => {
  const secondPass = library.filter((item) => item.translationPass === 2);
  assert.equal(secondPass.length, translationAudit.secondPassResolved);
  assert.ok(secondPass.length > 0);
  for (const item of secondPass) {
    assert.notEqual(item.translationStatus, "REVIEW");
    assert.ok(item.aliases.includes(item.name), item.name);
    assert.ok(item.aliases.includes(item.displayNameEs), item.displayNameEs);
    assert.ok(item.searchableText.includes(normalizeLibraryText(item.name)), item.name);
    assert.ok(item.searchableText.includes(normalizeLibraryText(item.displayNameEs)), item.displayNameEs);
  }
  assert.ok(library.every((item) => item.translationPass === 1 || item.translationPass === 2));
});

test("encuentra nombres resueltos en la segunda pasada en ambos idiomas", () => {
  const controls = [
    ["barbell zercher squat", "sentadilla zercher"],
    ["dumbbell cuban press", "press cubano"],
    ["scapular pull-up", "dominada escapular"],
    ["world greatest stretch", "mejor estiramiento del mundo"],
    ["walking on stepmill", "caminata en escaladora"]
  ];
  for (const [english, spanish] of controls) {
    const expected = library.find((item) => item.name === english)!;
    assert.equal(expected.translationPass, 2, english);
    assert.ok(filterExerciseLibrary(library, { query: english }).some((item) => item.id === expected.id), english);
    assert.ok(filterExerciseLibrary(library, { query: spanish }).some((item) => item.id === expected.id), spanish);
  }
});

test("la auditoría de segunda pasada no detecta patrones básicos sospechosos", () => {
  assert.equal(translationAudit.qualityValidation.scope, "SECOND_PASS_ACCEPTED");
  assert.equal(translationAudit.qualityValidation.checked, translationAudit.secondPassResolved);
  assert.equal(translationAudit.qualityValidation.warnings, 0);
  assert.deepEqual(translationAudit.qualityWarnings, []);
});

test("los pendientes finales incluyen contexto y sugerencia manual sin traducción inventada", () => {
  assert.ok(translationAudit.pending.length > 0);
  for (const item of translationAudit.pending) {
    assert.ok(item.sourceId && item.name && item.equipment && item.targetMuscle && item.bodyPart);
    assert.ok(item.reason && item.firstPassReason && item.suggestion);
    assert.equal(item.displayNameEs, item.name);
  }
});

test("media deshabilitado usa fallback y habilitado resuelve una URL", () => {
  const item = library.find((exercise) => exercise.thumbnailPath && exercise.gifPath)!;
  assert.equal(getExerciseMediaUrl(item, "thumbnail", false), null);
  assert.match(getExerciseMediaUrl(item, "thumbnail", true) ?? "", /^\/api\/exercise-library\/media\?/);
  assert.ok(item.attribution);
});

test("el grid usa thumbnail lazy y no GIF", () => {
  const thumbnailSection = component.slice(component.indexOf("export function ExerciseThumbnail"), component.indexOf("export function ExerciseMedia"));
  assert.match(thumbnailSection, /loading="lazy"/);
  assert.doesNotMatch(thumbnailSection, /"gif"/);
  assert.match(component, /paginateExerciseLibrary\(filtered, visibleCount\)/);
  assert.doesNotMatch(component, /catalog\.items\.slice/);
});

test("la página visible limita render sin reducir el catálogo y Cargar más avanza", () => {
  assert.equal(EXERCISE_LIBRARY_PAGE_SIZE, 60);
  assert.equal(paginateExerciseLibrary(library, EXERCISE_LIBRARY_PAGE_SIZE).length, 60);
  assert.equal(paginateExerciseLibrary(library, EXERCISE_LIBRARY_PAGE_SIZE * 2).length, 120);
  assert.match(component, /Cargar más/);
  assert.match(component, /current \+ EXERCISE_LIBRARY_PAGE_SIZE/);
});

test("muestra contador total y contador filtrado", () => {
  assert.match(component, /catalog\.total\.toLocaleString/);
  assert.match(component, /filtered\.length\.toLocaleString/);
  assert.match(component, /Mostrando 1–/);
  assert.equal(filterExerciseLibrary(library, { equipment: "ez barbell" }).length, library.filter((item) => item.equipment === "ez barbell").length);
});

test("conserva ejercicios de igual nombre cuando tienen IDs distintos", () => {
  const names = new Map<string, BMExercise[]>();
  for (const exercise of library) names.set(exercise.name, [...(names.get(exercise.name) ?? []), exercise]);
  const duplicateName = [...names.values()].find((items) => new Set(items.map((item) => item.id)).size > 1);
  assert.ok(duplicateName);
  assert.equal(filterExerciseLibrary(library, { query: duplicateName[0].name }).filter((item) => item.name === duplicateName[0].name).length, duplicateName.length);
});

test("mantiene selector de biblioteca y edición manual en Rutinas", () => {
  assert.match(editor, /Buscar en Biblioteca BM/);
  assert.match(editor, /createEmptyRoutineExerciseDraft/);
  assert.match(editor, /value=\{exercise\.name\}/);
  assert.match(editor, /name: exercise\.name/);
});

test("una rutina legacy sigue funcionando y la referencia BM persiste en videoUrl", () => {
  const payload = editor.slice(editor.indexOf("const payload ="), editor.indexOf("setSaving(true)"));
  assert.doesNotMatch(payload, /libraryExerciseId:/);
  assert.match(payload, /name: exercise\.name/);
  assert.match(payload, /videoUrl: exercise\.videoUrl/);
});

test("rutas de media no dependen de C:\\ ni cargan archivos en el bundle", () => {
  assert.match(server, /process\.cwd\(\)/);
  assert.doesNotMatch(server, /C:\\\\/);
  assert.doesNotMatch(component, /external\/exercises-dataset-main/);
  assert.doesNotMatch(component, /\.gif['"]/);
  assert.match(nextConfig, /outputFileTracingExcludes/);
  assert.match(nextConfig, /exercises-dataset-main\/videos/);
});

test("el reporte real es de solo lectura y clasifica coincidencias", () => {
  assert.equal(audit.readOnly, true);
  assert.equal(audit.dataset.exercises, 1324);
  assert.equal(audit.bmData.distinctNames, 62);
  assert.equal(library.length, 1324);
  assert.equal(audit.bmData.databaseAvailable, true);
  assert.equal(Object.values(audit.bmData.summary).reduce((sum: number, value) => sum + Number(value), 0), audit.bmData.distinctNames);
  assert.equal(Object.values(audit.bmData.sourceSummary).reduce((sum: number, value) => sum + Number(value), 0), audit.bmData.distinctSourceNames);
});
