
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadPortalAttendanceRange } from "@/lib/portal-attendance-data";
import { addDateDays, weekRange } from "@/lib/weekly-attendance";
import { databaseDateKey, dateKeyToDatabase } from "@/lib/payment-dates";
import { sportsTrainingDays, sportsWeeklyBonusKey, sportsWeeklyGoal, SPORTS_WEEKLY_BONUS, validTrainingWeight } from "@/lib/sports-point-policy";
import { getWeeklyMissionProgress } from "@/lib/weekly-mission";

export async function loadVerifiedSportsAttendance(
  studentId: string, workspaceId: string, from: string, endExclusive: string, db: Prisma.TransactionClient,
) {
  const [attendance, cancelled] = await Promise.all([
    loadPortalAttendanceRange(studentId, workspaceId, from, endExclusive, db),
    db.classOccurrence.findMany({ where: { workspaceId, date: { gte: dateKeyToDatabase(from), lt: dateKeyToDatabase(endExclusive) }, status: "CANCELLED" },
      select: { date: true, scheduleId: true, startTime: true } }),
  ]);
  return attendance.filter(row => row.status === "PRESENT" &&
    (row.source !== "legacy" || !cancelled.some(item => databaseDateKey(item.date) === row.date &&
      (row.scheduleId ? item.scheduleId === row.scheduleId : item.startTime === row.startTime))));
}

export async function loadSportsActivity(studentId: string, start: string, today: string, db: Prisma.TransactionClient = prisma) {
  const student = await db.studentRecord.findUnique({
    where: { id: studentId },
    select: {
      workspaceId: true, serviceType: true,
      membershipHistory: { orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
        select: { startDate: true, endDate: true, frequencyDays: true, status: true, serviceType: true } },
    },
  });
  if (!student) return { days: [], contracts: [], serviceType: undefined };
  const from = weekRange(start)?.start ?? start;
  const endExclusive = addDateDays(today, 1);
  const dates = { gte: dateKeyToDatabase(from), lt: dateKeyToDatabase(endExclusive) };
  const [attendance, sessions, classWeights] = await Promise.all([
    loadVerifiedSportsAttendance(studentId, student.workspaceId, from, endExclusive, db),
    db.workoutSession.findMany({ where: { studentId, status: "COMPLETED", date: dates }, select: { id: true, date: true,
      exercises: { select: { sets: { where: { completed: true, weight: { gt: 0 } }, select: { weight: true } } } } } }),
    db.classWorkoutLog.findMany({
      where: { studentId, status: "COMPLETED",
        occurrence: { workspaceId: student.workspaceId, date: dates, status: { not: "CANCELLED" },
          responses: { some: { studentId, actualAttendance: "PRESENT" } } },
        exercises: { some: { sets: { some: { weight: { gt: 0 } } } } } },
      select: { occurrence: { select: { responses: { where: { studentId, actualAttendance: "PRESENT" }, select: { id: true } } } },
        exercises: { select: { sets: { where: { weight: { gt: 0 } }, select: { weight: true } } } } },
    }),
  ]);
  const hasWeight = (exercises: Array<{ sets: Array<{ weight: unknown }> }>) =>
    exercises.some(exercise => exercise.sets.some(set => validTrainingWeight(set.weight)));
  const weights = new Set(classWeights.filter(log => hasWeight(log.exercises)).flatMap(log => log.occurrence.responses.map(response => response.id)));
  const contracts = student.membershipHistory.map(period => ({
    start: databaseDateKey(period.startDate), end: period.endDate && databaseDateKey(period.endDate),
    active: period.status === "ACTIVE", serviceType: period.serviceType, frequencyDays: period.frequencyDays,
  }));
  const days = sportsTrainingDays([
    ...attendance.map(row => ({ id: row.id, date: row.date, kind: "class" as const, hasWeight: weights.has(row.id) })),
    ...sessions.map(session => ({ id: session.id, date: databaseDateKey(session.date), kind: "routine" as const, hasWeight: hasWeight(session.exercises) })),
  ], contracts, student.serviceType);
  return { days, contracts, serviceType: student.serviceType };
}

export async function loadSportsWeeklyMission(studentId: string, start: string, today: string) {
  const week = weekRange(today);
  if (!week) return null;
  const { days, contracts } = await loadSportsActivity(studentId, today, today);
  const goal = sportsWeeklyGoal(week.start, days, contracts);
  if (!goal) return null;
  const key = sportsWeeklyBonusKey(week.start);
  const completedAt = goal.completedAt && goal.completedAt >= start ? goal.completedAt : null;
  const award = completedAt && await prisma.studentPointTransaction.findUnique({
    where: { studentId_eventKey: { studentId, eventKey: key } },
    select: { active: true, createdAt: true },
  });
  const mission = getWeeklyMissionProgress({ ...goal, id: key, state: goal.completedAt ? "COMPLETED" : "ACTIVE",
    rewardPoints: SPORTS_WEEKLY_BONUS, completedAt: goal.completedAt && dateKeyToDatabase(goal.completedAt),
    pointsAwardedAt: award && award.active ? award.createdAt : null });
  return { ...mission, pointsPerSession: 0, maximumReward: SPORTS_WEEKLY_BONUS,
    message: mission.state === "COMPLETED" ? mission.message : mission.progress === 0 ? mission.message :
      mission.remaining === 1 ? "Te falta 1 entrenamiento para completar el objetivo." : `Te faltan ${mission.remaining} entrenamientos.` };
}

