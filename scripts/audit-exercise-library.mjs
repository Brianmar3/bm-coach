import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

for (const file of [".env", ".env.local"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
}

const normalize = (value) => {
  const abbreviations = { bb: "barbell", db: "dumbbell", kb: "kettlebell", bw: "body weight" };
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ").split(" ").map((token) => abbreviations[token] ?? token).join(" ");
};
const root = process.cwd();
const library = JSON.parse(await readFile(path.join(root, "data", "bm-exercise-library.json"), "utf8"));
const exactIndex = new Map();
const normalizedIndex = new Map();
for (const exercise of library) {
  for (const value of [exercise.name, exercise.displayName, ...exercise.aliases]) {
    if (!exactIndex.has(value)) exactIndex.set(value, new Set());
    exactIndex.get(value).add(exercise.id);
    const key = normalize(value);
    if (!normalizedIndex.has(key)) normalizedIndex.set(key, new Set());
    normalizedIndex.get(key).add(exercise.id);
  }
}
const occurrences = new Map();
const collect = (source, values) => {
  for (const value of values) {
    const name = typeof value === "string" ? value.trim() : "";
    if (!name) continue;
    const key = `${source}\u0000${name}`;
    occurrences.set(key, { source, name, count: (occurrences.get(key)?.count ?? 0) + 1 });
  }
};

const prisma = new PrismaClient();
let databaseAvailable = true;
let databaseError = null;
try {
  const [routine, quick, strength, classLogs, workoutLogs] = await Promise.all([
    prisma.trainingRoutineExercise.findMany({ select: { name: true, alternativeExercise: true } }),
    prisma.quickLog.findMany({ select: { exerciseName: true } }),
    prisma.classStrengthExercise.findMany({ select: { exerciseName: true } }),
    prisma.classExerciseLog.findMany({ select: { exerciseNameSnapshot: true } }),
    prisma.workoutExerciseLog.findMany({ select: { exerciseName: true } }),
  ]);
  collect("TrainingRoutineExercise.name", routine.map((row) => row.name));
  collect("TrainingRoutineExercise.alternativeExercise", routine.map((row) => row.alternativeExercise));
  collect("QuickLog.exerciseName", quick.map((row) => row.exerciseName));
  collect("ClassStrengthExercise.exerciseName", strength.map((row) => row.exerciseName));
  collect("ClassExerciseLog.exerciseNameSnapshot", classLogs.map((row) => row.exerciseNameSnapshot));
  collect("WorkoutExerciseLog.exerciseName", workoutLogs.map((row) => row.exerciseName));
} catch (error) {
  databaseAvailable = false;
  databaseError = error instanceof Error ? error.constructor.name : "DatabaseError";
} finally {
  await prisma.$disconnect();
}

const matches = [...occurrences.values()].map((entry) => {
  const exact = [...(exactIndex.get(entry.name) ?? [])];
  const normalized = [...(normalizedIndex.get(normalize(entry.name)) ?? [])];
  const exerciseIds = exact.length ? exact : normalized;
  const status = exerciseIds.length > 1 ? "AMBIGUOUS" : exact.length === 1 ? "EXACT" : normalized.length === 1 ? "NORMALIZED" : "NO_MATCH";
  return { ...entry, normalizedName: normalize(entry.name), status, exerciseIds };
}).sort((a, b) => a.source.localeCompare(b.source) || a.name.localeCompare(b.name, "es"));
const sourceSummary = { EXACT: 0, NORMALIZED: 0, AMBIGUOUS: 0, NO_MATCH: 0 };
for (const match of matches) sourceSummary[match.status] += 1;
const currentExerciseNames = [...new Map(matches.map((match) => [match.name, { name: match.name, normalizedName: match.normalizedName, status: match.status, exerciseIds: match.exerciseIds }])).values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
const summary = { EXACT: 0, NORMALIZED: 0, AMBIGUOUS: 0, NO_MATCH: 0 };
for (const match of currentExerciseNames) summary[match.status] += 1;
const duplicateNames = [...normalizedIndex.entries()].filter(([, ids]) => ids.size > 1).map(([normalizedName, ids]) => ({ normalizedName, exerciseIds: [...ids] }));
const facets = (field) => [...new Set(library.map((item) => item[field]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "en"));
const report = {
  generatedAt: new Date().toISOString(),
  readOnly: true,
  dataset: { exercises: library.length, equipment: facets("equipment"), bodyParts: facets("bodyPart"), targets: facets("targetMuscle") },
  bmData: { databaseAvailable, errorType: databaseError, distinctNames: currentExerciseNames.length, distinctSourceNames: matches.length, summary, sourceSummary },
  libraryAmbiguities: duplicateNames,
  currentExerciseNames,
  matches,
};
const output = path.join(root, "reports", "exercise-library-audit.json");
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output: path.relative(root, output), dataset: report.dataset.exercises, databaseAvailable, distinctNames: currentExerciseNames.length, distinctSourceNames: matches.length, ...summary, libraryAmbiguities: duplicateNames.length }, null, 2));
