import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { localizeExercise } from "../lib/exercise-localization-es.mjs";

const root = process.cwd();
const inputPath = path.join(root, "external", "exercises-dataset-main", "data", "exercises.json");
const localizationPath = path.join(root, "data", "exercise-localization-es.json");
const outputPath = path.join(root, "data", "bm-exercise-library.json");
const reportPath = path.join(root, "reports", "exercise-library-translation-audit.json");
const source = JSON.parse(await readFile(inputPath, "utf8"));
const localization = JSON.parse(await readFile(localizationPath, "utf8"));
const normalize = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");

const localizedSource = source.map((item) => ({ item, localized: localizeExercise(item, localization) }));
const library = localizedSource.map(({ item, localized }) => {
  const searchable = [
    item.name,
    localized.displayNameEs,
    ...localized.aliases,
    item.body_part,
    localized.bodyPartLabelEs,
    item.equipment,
    localized.equipmentLabelEs,
    item.target,
    localized.targetMuscleLabelEs,
    item.muscle_group,
    localized.muscleGroupLabelEs,
    ...(item.secondary_muscles ?? []),
    ...localized.secondaryMusclesEs
  ];
  return {
    id: `dataset:${item.id}`,
    sourceId: item.id,
    name: item.name,
    displayName: localized.displayNameEs,
    displayNameEs: localized.displayNameEs,
    aliases: localized.aliases,
    translationStatus: localized.translationStatus,
    translationPass: localized.translationPass,
    bodyPart: item.body_part,
    bodyPartLabelEs: localized.bodyPartLabelEs,
    equipment: item.equipment,
    equipmentLabelEs: localized.equipmentLabelEs,
    targetMuscle: item.target,
    targetMuscleLabelEs: localized.targetMuscleLabelEs,
    muscleGroup: item.muscle_group,
    muscleGroupLabelEs: localized.muscleGroupLabelEs,
    secondaryMuscles: item.secondary_muscles ?? [],
    secondaryMusclesEs: localized.secondaryMusclesEs,
    instructionsEs: item.instructions.es,
    instructionStepsEs: item.instruction_steps.es,
    thumbnailPath: item.image,
    gifPath: item.gif_url,
    attribution: item.attribution,
    source: "EXERCISES_DATASET",
    searchableText: normalize(searchable.join(" "))
  };
}).sort((a, b) => a.sourceId.localeCompare(b.sourceId));

const pendingSuggestion = (localized) => localized.reviewReason === "NO_MOVEMENT_PATTERN"
  ? "Definir el nombre canónico manualmente después de revisar el GIF y las instrucciones."
  : `Revisar manualmente el contexto de: ${(localized.untranslatedTokens ?? []).join(", ")}.`;
const pending = localizedSource.flatMap(({ item, localized }) => localized.translationStatus === "REVIEW" ? [{
  id: `dataset:${item.id}`,
  sourceId: item.id,
  name: item.name,
  displayNameEs: localized.displayNameEs,
  equipment: item.equipment,
  targetMuscle: item.target,
  bodyPart: item.body_part,
  reason: localized.reviewReason,
  firstPassReason: localized.firstPassReason,
  untranslatedTokens: localized.untranslatedTokens,
  suggestion: pendingSuggestion(localized)
}] : []);

function qualityProblems(name) {
  const problems = [];
  const normalized = normalize(name);
  if (/\b(con|de|en|y) \1\b/.test(normalized)) problems.push("REPEATED_CONNECTOR");
  if (/\b([a-z0-9]+) \1\b/.test(normalized)) problems.push("REPEATED_WORD");
  if ((name.match(/\(/g) ?? []).length !== (name.match(/\)/g) ?? []).length) problems.push("UNBALANCED_PARENTHESES");
  if (name.length > 120) problems.push("EXCESSIVE_LENGTH");
  for (const phrase of ["con barra", "con mancuerna", "en polea", "con peso corporal", "en máquina", "con kettlebell"]) {
    const hits = normalized.match(new RegExp(normalize(phrase), "g")) ?? [];
    if (hits.length > 1) problems.push(`REPEATED_EQUIPMENT:${phrase}`);
  }
  const standardEnglishTerms = ["farmer walk", "monster walk", "waiter curl", "power clean", "front lever", "full can", "spell caster", "glute ham", "sit up", "muscle up", "kettlebell", "landmine", "thruster", "burpee", "swing", "curl", "crunch", "press", "pallof", "bradford", "zercher", "jefferson", "tate", "svend", "stalder", "straddle", "rocky", "drag", "jm", "ski erg"];
  const withoutStandardTerms = standardEnglishTerms.reduce((value, term) => value.replaceAll(term, " "), normalized);
  const accidentalEnglishTokens = ["lying", "seated", "standing", "with", "reverse", "rear", "leg", "arm", "shoulder", "stretch", "raise", "machine", "bodyweight", "weighted", "supported", "grip", "wide", "close", "one", "two", "exercise", "ball", "overhead", "incline", "decline", "underhand", "overhand"];
  const foundEnglish = accidentalEnglishTokens.filter((token) => new RegExp(`(?:^| )${token}(?: |$)`).test(withoutStandardTerms));
  if (foundEnglish.length) problems.push(`ACCIDENTAL_ENGLISH:${foundEnglish.join(",")}`);
  return [...new Set(problems)];
}

const secondPassResolvedItems = localizedSource.flatMap(({ item, localized }) => localized.translationPass === 2 ? [{
  id: `dataset:${item.id}`,
  sourceId: item.id,
  name: item.name,
  displayNameEs: localized.displayNameEs,
  translationStatus: localized.translationStatus,
  equipment: item.equipment,
  targetMuscle: item.target,
  bodyPart: item.body_part
}] : []);
const qualityWarnings = secondPassResolvedItems.flatMap((item) => qualityProblems(item.displayNameEs).map((problem) => ({ ...item, problem })));
const counts = library.reduce((summary, item) => ({ ...summary, [item.translationStatus]: (summary[item.translationStatus] ?? 0) + 1 }), {});
const previousReview = localizedSource.filter(({ localized }) => localized.firstPassStatus === "REVIEW").length;
const previousReviewByReason = localizedSource
  .filter(({ localized }) => localized.firstPassStatus === "REVIEW")
  .reduce((summary, { localized }) => ({ ...summary, [localized.firstPassReason]: (summary[localized.firstPassReason] ?? 0) + 1 }), {});
const previouslyAcceptedModified = localizedSource.filter(({ localized }) => localized.firstPassStatus !== "REVIEW" && localized.firstPassDisplayNameEs !== localized.displayNameEs).length;
const reliableTranslations = library.length - (counts.REVIEW ?? 0);
const report = {
  generatedAt: new Date().toISOString(),
  total: library.length,
  reliableTranslations,
  coveragePercentage: Number(((reliableTranslations / library.length) * 100).toFixed(2)),
  automaticallyTranslated: counts.AUTOMATIC ?? 0,
  translatedByException: counts.EXCEPTION ?? 0,
  review: counts.REVIEW ?? 0,
  withoutTranslation: pending.filter((item) => item.displayNameEs === item.name).length,
  previousReview,
  previousReviewByReason,
  secondPassResolved: secondPassResolvedItems.length,
  remainingReview: pending.length,
  previouslyAcceptedModified,
  strategies: [
    "Excepciones exactas para nombres compuestos o vocabulario propio del ejercicio.",
    "Patrones adicionales de movimiento para familias reutilizables.",
    "Frases calificadoras contextuales antes de traducir palabra por palabra.",
    "Composición de varios movimientos sólo durante la segunda pasada.",
    "Fallback REVIEW cuando el contexto sigue siendo ambiguo."
  ],
  qualityValidation: {
    scope: "SECOND_PASS_ACCEPTED",
    checked: secondPassResolvedItems.length,
    warnings: qualityWarnings.length,
    rules: ["REPEATED_CONNECTOR", "REPEATED_WORD", "UNBALANCED_PARENTHESES", "EXCESSIVE_LENGTH", "REPEATED_EQUIPMENT", "ACCIDENTAL_ENGLISH"]
  },
  qualityWarnings,
  secondPassResolvedItems,
  pending
};

await mkdir(path.dirname(outputPath), { recursive: true });
await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(library, null, 2)}\n`, "utf8");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`Biblioteca BM generada: ${library.length} ejercicios -> ${path.relative(root, outputPath)}`);
console.log(`Localización: ${report.automaticallyTranslated} automáticos, ${report.translatedByException} excepciones, ${report.review} para revisión (${report.coveragePercentage}% cubierto)`);
console.log(`Segunda pasada: ${report.secondPassResolved}/${report.previousReview} resueltos; ${report.qualityValidation.warnings} alertas básicas de calidad`);
