export type EffectiveSessionResponse = {
  studentId: string;
  response: "GOING" | "NOT_GOING" | null;
  actualAttendance?: "UNKNOWN" | "PRESENT" | "ABSENT" | "CANCELLED";
  respondedAt?: Date | string | null;
  checkedInAt?: Date | string | null;
  updatedAt?: Date | string | null;
  createdAt?: Date | string | null;
};

export type EffectiveSessionOccurrence = {
  id: string;
  scheduleId: string | null;
  date: string;
  startTime: string;
  assignments?: Array<{ studentId: string; primaryScheduleId?: string | null }>;
  responses: EffectiveSessionResponse[];
};

function instant(value: Date | string | null | undefined) {
  if (!value) return 0;
  const milliseconds = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds : 0;
}

function studentDateKey(studentId: string, date: string) {
  return `${studentId}|${date}`;
}

export function effectiveSessionForStudentsOnDate(occurrences: EffectiveSessionOccurrence[]) {
  const ordered = [...occurrences].sort((left, right) => left.date.localeCompare(right.date) || left.startTime.localeCompare(right.startTime) || left.id.localeCompare(right.id));
  const designated = new Map<string, { occurrenceId: string; primary: boolean }>();
  const explicit = new Map<string, { occurrenceId: string; priority: number; at: number }>();

  for (const occurrence of ordered) {
    for (const assignment of occurrence.assignments ?? []) {
      const key = studentDateKey(assignment.studentId, occurrence.date);
      const primary = Boolean(occurrence.scheduleId && assignment.primaryScheduleId === occurrence.scheduleId);
      const current = designated.get(key);
      if (!current || primary && !current.primary) designated.set(key, { occurrenceId: occurrence.id, primary });
    }
    for (const response of occurrence.responses) {
      const hasAttendance = response.actualAttendance !== undefined && response.actualAttendance !== "UNKNOWN";
      if (!hasAttendance && response.response !== "GOING") continue;
      const key = studentDateKey(response.studentId, occurrence.date);
      const priority = hasAttendance ? 2 : 1;
      const at = hasAttendance
        ? instant(response.checkedInAt ?? response.updatedAt ?? response.createdAt)
        : instant(response.respondedAt ?? response.updatedAt ?? response.createdAt);
      const current = explicit.get(key);
      if (!current || priority > current.priority || priority === current.priority && at >= current.at) {
        explicit.set(key, { occurrenceId: occurrence.id, priority, at });
      }
    }
  }

  const effective = new Map<string, string>();
  for (const [key, value] of designated) effective.set(key, value.occurrenceId);
  for (const [key, value] of explicit) effective.set(key, value.occurrenceId);
  return effective;
}

export function effectiveOccurrenceId(effective: ReadonlyMap<string, string>, studentId: string, date: string) {
  return effective.get(studentDateKey(studentId, date)) ?? null;
}
