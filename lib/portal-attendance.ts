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
  source: "current" | "legacy";
  scheduleId: string | null;
};

export type PortalAttendanceSummary = {
  present: number;
  absent: number;
  justified: number;
  total: number;
  percentage: number | null;
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

export function summarizePortalAttendance(records: Pick<PortalAttendanceRecord, "status">[]): PortalAttendanceSummary {
  const present = records.filter((record) => record.status === "PRESENT").length;
  const absent = records.filter((record) => record.status === "ABSENT").length;
  const justified = records.filter((record) => record.status === "JUSTIFIED").length;
  return { present, absent, justified, total: present + absent + justified, percentage: attendancePercentage(present, absent, justified) };
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
