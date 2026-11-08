import type { PortalClassOccurrence } from "@/types/classes";
import type { PortalData } from "@/types/portal";

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
};

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
    && Date.parse(snapshot.scope.expiresAt) > now && !!(snapshot.agenda || snapshot.summary);
}
