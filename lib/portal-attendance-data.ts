import "server-only";

import { prisma } from "@/lib/prisma";
import { dateKeyToDatabase } from "@/lib/payment-dates";
import {
  mergePortalAttendanceRecords,
  portalAttendancePeriod,
  summarizePortalAttendance,
  type PortalAttendancePeriod,
  type PortalAttendanceRecord,
} from "@/lib/portal-attendance";

export async function loadPortalAttendanceRange(studentId: string, start: string, endExclusive: string) {
  const range = { gte: dateKeyToDatabase(start), lt: dateKeyToDatabase(endExclusive) };
  const [currentRows, legacyRows] = await Promise.all([
    prisma.classOccurrenceAttendance.findMany({
      where: {
        studentId,
        actualAttendance: { in: ["PRESENT", "ABSENT"] },
        occurrence: { date: range, status: { not: "CANCELLED" } },
      },
      select: {
        id: true,
        actualAttendance: true,
        occurrence: { select: { date: true, classNameSnapshot: true, startTime: true, endTime: true, scheduleId: true } },
      },
    }),
    prisma.classAttendance.findMany({
      where: { studentId, date: range },
      select: {
        id: true,
        date: true,
        status: true,
        scheduleLabel: true,
        scheduleStartTime: true,
        scheduleId: true,
        schedule: { select: { endTime: true } },
      },
    }),
  ]);

  const current: PortalAttendanceRecord[] = currentRows.map((row) => ({
    id: row.id,
    date: row.occurrence.date.toISOString().slice(0, 10),
    className: row.occurrence.classNameSnapshot,
    startTime: row.occurrence.startTime,
    endTime: row.occurrence.endTime,
    status: row.actualAttendance as "PRESENT" | "ABSENT",
    source: "current",
    scheduleId: row.occurrence.scheduleId,
  }));
  const legacy: PortalAttendanceRecord[] = legacyRows.map((row) => ({
    id: row.id,
    date: row.date.toISOString().slice(0, 10),
    className: row.scheduleLabel,
    startTime: row.scheduleStartTime,
    endTime: row.schedule?.endTime ?? "",
    status: row.status,
    source: "legacy",
    scheduleId: row.scheduleId,
  }));
  return mergePortalAttendanceRecords(current, legacy);
}

export async function loadPortalAttendance(studentId: string, periodKey: PortalAttendancePeriod, todayKey: string) {
  const period = portalAttendancePeriod(periodKey, todayKey);
  const records = await loadPortalAttendanceRange(studentId, period.start, period.endExclusive);
  return { period, ...summarizePortalAttendance(records), records };
}
