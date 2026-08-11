import "server-only";

import { Prisma } from "@prisma/client";
import { loadPortalAttendanceRange } from "@/lib/portal-attendance-data";
import { argentinaDateKey, databaseDateKey, dateKeyToDatabase } from "@/lib/payment-dates";
import { prisma } from "@/lib/prisma";
import { hasGroupClasses } from "@/lib/student-service";
import { argentinaDateKey as argentinaKeyForDate, weekRange } from "@/lib/weekly-attendance";
import {
  getWeeklyMissionProgress,
  scheduledWeeklyMissionClasses,
  WEEKLY_MISSION_REWARD,
  weeklyMissionTitle,
  weeklyMissionAttendanceProgress,
  type WeeklyMissionView,
} from "@/lib/weekly-mission";
import type { Student } from "@/types/gestion";

function missionDate(value: Date) {
  return databaseDateKey(value);
}

async function attendanceProgress(start: string, endExclusive: string, studentId: string, scheduledClassKeys: string[] = []) {
  const records = await loadPortalAttendanceRange(studentId, start, endExclusive);
  const allowed = new Set(scheduledClassKeys);
  const missionRecords = allowed.size
    ? records.filter((record) => record.scheduleId && allowed.has(`${record.scheduleId}|${record.date}`))
    : records;
  const present = missionRecords.filter((record) => record.status === "PRESENT").sort((left, right) => left.date.localeCompare(right.date));
  return { progress: weeklyMissionAttendanceProgress(missionRecords), present };
}

async function settleMission(mission: {
  id: string;
  studentId: string;
  weekStart: Date;
  weekEnd: Date;
  title: string;
  target: number;
  scheduledClassKeys: string[];
  progress: number;
  state: "ACTIVE" | "COMPLETED" | "EXPIRED";
  rewardPoints: number;
  completedAt: Date | null;
  pointsAwardedAt: Date | null;
}) {
  if (mission.state !== "ACTIVE") return mission;
  const start = missionDate(mission.weekStart);
  const endExclusive = (() => {
    const end = new Date(mission.weekEnd);
    end.setUTCDate(end.getUTCDate() + 1);
    return missionDate(end);
  })();
  const cancelledOccurrences = mission.scheduledClassKeys.length ? await prisma.classOccurrence.findMany({
    where: { status: "CANCELLED", date: { gte: mission.weekStart, lte: mission.weekEnd } },
    select: { scheduleId: true, date: true },
  }) : [];
  const cancelledKeys = new Set(cancelledOccurrences.flatMap((occurrence) => occurrence.scheduleId ? [`${occurrence.scheduleId}|${databaseDateKey(occurrence.date)}`] : []));
  const effectiveTarget = mission.scheduledClassKeys.length
    ? mission.scheduledClassKeys.filter((key) => !cancelledKeys.has(key)).length
    : mission.target;
  const effectiveClassKeys = mission.scheduledClassKeys.filter((key) => !cancelledKeys.has(key));
  const result = await attendanceProgress(start, endExclusive, mission.studentId, effectiveClassKeys);
  const completed = effectiveTarget > 0 && result.progress >= effectiveTarget;
  const currentWeek = weekRange(argentinaDateKey());
  const expired = Boolean(currentWeek && start < currentWeek.start);
  const state = completed ? "COMPLETED" as const : expired || effectiveTarget === 0 ? "EXPIRED" as const : "ACTIVE" as const;
  const completionDate = completed ? result.present[effectiveTarget - 1]?.date ?? start : null;
  return prisma.studentWeeklyMission.update({
    where: { id: mission.id },
    data: {
      progress: result.progress,
      target: effectiveTarget || mission.target,
      title: weeklyMissionTitle(effectiveTarget || mission.target),
      state,
      completedAt: completed && !mission.completedAt ? new Date(`${completionDate}T12:00:00.000Z`) : mission.completedAt,
    },
  });
}

async function createCurrentMission(studentId: string, referenceDate: string) {
  const range = weekRange(referenceDate);
  if (!range) return null;
  const studentRecord = await prisma.studentRecord.findUnique({
    where: { id: studentId },
    select: {
      serviceType: true,
      data: true,
      weeklyClasses: { include: { schedule: true } },
      statusEvents: { where: { eventDate: { lt: dateKeyToDatabase(range.endExclusive) } }, orderBy: { eventDate: "asc" } },
    },
  });
  if (!studentRecord || !hasGroupClasses(studentRecord.serviceType)) return null;
  const student = studentRecord.data as unknown as Partial<Student>;
  if (student.status !== "activo" || student.lifecycleStatus === "inactivo" || student.lifecycleStatus === "suspendido") return null;
  const occurrences = await prisma.classOccurrence.findMany({
    where: { date: { gte: dateKeyToDatabase(range.start), lt: dateKeyToDatabase(range.endExclusive) }, status: "CANCELLED", scheduleId: { not: null } },
    select: { scheduleId: true, date: true },
  });
  const scheduled = scheduledWeeklyMissionClasses({
    referenceDate,
    joinedAt: typeof student.joinedAt === "string" ? student.joinedAt : null,
    statusEvents: studentRecord.statusEvents.map((event) => ({ type: event.type, date: databaseDateKey(event.eventDate) })),
    assignments: studentRecord.weeklyClasses.map((assignment) => ({
      scheduleId: assignment.scheduleId,
      assignedAt: argentinaKeyForDate(assignment.assignedAt),
      endedAt: assignment.endedAt ? argentinaKeyForDate(assignment.endedAt) : null,
      active: assignment.active,
      scheduleActive: assignment.schedule.active,
      dayOfWeek: assignment.schedule.dayOfWeek,
    })),
    cancelled: occurrences.flatMap((occurrence) => occurrence.scheduleId ? [{ scheduleId: occurrence.scheduleId, date: databaseDateKey(occurrence.date) }] : []),
  });
  if (scheduled.length === 0) return null;
  const scheduledClassKeys = scheduled.map((item) => `${item.scheduleId}|${item.date}`);
  const progressResult = await attendanceProgress(range.start, range.endExclusive, studentId, scheduledClassKeys);
  const completed = progressResult.progress >= scheduled.length;
  const completionDate = completed ? progressResult.present[scheduled.length - 1]?.date ?? referenceDate : null;
  try {
    return await prisma.studentWeeklyMission.create({
      data: {
        studentId,
        weekStart: dateKeyToDatabase(range.start),
        weekEnd: dateKeyToDatabase(range.end),
        title: weeklyMissionTitle(scheduled.length),
        target: scheduled.length,
        scheduledClassKeys,
        progress: progressResult.progress,
        state: completed ? "COMPLETED" : "ACTIVE",
        rewardPoints: WEEKLY_MISSION_REWARD,
        completedAt: completionDate ? new Date(`${completionDate}T12:00:00.000Z`) : null,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return prisma.studentWeeklyMission.findUnique({ where: { studentId_weekStart: { studentId, weekStart: dateKeyToDatabase(range.start) } } });
    }
    throw error;
  }
}

export async function resolveCurrentWeeklyMission(studentId: string, referenceDate = argentinaDateKey()) {
  const range = weekRange(referenceDate);
  if (!range) return null;
  const studentRecord = await prisma.studentRecord.findUnique({
    where: { id: studentId },
    select: { serviceType: true },
  });
  if (!studentRecord || !hasGroupClasses(studentRecord.serviceType)) return null;
  const activeMissions = await prisma.studentWeeklyMission.findMany({ where: { studentId, state: "ACTIVE" }, orderBy: { weekStart: "asc" } });
  for (const mission of activeMissions) await settleMission(mission);
  const existing = await prisma.studentWeeklyMission.findUnique({
    where: { studentId_weekStart: { studentId, weekStart: dateKeyToDatabase(range.start) } },
  });
  if (existing) return existing.state === "ACTIVE" ? settleMission(existing) : existing;
  return createCurrentMission(studentId, referenceDate);
}

export async function loadCurrentWeeklyMission(studentId: string, referenceDate = argentinaDateKey()): Promise<WeeklyMissionView | null> {
  const mission = await resolveCurrentWeeklyMission(studentId, referenceDate);
  if (!mission || mission.state === "EXPIRED") return null;
  return getWeeklyMissionProgress({
    id: mission.id,
    weekStart: missionDate(mission.weekStart),
    weekEnd: missionDate(mission.weekEnd),
    target: mission.target,
    title: mission.title,
    progress: mission.progress,
    state: mission.state,
    rewardPoints: mission.rewardPoints,
    completedAt: mission.completedAt,
    pointsAwardedAt: mission.pointsAwardedAt,
  });
}

export async function loadWeeklyMissionHistory(studentId: string) {
  return prisma.studentWeeklyMission.findMany({ where: { studentId }, orderBy: { weekStart: "desc" } });
}
