import { readFile } from "node:fs/promises";
import path from "node:path";

export const BM_ID = /^bm:([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;
export const BM_MEDIA_PATH = /^exercise-media\/bm\/[0-9a-f-]{36}\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|gif|webp)$/;
export const CUSTOM_FILE = "bm-exercise-library-custom.json";

export function normalizeExerciseName(value) {
  const abbreviations = { bb: "barbell", db: "dumbbell", kb: "kettlebell", bw: "body weight" };
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).map(token => abbreviations[token] ?? token).join(" ");
}

const required = ["name", "displayNameEs", "bodyPart", "bodyPartLabelEs", "equipment", "equipmentLabelEs", "targetMuscle", "targetMuscleLabelEs"];
const optional = ["displayName", "muscleGroup", "muscleGroupLabelEs", "instructionsEs", "thumbnailPath", "gifPath", "attribution"];
const arrays = ["aliases", "secondaryMuscles", "secondaryMusclesEs", "instructionStepsEs"];
const derived = ["sourceId", "source", "translationStatus", "translationPass", "searchableText"];

/** Canonical BMExercise shape; derived values cannot override its identity or index. */
export function validateCustomExercise(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("El ejercicio debe ser un objeto JSON.");
  const allowed = new Set(["id", ...required, ...optional, ...arrays, ...derived]);
  for (const field of Object.keys(input)) if (!allowed.has(field)) throw new Error(`Campo desconocido: ${field}`);
  const uuid = typeof input.id === "string" && BM_ID.exec(input.id)?.[1];
  if (!uuid) throw new Error("ID inválido: se requiere bm:<UUID> en minúsculas.");
  const strings = {};
  for (const field of [...required, ...optional]) {
    const value = input[field];
    if ((required.includes(field) && (typeof value !== "string" || !value.trim())) || (value !== undefined && (typeof value !== "string" || (!value.trim() && field !== "instructionsEs")))) throw new Error(`Campo inválido: ${field}`);
    if (value !== undefined) strings[field] = value.trim();
  }
  const lists = {};
  for (const field of arrays) {
    const value = input[field] === undefined ? [] : input[field];
    if (!Array.isArray(value) || value.some(item => typeof item !== "string" || !item.trim())) throw new Error(`Lista inválida: ${field}`);
    lists[field] = [...new Set(value.map(item => item.trim()))];
  }
  for (const field of ["thumbnailPath", "gifPath"]) {
    if (strings[field] && (!BM_MEDIA_PATH.test(strings[field]) || !strings[field].startsWith(`exercise-media/bm/${uuid}/`) || (field === "gifPath" && !strings[field].endsWith(".gif")))) throw new Error(`Media inválida: ${field}; usar un archivo local propio bajo exercise-media/bm/${uuid}/.`);
  }
  const fixed = { sourceId: uuid, source: "BM_CUSTOM", translationStatus: "EXCEPTION", translationPass: 1 };
  for (const field of Object.keys(fixed)) if (input[field] !== undefined && input[field] !== fixed[field]) throw new Error(`Campo derivado inválido: ${field}`);
  const result = { ...strings, ...lists, id: input.id, ...fixed,
    displayName: strings.displayName ?? strings.displayNameEs,
    muscleGroup: strings.muscleGroup ?? strings.targetMuscle,
    muscleGroupLabelEs: strings.muscleGroupLabelEs ?? strings.targetMuscleLabelEs,
    instructionsEs: strings.instructionsEs ?? lists.instructionStepsEs.join("\n") };
  result.searchableText = normalizeExerciseName([result.name, result.displayName, result.displayNameEs, ...result.aliases, result.bodyPart, result.bodyPartLabelEs, result.equipment, result.equipmentLabelEs, result.targetMuscle, result.targetMuscleLabelEs, result.muscleGroup, result.muscleGroupLabelEs, ...result.secondaryMuscles, ...result.secondaryMusclesEs].join(" "));
  return result;
}

export function assembleExerciseLibrary(base, custom) {
  if (!Array.isArray(base) || !Array.isArray(custom)) throw new Error("Ambas fuentes deben contener arrays JSON.");
  const own = custom.map(validateCustomExercise);
  const ids = new Set();
  for (const item of [...base, ...own]) {
    if (typeof item.id !== "string" || !item.id || ids.has(item.id)) throw new Error(`ID ausente o duplicado: ${item.id}`);
    ids.add(item.id);
  }
  return [...base, ...own];
}

export async function readExerciseCatalog(root = process.cwd()) {
  const [base, custom] = await Promise.all(["bm-exercise-library.json", CUSTOM_FILE].map(file => readFile(path.join(root, "data", file), "utf8").then(JSON.parse)));
  return { base, custom, items: assembleExerciseLibrary(base, custom) };
}

const names = item => [...new Set([item.name, item.displayNameEs, item.displayName, ...(item.aliases ?? [])].filter(Boolean).map(normalizeExerciseName))];
const bigrams = name => new Set(Array.from({ length: Math.max(0, name.length - 1) }, (_, i) => name.slice(i, i + 2)));
function similarity(a, b) {
  if (a === b) return 1;
  const x = bigrams(a), y = bigrams(b);
  return x.size + y.size ? 2 * [...x].filter(value => y.has(value)).length / (x.size + y.size) : 0;
}

/** Advisory only: Spanish names and existing aliases supply known translations. */
export function findSimilarExercises(candidate, items) {
  const candidateNames = names(candidate);
  return items.filter(item => item.id !== candidate.id).flatMap(item => {
    const scores = candidateNames.flatMap(a => names(item).map(b => similarity(a, b)));
    const score = Math.max(0, ...scores);
    if (score < 0.82) return [];
    const differentEquipment = candidate.equipment !== item.equipment;
    const differentTarget = candidate.targetMuscle !== item.targetMuscle;
    return [{ id: item.id, name: item.displayNameEs || item.name, source: item.source, score,
      match: score === 1 ? "EXACT_NAME_OR_ALIAS" : "SIMILAR_NAME",
      possibleVariant: differentEquipment || differentTarget,
      differences: [differentEquipment && `equipamiento: ${item.equipment}`, differentTarget && `músculo: ${item.targetMuscle}`].filter(Boolean) }];
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
