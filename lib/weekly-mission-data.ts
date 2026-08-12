import "server-only";

import { Prisma } from "@prisma/client";
import { loadPortalAttendanceRange } from "@/lib/portal-attendance-data";
import { argentinaDateKey, databaseDateKey, dateKeyToDatabase } from "@/lib/payment-dates";
import { prisma } from "@/lib/prisma";
import { hasGroupClasses } from "@/lib/student-service";
import { weekRange } from "@/lib/weekly-attendance";
import {
  getWeeklyMissionProgress,
  WEEKLY_MISSION_REWARD,
  weeklyMissionTitle,
  weeklyMissionAttendanceProgress,
  type WeeklyMissionView,
} from "@/lib/weekly-mission";
import type { Student } from "@/types/gestion";
import { planDays } from "@/lib/student-enrollment";
import { distinctPresentRecords } from "@/lib/weekly-compliance";

function missionDate(value: Date) {
  return databaseDateKey(value);
}

async function attendanceProgress(start: string, endExclusive: string, studentId: string) {
  const records = await loadPortalAttendanceRange(studentId, start, endExclusive);
  const missionRecords = records;
  const present = distinctPresentRecords(missionRecords.filter((record) => record.status === "PRESENT"))
    .sort((left, right) => left.date.localeCompare(right.date));
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
  const effectiveTarget = mission.target;
  const result = await attendanceProgress(start, endExclusive, mission.studentId);
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

async function missionConfiguration(studentId: string, referenceDate: string) {
  const range = weekRange(referenceDate);
  if (!range) return null;
  const studentRecord = await prisma.studentRecord.findUnique({
    where: { id: studentId },
    select: {
      serviceType: true,
      data: true,
      membershipHistory: {
        where: {
          startDate: { lt: dateKeyToDatabase(range.endExclusive) },
          OR: [{ endDate: null }, { endDate: { gte: dateKeyToDatabase(range.start) } }],
        },
        select: { frequencyDays: true, serviceType: true },
        orderBy: { startDate: "asc" },
      },
    },
  });
  if (!studentRecord) return null;
  const student = studentRecord.data as unknown as Partial<Student>;
  const membership = studentRecord.membershipHistory.at(-1);
  const serviceType = membership?.serviceType ?? studentRecord.serviceType;
  const target = membership?.frequencyDays ?? planDays(student.plan ?? "") ?? 0;
  if (!hasGroupClasses(serviceType) || target <= 0) return null;
  if (student.status !== "activo" || student.lifecycleStatus === "inactivo" || student.lifecycleStatus === "suspendido") return null;
  return { range, target };
}

async function createCurrentMission(studentId: string, referenceDate: string, configuration?: NonNullable<Awaited<ReturnType<typeof missionConfiguration>>>) {
  const resolved = configuration ?? await missionConfiguration(studentId, referenceDate);
  if (!resolved) return null;
  const { range, target } = resolved;
  const progressResult = await attendanceProgress(range.start, range.endExclusive, studentId);
  const completed = progressResult.progress >= target;
  const completionDate = completed ? progressResult.present[target - 1]?.date ?? referenceDate : null;
  try {
    return await prisma.studentWeeklyMission.create({
      data: {
        studentId,
        weekStart: dateKeyToDatabase(range.start),
        weekEnd: dateKeyToDatabase(range.end),
        title: weeklyMissionTitle(target),
        target,
        scheduledClassKeys: [],
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
  const configuration = await missionConfiguration(studentId, referenceDate);
  if (!configuration) return null;
  const currentWeekStart = dateKeyToDatabase(range.start);
  const activeMissions = await prisma.studentWeeklyMission.findMany({
    where: { studentId, state: "ACTIVE", weekStart: { lt: currentWeekStart } },
    orderBy: { weekStart: "asc" },
  });
  for (const mission of activeMissions) await settleMission(mission);
  const existing = await prisma.studentWeeklyMission.findUnique({
    where: { studentId_weekStart: { studentId, weekStart: currentWeekStart } },
  });
  if (existing) {
    if (existing.state !== "ACTIVE") return existing;
    const normalized = existing.target === configuration.target && existing.scheduledClassKeys.length === 0
      ? existing
      : await prisma.studentWeeklyMission.update({
          where: { id: existing.id },
          data: { target: configuration.target, title: weeklyMissionTitle(configuration.target), scheduledClassKeys: [] },
        });
    return settleMission(normalized);
  }
  return createCurrentMission(studentId, referenceDate, configuration);
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
