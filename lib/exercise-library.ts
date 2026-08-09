import type { BMExercise, BMExerciseSummary, ExerciseLibraryFacet, ExerciseLibraryFilters, ExerciseLibraryMatch } from "../types/exercise-library";

export const EXERCISE_LIBRARY_PAGE_SIZE = 60;
type FilterableExercise = Pick<BMExercise, "searchableText" | "bodyPart" | "equipment" | "targetMuscle">;

export function normalizeLibraryText(value: string) {
  const abbreviations: Record<string, string> = { bb: "barbell", db: "dumbbell", kb: "kettlebell", bw: "body weight" };
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ").split(" ").map((token) => abbreviations[token] ?? token).join(" ");
}

export function filterExerciseLibrary<T extends FilterableExercise>(items: T[], filters: ExerciseLibraryFilters) {
  const query = normalizeLibraryText(filters.query ?? "");
  return items.filter((item) =>
    (!query || item.searchableText.includes(query)) &&
    (!filters.bodyPart || item.bodyPart === filters.bodyPart) &&
    (!filters.equipment || item.equipment === filters.equipment) &&
    (!filters.targetMuscle || item.targetMuscle === filters.targetMuscle));
}

export function paginateExerciseLibrary<T>(items: T[], visibleCount: number) {
  return items.slice(0, Math.max(0, visibleCount));
}

export function exerciseLibrarySummaries(items: BMExercise[]): BMExerciseSummary[] {
  return items.map((item) => ({ id: item.id, sourceId: item.sourceId, name: item.name, displayName: item.displayName, displayNameEs: item.displayNameEs, aliases: item.aliases, translationStatus: item.translationStatus, translationPass: item.translationPass, bodyPart: item.bodyPart, bodyPartLabelEs: item.bodyPartLabelEs, equipment: item.equipment, equipmentLabelEs: item.equipmentLabelEs, targetMuscle: item.targetMuscle, targetMuscleLabelEs: item.targetMuscleLabelEs, muscleGroup: item.muscleGroup, muscleGroupLabelEs: item.muscleGroupLabelEs, thumbnailPath: item.thumbnailPath, gifPath: item.gifPath, attribution: item.attribution, source: item.source, searchableText: item.searchableText }));
}

export function exerciseLibraryFacets(items: BMExercise[]) {
  const unique = (values: ExerciseLibraryFacet[]) => [...new Map(values.filter((item) => item.value).map((item) => [item.value, item])).values()].sort((a, b) => a.label.localeCompare(b.label, "es"));
  return {
    bodyParts: unique(items.map((item) => ({ value: item.bodyPart, label: item.bodyPartLabelEs }))),
    equipment: unique(items.map((item) => ({ value: item.equipment, label: item.equipmentLabelEs }))),
    targets: unique(items.map((item) => ({ value: item.targetMuscle, label: item.targetMuscleLabelEs })))
  };
}

export function resolveExerciseLibraryMatch(name: string, items: BMExercise[]): ExerciseLibraryMatch {
  const exact = items.filter((item) => item.name === name || item.displayNameEs === name || item.displayName === name || item.aliases.includes(name));
  if (exact.length === 1) return { name, status: "EXACT", exerciseIds: [exact[0].id] };
  if (exact.length > 1) return { name, status: "AMBIGUOUS", exerciseIds: exact.map((item) => item.id) };
  const normalized = normalizeLibraryText(name);
  const matches = items.filter((item) => [item.name, item.displayNameEs, item.displayName, ...item.aliases].some((value) => normalizeLibraryText(value) === normalized));
  return { name, status: matches.length === 1 ? "NORMALIZED" : matches.length > 1 ? "AMBIGUOUS" : "NO_MATCH", exerciseIds: matches.map((item) => item.id) };
}

export function getExerciseMediaUrl(exercise: Pick<BMExercise, "id" | "thumbnailPath" | "gifPath">, kind: "thumbnail" | "gif", enabled: boolean, basePath = "/api/exercise-library/media") {
  const available = kind === "thumbnail" ? exercise.thumbnailPath : exercise.gifPath;
  return enabled && available ? `${basePath}?id=${encodeURIComponent(exercise.id)}&kind=${kind}` : null;
}
