import { attendancePercentage } from "./monthly-calculations.ts";

export type PortalAttendancePeriod = "current-month" | "previous-month" | "last-30-days";
export type PortalAttendanceStatus = "PRESENT" | "ABSENT" | "JUSTIFIED";

export type PortalAttendanceRecord = {
  id: string;
  date: string;
  className: string;
  startTime: string;
  endTime: string;
  status: PortalAttendanceStatus;
  source: "current" | "legacy" | "weekly-closure";
  scheduleId: string | null;
};

export type PortalAttendanceSummary = {
  present: number;
  absent: number;
  justified: number;
  total: number;
  percentage: number | null;
  completedDays?: number;
};

export type PortalAttendanceMembership = {
  start: string;
  end: string | null;
  frequencyDays: number | null;
  serviceType: string;
  status?: string;
  recordedAt?: string;
};

export type PortalAttendanceScheduleAssignment = {
  dayOfWeek: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY";
  assignedAt: string;
  endedAt: string | null;
};

export type PortalAttendancePeriodDefinition = {
  key: PortalAttendancePeriod;
  label: string;
  start: string;
  endExclusive: string;
};

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function utcDate(dateKey: string) {
  if (!DATE_KEY.test(dateKey)) throw new Error("Fecha de asistencia no válida.");
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftDate(date: Date, days: number) {
  const shifted = new Date(date);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted;
}

function addDateDays(value: string, days: number) {
  return dateKey(shiftDate(utcDate(value), days));
}

export function portalAttendancePeriod(period: PortalAttendancePeriod, todayKey: string): PortalAttendancePeriodDefinition {
  const today = utcDate(todayKey);
  if (period === "last-30-days") {
    return { key: period, label: "Últimos 30 días", start: dateKey(shiftDate(today, -29)), endExclusive: dateKey(shiftDate(today, 1)) };
  }
  const monthOffset = period === "previous-month" ? -1 : 0;
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + monthOffset, 1));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return {
    key: period,
    label: period === "previous-month" ? "Mes anterior" : "Este mes",
    start: dateKey(start),
    endExclusive: dateKey(end),
  };
}

export function summarizePortalAttendance(records: Pick<PortalAttendanceRecord, "status" | "date">[], expectedSessions?: number): PortalAttendanceSummary {
  const present = records.filter((record) => record.status === "PRESENT").length;
  const absent = records.filter((record) => record.status === "ABSENT").length;
  const justified = records.filter((record) => record.status === "JUSTIFIED").length;
  if (expectedSessions === undefined) return { present, absent, justified, total: present + absent + justified, percentage: attendancePercentage(present, absent, justified) };
  const effectivePresent = new Set(records.filter((record) => record.status === "PRESENT").map((record) => record.date)).size;
  // A persisted outcome is evidence that a session already elapsed. This keeps a
  // manual absence (or justification) from falling outside a projected schedule.
  const resolvedSessions = effectivePresent + absent + justified;
  const total = Math.max(0, Math.trunc(expectedSessions), resolvedSessions);
  return { present, absent, justified, total, percentage: total ? Math.round((Math.min(effectivePresent, total) / total) * 1000) / 10 : 0, completedDays: effectivePresent };
}

export function summarizeExpectedPortalAttendancePeriod(input: {
  start: string;
  endExclusive: string;
  today: string;
  memberships: PortalAttendanceMembership[];
  assignments: PortalAttendanceScheduleAssignment[];
  records: Pick<PortalAttendanceRecord, "status" | "date">[];
}) {
  const expected = expectedPortalAttendanceSessions(input);
  const records = input.records.filter((record) => record.date >= input.start && record.date < input.endExclusive && record.date <= input.today);
  return summarizePortalAttendance(records, expected);
}

const WEEKDAY_NUMBER = { SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6 } as const;

function weekday(date: string) {
  return new Date(`${date}T12:00:00.000Z`).getUTCDay();
}

function membershipForDate(memberships: PortalAttendanceMembership[], date: string) {
  return memberships
    .filter((item) => item.start <= date && (!item.end || item.end >= date))
    .sort((left, right) => left.start.localeCompare(right.start) || (left.recordedAt ?? "").localeCompare(right.recordedAt ?? ""))
    .at(-1) ?? null;
}

function scheduleCoversDate(assignment: PortalAttendanceScheduleAssignment, date: string) {
  return assignment.assignedAt <= date && (!assignment.endedAt || assignment.endedAt >= date);
}

function groupClassService(serviceType: string) {
  return serviceType === "CLASSES" || serviceType === "MIXED";
}

export function expectedPortalAttendanceSessions(input: {
  start: string;
  endExclusive: string;
  today: string;
  memberships: PortalAttendanceMembership[];
  assignments: PortalAttendanceScheduleAssignment[];
}) {
  const effectiveEnd = input.endExclusive < addDateDays(input.today, 1) ? input.endExclusive : addDateDays(input.today, 1);
  if (input.start >= effectiveEnd) return 0;
  let expected = 0;
  for (let weekStart = mondayForDate(input.start); weekStart < effectiveEnd; weekStart = addDateDays(weekStart, 7)) {
    const weekEnd = addDateDays(weekStart, 7);
    const rangeStart = input.start > weekStart ? input.start : weekStart;
    const rangeEnd = effectiveEnd < weekEnd ? effectiveEnd : weekEnd;
    const dates: string[] = [];
    for (let date = rangeStart; date < rangeEnd; date = addDateDays(date, 1)) dates.push(date);
    const eligibleDates = dates.filter((date) => {
      const membership = membershipForDate(input.memberships, date);
      return membership && (membership.status === undefined || membership.status === "ACTIVE") && groupClassService(membership.serviceType) && (membership.frequencyDays ?? 0) > 0 && weekday(date) >= 1 && weekday(date) <= 5;
    });
    if (!eligibleDates.length) continue;
    const referenceMembership = membershipForDate(input.memberships, eligibleDates.at(-1) ?? rangeStart);
    const frequency = Math.max(0, Math.trunc(referenceMembership?.frequencyDays ?? 0));
    if (!frequency) continue;
    const activeAssignments = input.assignments.filter((assignment) => eligibleDates.some((date) => scheduleCoversDate(assignment, date)));
    const activeWeekdays = new Set(activeAssignments.map((assignment) => WEEKDAY_NUMBER[assignment.dayOfWeek]));
    if (activeWeekdays.size === frequency) {
      expected += eligibleDates.filter((date) => activeAssignments.some((assignment) => WEEKDAY_NUMBER[assignment.dayOfWeek] === weekday(date) && scheduleCoversDate(assignment, date))).length;
    } else {
      expected += Math.min(frequency, Math.ceil((frequency * eligibleDates.length) / 5));
    }
  }
  return expected;
}

function mondayForDate(value: string) {
  const day = weekday(value);
  return addDateDays(value, -(day === 0 ? 6 : day - 1));
}

function attendanceIdentity(record: PortalAttendanceRecord) {
  return record.scheduleId
    ? `${record.scheduleId}:${record.date}`
    : `${record.date}:${record.startTime}:${record.className.trim().toLocaleLowerCase("es")}`;
}

export function mergePortalAttendanceRecords(current: PortalAttendanceRecord[], legacy: PortalAttendanceRecord[]) {
  const currentKeys = new Set(current.map(attendanceIdentity));
  return [...current, ...legacy.filter((record) => !currentKeys.has(attendanceIdentity(record)))]
    .sort((left, right) => right.date.localeCompare(left.date) || right.startTime.localeCompare(left.startTime));
}

export function isPortalAttendancePeriod(value: string | null): value is PortalAttendancePeriod {
  return value === "current-month" || value === "previous-month" || value === "last-30-days";
}
