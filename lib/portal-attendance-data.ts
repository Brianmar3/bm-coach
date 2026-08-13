import "server-only";

import { prisma } from "@/lib/prisma";
import { argentinaDateKey, dateKeyToDatabase } from "@/lib/payment-dates";
import {
  mergePortalAttendanceRecords,
  expectedPortalAttendanceSessions,
  portalAttendancePeriod,
  summarizePortalAttendance,
  type PortalAttendancePeriod,
  type PortalAttendanceRecord,
} from "@/lib/portal-attendance";
import { addDateDays, weekRange } from "@/lib/weekly-attendance";
import { weeklyCompliance } from "@/lib/weekly-compliance";
import { hasGroupClasses } from "@/lib/student-service";
import { planDays } from "@/lib/student-enrollment";
import type { Student } from "@/types/gestion";

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
  const firstWeek = weekRange(period.start);
  const lastWeek = weekRange(addDateDays(period.endExclusive, -1));
  const expandedStart = firstWeek?.start ?? period.start;
  const expandedEnd = lastWeek?.endExclusive ?? period.endExclusive;
  const [rawRecords, student, assignments] = await Promise.all([
    loadPortalAttendanceRange(studentId, expandedStart, expandedEnd),
    prisma.studentRecord.findUnique({
      where: { id: studentId },
      select: {
        serviceType: true,
        data: true,
        membershipHistory: {
          where: {
            startDate: { lt: dateKeyToDatabase(expandedEnd) },
            OR: [{ endDate: null }, { endDate: { gte: dateKeyToDatabase(expandedStart) } }],
          },
          select: { startDate: true, endDate: true, frequencyDays: true, serviceType: true },
          orderBy: { startDate: "asc" },
        },
      },
    }),
    prisma.weeklyClassAssignment.findMany({
      where: {
        studentId,
        assignedAt: { lt: dateKeyToDatabase(period.endExclusive) },
        OR: [{ endedAt: null }, { endedAt: { gte: dateKeyToDatabase(period.start) } }],
      },
      select: { assignedAt: true, endedAt: true, schedule: { select: { dayOfWeek: true } } },
      orderBy: { assignedAt: "asc" },
    }),
  ]);
  const currentWeek = weekRange(todayKey)?.start ?? todayKey;
  const derived: PortalAttendanceRecord[] = [];
  if (student) {
    for (let weekStart = expandedStart; weekStart < expandedEnd; weekStart = addDateDays(weekStart, 7)) {
      if (weekStart >= currentWeek) continue;
      const range = weekRange(weekStart);
      if (!range) continue;
      const membership = student.membershipHistory.filter((item) => {
        const start = item.startDate.toISOString().slice(0, 10);
        const end = item.endDate?.toISOString().slice(0, 10) ?? null;
        return start < range.endExclusive && (!end || end >= range.start);
      }).at(-1);
      if (!membership) continue;
      const serviceType = membership.serviceType;
      const expected = membership.frequencyDays ?? 0;
      if (!hasGroupClasses(serviceType) || expected <= 0) continue;
      const weekRecords = rawRecords.filter((record) => record.date >= range.start && record.date < range.endExclusive);
      const closure = weeklyCompliance(expected, weekRecords, true);
      for (let index = 0; index < closure.automaticAbsent; index += 1) {
        derived.push({
          id: `weekly-closure:${studentId}:${range.start}:${index + 1}`,
          date: range.end,
          className: "Cierre semanal automático",
          startTime: "",
          endTime: "",
          status: "ABSENT",
          source: "weekly-closure",
          scheduleId: null,
        });
      }
    }
  }
  const records = [...rawRecords, ...derived]
    .filter((record) => record.date >= period.start && record.date < period.endExclusive && record.date <= todayKey)
    .sort((left, right) => right.date.localeCompare(left.date) || right.startTime.localeCompare(left.startTime));
  const membershipTimeline = student?.membershipHistory.map((item) => ({
    start: item.startDate.toISOString().slice(0, 10),
    end: item.endDate?.toISOString().slice(0, 10) ?? null,
    frequencyDays: item.frequencyDays,
    serviceType: item.serviceType,
  })) ?? [];
  const currentStudent = student?.data as unknown as Partial<Student> | undefined;
  if (student && period.start <= todayKey && period.endExclusive > todayKey && !membershipTimeline.some((item) => item.start <= todayKey && (!item.end || item.end >= todayKey))) {
    membershipTimeline.push({
      start: period.start,
      end: null,
      frequencyDays: planDays(currentStudent?.plan ?? ""),
      serviceType: student.serviceType,
    });
  }
  const expected = expectedPortalAttendanceSessions({
    start: period.start,
    endExclusive: period.endExclusive,
    today: todayKey,
    memberships: membershipTimeline,
    assignments: assignments.map((assignment) => ({
      dayOfWeek: assignment.schedule.dayOfWeek,
      assignedAt: argentinaDateKey(assignment.assignedAt),
      endedAt: assignment.endedAt ? argentinaDateKey(assignment.endedAt) : null,
    })),
  });
  return { period, ...summarizePortalAttendance(records, expected), records };
}
