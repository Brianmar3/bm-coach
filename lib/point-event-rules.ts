export const POINT_RULES = {
  ATTENDANCE: 5,
  RECORD: 3,
  ROUTINE_COMPLETED: 5,
} as const;

export type ValidPointEvent = {
  eventKey: string;
  eventType: "ATTENDANCE" | "RECORD";
  sourceType:
    | "CLASS_OCCURRENCE_ATTENDANCE"
    | "LEGACY_ATTENDANCE"
    | "QUICK_LOG"
    | "WORKOUT_SESSION";
  sourceId: string;
  points: number;
  description: string;
  occurredAt: Date;
};

type AttendanceInput = {
  id: string;
  date: Date | string;
  description: string;
};

type RecordInput = AttendanceInput;

export type PointEventInputs = {
  legacyAttendances?: AttendanceInput[];
  occurrenceAttendances?: AttendanceInput[];
  quickLogs?: RecordInput[];
  completedRoutineSessions?: RecordInput[];
};

/** Noon UTC keeps a calendar date stable inside Argentina month boundaries. */
export function effectivePointDate(value: Date | string) {
  const key = value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
  return new Date(`${key}T12:00:00.000Z`);
}

export function buildValidPointEvents(input: PointEventInputs): ValidPointEvent[] {
  const events: ValidPointEvent[] = [];
  for (const item of input.legacyAttendances ?? []) {
    events.push({
      eventKey: `attendance:legacy:${item.id}`,
      eventType: "ATTENDANCE",
      sourceType: "LEGACY_ATTENDANCE",
      sourceId: item.id,
      points: POINT_RULES.ATTENDANCE,
      description: item.description,
      occurredAt: effectivePointDate(item.date),
    });
  }
  for (const item of input.occurrenceAttendances ?? []) {
    events.push({
      eventKey: `attendance:occurrence:${item.id}`,
      eventType: "ATTENDANCE",
      sourceType: "CLASS_OCCURRENCE_ATTENDANCE",
      sourceId: item.id,
      points: POINT_RULES.ATTENDANCE,
      description: item.description,
      occurredAt: effectivePointDate(item.date),
    });
  }
  for (const item of input.quickLogs ?? []) {
    events.push({
      eventKey: `record:quick-log:${item.id}`,
      eventType: "RECORD",
      sourceType: "QUICK_LOG",
      sourceId: item.id,
      points: POINT_RULES.RECORD,
      description: item.description,
      occurredAt: effectivePointDate(item.date),
    });
  }
  for (const item of input.completedRoutineSessions ?? []) {
    events.push({
      eventKey: `record:workout-session:${item.id}`,
      eventType: "RECORD",
      sourceType: "WORKOUT_SESSION",
      sourceId: item.id,
      points: POINT_RULES.ROUTINE_COMPLETED,
      description: item.description,
      occurredAt: effectivePointDate(item.date),
    });
  }
  return events;
}

export function pointEventKeysToInvalidate(
  previous: Array<{ eventKey: string; active: boolean; sourceType: string }>,
  desired: Array<{ eventKey: string }>,
) {
  const desiredKeys = new Set(desired.map((item) => item.eventKey));
  return previous
    .filter((item) => item.active && (item.sourceType === "ACHIEVEMENT" || !desiredKeys.has(item.eventKey)))
    .map((item) => item.eventKey);
}

