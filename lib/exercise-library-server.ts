import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BMExercise } from "@/types/exercise-library";

let libraryPromise: Promise<BMExercise[]> | null = null;
export function loadExerciseLibrary() {
  libraryPromise ??= readFile(path.join(process.cwd(), "data", "bm-exercise-library.json"), "utf8").then((value) => JSON.parse(value) as BMExercise[]);
  return libraryPromise;
}

export function exerciseMediaEnabled() {
  if (process.env.EXERCISE_MEDIA_ENABLED) return process.env.EXERCISE_MEDIA_ENABLED === "true";
  return process.env.NODE_ENV === "development";
}

export function datasetMediaPath(relativePath: string) {
  const datasetRoot = path.resolve(process.cwd(), "external", "exercises-dataset-main");
  if (!/^(images|videos)\/[a-zA-Z0-9._-]+$/.test(relativePath)) return null;
  return `${datasetRoot}${path.sep}${relativePath.replaceAll("/", path.sep)}`;
}
