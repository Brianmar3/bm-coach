import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import test from "node:test";
import { exerciseMediaAvailable, exerciseMediaConfiguration, resolveExerciseMediaSource } from "../lib/exercise-library-server.ts";

const mediaRoute = readFileSync(new URL("../app/api/exercise-library/media/route.ts", import.meta.url), "utf8");
const libraryComponent = readFileSync(new URL("../componentes/exercise-library.tsx", import.meta.url), "utf8");
const portalComponent = readFileSync(new URL("../componentes/portal-section.tsx", import.meta.url), "utf8");
const routineMediaComponent = readFileSync(new URL("../componentes/routine-exercise-media.tsx", import.meta.url), "utf8");

test("development usa provider local por defecto y producción queda deshabilitada", () => {
  assert.deepEqual(exerciseMediaConfiguration({ NODE_ENV: "development" }), { enabled: true, provider: "local", explicitlyConfigured: false });
  assert.deepEqual(exerciseMediaConfiguration({ NODE_ENV: "production" }), { enabled: false, provider: "local", explicitlyConfigured: false });
  assert.deepEqual(exerciseMediaConfiguration({ NODE_ENV: "production", EXERCISE_MEDIA_ENABLED: "true", EXERCISE_MEDIA_PROVIDER: "local" }), { enabled: true, provider: "local", explicitlyConfigured: true });
});

test("producción no asume que el filesystem existe aunque el flag esté activo", async () => {
  const missingRoot = path.join(tmpdir(), `bm-missing-media-${Date.now()}`);
  const env = { NODE_ENV: "production", EXERCISE_MEDIA_ENABLED: "true", EXERCISE_MEDIA_PROVIDER: "local" };
  assert.equal(await exerciseMediaAvailable(env, missingRoot), false);
  assert.deepEqual(await resolveExerciseMediaSource("videos/demo.gif", { env, projectRoot: missingRoot }), { kind: "unavailable", reason: "ASSET_NOT_FOUND" });
});

test("provider local sólo queda disponible con directorios y asset reales", async (context) => {
  const projectRoot = await mkdtemp(path.join(tmpdir(), "bm-exercise-media-"));
  context.after(() => rm(projectRoot, { recursive: true, force: true }));
  const datasetRoot = path.join(projectRoot, "external", "exercises-dataset-main");
  await mkdir(path.join(datasetRoot, "images"), { recursive: true });
  await mkdir(path.join(datasetRoot, "videos"), { recursive: true });
  await writeFile(path.join(datasetRoot, "images", "demo.jpg"), "image");
  await writeFile(path.join(datasetRoot, "videos", "demo.gif"), "gif");
  const env = { NODE_ENV: "production", EXERCISE_MEDIA_ENABLED: "true", EXERCISE_MEDIA_PROVIDER: "local" };
  assert.equal(await exerciseMediaAvailable(env, projectRoot), true);
  const source = await resolveExerciseMediaSource("videos/demo.gif", { env, projectRoot });
  assert.equal(source.kind, "local");
  if (source.kind === "local") assert.equal(source.filePath, path.join(datasetRoot, "videos", "demo.gif"));
});

test("flag false y provider remoto sin configurar fallan de forma segura", async () => {
  assert.deepEqual(await resolveExerciseMediaSource("videos/demo.gif", { env: { NODE_ENV: "development", EXERCISE_MEDIA_ENABLED: "false" } }), { kind: "unavailable", reason: "DISABLED" });
  assert.deepEqual(await resolveExerciseMediaSource("videos/demo.gif", { env: { NODE_ENV: "production", EXERCISE_MEDIA_ENABLED: "true", EXERCISE_MEDIA_PROVIDER: "remote" } }), { kind: "unavailable", reason: "REMOTE_NOT_CONFIGURED" });
  assert.deepEqual(await resolveExerciseMediaSource("../secret.txt", { env: { NODE_ENV: "development" } }), { kind: "unavailable", reason: "INVALID_PATH" });
});

test("el endpoint responde 404 genérico cuando el asset no está disponible", () => {
  assert.match(mediaRoute, /resolveExerciseMediaSource\(relative\)/);
  assert.match(mediaRoute, /source\.kind === "unavailable"/);
  assert.match(mediaRoute, /"Medio no disponible\.".*status: 404/s);
  assert.doesNotMatch(mediaRoute, /source\.reason|filePath.*Response\.json/);
});

test("Biblioteca y circuitos omiten media ausente sin ocultar instrucciones", () => {
  assert.doesNotMatch(libraryComponent, /Media deshabilitado|Sin imagen/);
  assert.match(libraryComponent, /if \(!src\) return null/);
  assert.match(libraryComponent, /instructionStepsEs\.length/);
  assert.match(libraryComponent, /Instrucciones del ejercicio/);
  assert.match(routineMediaComponent, /if \(!media\.hasMedia\) return null/);
  assert.match(portalComponent, /libraryMediaEnabled=\{libraryMediaEnabled\} thumbnail/);
});

test("videos manuales siguen independientes del flag de Biblioteca", () => {
  assert.match(routineMediaComponent, /media\.source === "LIBRARY"/);
  assert.match(routineMediaComponent, /media\.mediaUrl && <ManualExerciseDetail/);
  assert.match(routineMediaComponent, /<video controls playsInline/);
  assert.match(routineMediaComponent, /<iframe/);
  assert.doesNotMatch(routineMediaComponent, /window\.open|target="_blank"|bm-training\.local/);
});

test("Indicaciones usa observaciones y no se duplica dentro de Ver video", () => {
  assert.match(portalComponent, /separateWorkoutInstructions\(programmed\?\.observations\)/);
  assert.match(portalComponent, />Indicaciones<\/summary>/);
  assert.doesNotMatch(portalComponent, />Ver técnica<\/summary>/);
  assert.match(portalComponent, /instructions\.technicalText && <details/);
  assert.doesNotMatch(routineMediaComponent, /Indicaci.n de tu entrenador|trainerInstruction/);
  assert.match(routineMediaComponent, /<ExerciseDetail exercise=\{activeLibraryExercise\} mediaEnabled/);
});
