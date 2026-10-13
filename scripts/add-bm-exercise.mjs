import { readFile, open, rename, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { CUSTOM_FILE, validateCustomExercise, readExerciseCatalog, assembleExerciseLibrary, findSimilarExercises } from "../lib/exercise-library-catalog.mjs";

export async function addBMExercise({ inputPath, write = false, root = process.cwd(), report = console.log }) {
  const input = JSON.parse(await readFile(inputPath, "utf8"));
  const exercise = validateCustomExercise({ ...input, id: input.id ?? `bm:${randomUUID()}` });
  const destination = path.join(root, "data", CUSTOM_FILE);
  if (path.resolve(inputPath) === path.resolve(destination) || path.resolve(inputPath) === path.join(root, "data", "bm-exercise-library.json")) throw new Error("Usá un JSON de entrada independiente de las fuentes.");
  let lock;
  const temporary = `${destination}.${randomUUID()}.tmp`;
  try {
    if (write) lock = await open(`${destination}.lock`, "wx");
    const catalog = await readExerciseCatalog(root);
    assembleExerciseLibrary(catalog.items, [exercise]);
    const similar = findSimilarExercises(exercise, catalog.items);
    report(JSON.stringify({ mode: write ? "WRITE" : "PREVIEW", exercise, warning: similar.length ? "Encontramos ejercicios similares. Revisar antes de incorporar; no se fusionan ni bloquean variantes." : null, similar }, null, 2));
    if (write) {
      await open(temporary, "wx").then(async file => { try { await file.writeFile(JSON.stringify([...catalog.custom, exercise], null, 2) + "\n", "utf8"); await file.sync(); } finally { await file.close(); } });
      await rename(temporary, destination);
    }
    return { exercise, similar, written: write };
  } finally {
    await unlink(temporary).catch(error => { if (error.code !== "ENOENT") throw error; });
    if (lock) { await lock.close(); await unlink(`${destination}.lock`); }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if ((args.length !== 2 && args.length !== 3) || args[0] !== "--input" || !args[1] || (args.length === 3 && args[2] !== "--write")) throw new Error("Uso: npm run exercise-library:add -- --input <ejercicio.json> [--write]. Sin --write sólo valida y muestra una vista previa.");
    await addBMExercise({ inputPath: args[1], write: args.includes("--write") });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
