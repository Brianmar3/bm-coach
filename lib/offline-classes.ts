import type { PortalClassOccurrence } from "@/types/classes";
import type { PortalData } from "@/types/portal";
import type { UnifiedExerciseRecord } from "@/types/exercise-record";

export const OFFLINE_EXERCISES_CHANGED = "bm:offline-exercises-changed";
export const OFFLINE_EXERCISE_PAGE_SIZE = 5;
export type SavedExercise = {
  key: string; name: string; date: string; weight: number; unit: string; sets: number; repetitions: number;
};
export type SavedExercises = { savedAt: string; exercises: SavedExercise[] };

export type OfflineClassScope = { key: string; expiresAt: string };
export type SavedClassAgenda = {
  savedAt: string;
  classes: Pick<PortalClassOccurrence, "id" | "name" | "date" | "startTime" | "endTime">[];
};
export type SavedClassSummary = { savedAt: string; attendance: number; points: number };
export type OfflineClassesSnapshot = {
  scope: OfflineClassScope & { accountRevision: string | null };
  agenda?: SavedClassAgenda;
  summary?: SavedClassSummary;
  exercises?: SavedExercises;
};

type ExerciseCandidate = Pick<UnifiedExerciseRecord, "exerciseKey" | "exerciseName" | "date" | "createdAt" | "sourceId" | "sets" | "setDetails">;

export function saveLatestExercises(records: ExerciseCandidate[], savedAt = new Date().toISOString()): SavedExercises {
  const latest = new Map<string, SavedExercise>();
  const ordered = [...records].sort((a, b) =>
    b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt) || b.sourceId.localeCompare(a.sourceId));
  for (const record of ordered) {
    const lastSet = record.setDetails.at(-1);
    if (!lastSet || latest.has(record.exerciseKey)) continue;
    latest.set(record.exerciseKey, {
      key: record.exerciseKey, name: record.exerciseName, date: record.date,
      weight: lastSet.weight, unit: lastSet.unit, sets: record.sets, repetitions: lastSet.repetitions,
    });
  }
  return { savedAt, exercises: [...latest.values()] };
}

export function savedClassAgenda(
  occurrences: PortalClassOccurrence[],
  upcomingIds: string[],
  savedAt = new Date().toISOString(),
): SavedClassAgenda {
  const upcoming = new Set(upcomingIds);
  return {
    savedAt,
    classes: occurrences.filter((item) => upcoming.has(item.id)).slice(0, 4)
      .map(({ id, name, date, startTime, endTime }) => ({ id, name, date, startTime, endTime })),
  };
}

export function savedClassSummary(home: PortalData["home"], savedAt = new Date().toISOString()): SavedClassSummary {
  return { savedAt, attendance: home.classesAttendedThisMonth, points: home.points.monthlyTotal };
}

export function canReadOfflineClasses(
  snapshot: OfflineClassesSnapshot | undefined,
  scopeKey?: string,
  now = Date.now(),
): snapshot is OfflineClassesSnapshot {
  return !!snapshot && (scopeKey === undefined || snapshot.scope.key === scopeKey)
    && Date.parse(snapshot.scope.expiresAt) > now && !!(snapshot.agenda || snapshot.summary || snapshot.exercises);
}
