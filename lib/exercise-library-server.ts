import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { BMExercise } from "../types/exercise-library";

export type ExerciseMediaProvider = "local" | "remote" | "invalid";
export type ExerciseMediaConfiguration = {
  enabled: boolean;
  provider: ExerciseMediaProvider;
  explicitlyConfigured: boolean;
};
export type ExerciseMediaSource =
  | { kind: "local"; filePath: string }
  | { kind: "unavailable"; reason: "DISABLED" | "INVALID_PATH" | "INVALID_PROVIDER" | "REMOTE_NOT_CONFIGURED" | "ASSET_NOT_FOUND" };

let libraryPromise: Promise<BMExercise[]> | null = null;
export function loadExerciseLibrary() {
  libraryPromise ??= readFile(path.join(process.cwd(), "data", "bm-exercise-library.json"), "utf8").then((value) => JSON.parse(value) as BMExercise[]);
  return libraryPromise;
}

export function exerciseMediaConfiguration(env: NodeJS.ProcessEnv = process.env): ExerciseMediaConfiguration {
  const configuredFlag = env.EXERCISE_MEDIA_ENABLED?.trim().toLowerCase();
  const configuredProvider = env.EXERCISE_MEDIA_PROVIDER?.trim().toLowerCase();
  return {
    enabled: configuredFlag ? configuredFlag === "true" : env.NODE_ENV === "development",
    provider: !configuredProvider || configuredProvider === "local" ? "local" : configuredProvider === "remote" ? "remote" : "invalid",
    explicitlyConfigured: Boolean(configuredFlag),
  };
}

function datasetRoot(projectRoot: string) {
  return path.resolve(projectRoot, "external", "exercises-dataset-main");
}

export async function exerciseMediaAvailable(env: NodeJS.ProcessEnv = process.env, projectRoot = process.cwd()) {
  const configuration = exerciseMediaConfiguration(env);
  if (!configuration.enabled || configuration.provider !== "local") return false;
  try {
    const [images, videos] = await Promise.all([
      readdir(path.join(datasetRoot(projectRoot), "images")),
      readdir(path.join(datasetRoot(projectRoot), "videos")),
    ]);
    return images.length > 0 && videos.length > 0;
  } catch {
    return false;
  }
}

export async function resolveExerciseMediaSource(relativePath: string, options: { env?: NodeJS.ProcessEnv; projectRoot?: string } = {}): Promise<ExerciseMediaSource> {
  const env = options.env ?? process.env;
  const projectRoot = options.projectRoot ?? process.cwd();
  const configuration = exerciseMediaConfiguration(env);
  if (!configuration.enabled) return { kind: "unavailable", reason: "DISABLED" };
  if (!/^(images|videos)\/[a-zA-Z0-9._-]+$/.test(relativePath)) return { kind: "unavailable", reason: "INVALID_PATH" };
  if (configuration.provider === "invalid") return { kind: "unavailable", reason: "INVALID_PROVIDER" };
  if (configuration.provider === "remote") return { kind: "unavailable", reason: "REMOTE_NOT_CONFIGURED" };
  const filePath = `${datasetRoot(projectRoot)}${path.sep}${relativePath.replaceAll("/", path.sep)}`;
  try {
    await access(filePath);
    return { kind: "local", filePath };
  } catch {
    return { kind: "unavailable", reason: "ASSET_NOT_FOUND" };
  }
}
