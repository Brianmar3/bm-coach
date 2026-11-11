import "server-only";

import type { Prisma } from "@prisma/client";
import type { Student } from "@/types/gestion";
import type { PortalAchievement } from "@/lib/portal-achievements";
import { calculatePortalAchievements } from "@/lib/portal-achievements";
import { bmTrainingActivityStart } from "@/lib/bm-training";
import { addDateDays } from "@/lib/weekly-attendance";
import { loadVerifiedSportsAttendance } from "@/lib/sports-point-data";
import { argentinaDateKey, dateKeyToDatabase } from "@/lib/payment-dates";
import { planDays } from "@/lib/student-enrollment";
import { prisma } from "@/lib/prisma";
import { loadQuickLogAchievements } from "@/lib/quick-log-achievements";
import { isAchievementEligibleForService } from "@/lib/student-service";

const notifiableCategories = new Set(["ASISTENCIA", "CONSTANCIA", "FUERZA", "REPETICIONES", "VOLUMEN", "RECORDS_PERSONALES", "PROGRESO"]);

export async function loadNotifiableAchievements(
  studentId: string,
  options: { includeAll?: boolean; verifiedAttendance?: boolean; db?: Prisma.TransactionClient } = {},
) {
  const db = options.db ?? prisma;
  const record = await db.studentRecord.findUnique({ where: { id: studentId }, select: { data: true, workspaceId: true, serviceType: true, primaryScheduleId: true, weeklyClasses: { where: { active: true }, select: { scheduleId: true }, take: 1 } } });
  if (!record) return [];
  const student = record.data as unknown as Student;
  const today = argentinaDateKey();
  const activityStart = dateKeyToDatabase(bmTrainingActivityStart(student.joinedAt));
  const [workouts, occurrenceAttendances, legacyAttendances, evaluations, quickLogs, verified] = await Promise.all([
    db.workoutSession.findMany({ where: { studentId, status: "COMPLETED", date: { gte: activityStart } }, select: { date: true }, orderBy: { date: "asc" } }),
    db.classOccurrenceAttendance.findMany({ where: { studentId, actualAttendance: "PRESENT", occurrence: { date: { gte: activityStart }, ...(options.verifiedAttendance ? { status: { not: "CANCELLED" as const } } : {}) } }, select: { occurrence: { select: { date: true } } }, orderBy: { occurrence: { date: "asc" } } }),
    db.classAttendance.findMany({ where: { studentId, status: "PRESENT", date: { gte: activityStart } }, select: { date: true }, orderBy: { date: "asc" } }),
    db.physicalEvaluation.findMany({ where: { studentId, date: { gte: activityStart }, OR: [{ weight: { not: null } }, { height: { not: null } }, { bodyFatPercentage: { not: null } }, { muscleMass: { not: null } }, { waist: { not: null } }, { hip: { not: null } }] }, select: { date: true }, orderBy: { date: "asc" } }),
    loadQuickLogAchievements(studentId, options.db),
    options.verifiedAttendance ? loadVerifiedSportsAttendance(studentId, record.workspaceId, bmTrainingActivityStart(student.joinedAt), addDateDays(today, 1), db) : Promise.resolve(null),
  ]);
  const newDates = occurrenceAttendances.map((item) => item.occurrence.date.toISOString().slice(0, 10));
  const firstNewDate = newDates[0] ?? "";
  const attendanceDates = verified ? [...new Set(verified.map(row => row.date))].sort() : [...legacyAttendances.map((item) => item.date.toISOString().slice(0, 10)).filter((value) => !firstNewDate || value < firstNewDate), ...newDates].sort();
  const hasClasses = Boolean(record.primaryScheduleId || record.weeklyClasses.length || attendanceDates.length);
  const general = calculatePortalAchievements({
    completedWorkoutDates: workouts.map((item) => item.date.toISOString().slice(0, 10)),
    attendedClassDates: attendanceDates,
    evaluationDates: evaluations.map((item) => item.date.toISOString().slice(0, 10)),
    firstStrengthLogDate: "",
    joinedAt: student.joinedAt,
    today,
    weeklyGoal: planDays(student.plan) ?? 0,
    active: student.status !== "inactivo",
    hasRoutine: workouts.length > 0,
    hasClassParticipation: hasClasses,
  });
  const selected = options.includeAll
    ? [...general, ...quickLogs]
    : [
        ...general.filter(
          (item) =>
            notifiableCategories.has(item.category ?? "") ||
            (item.category === "EVALUACIONES" && item.level !== "COMUN"),
        ),
        ...quickLogs,
      ];
  return selected.filter((item) => isAchievementEligibleForService(record.serviceType, item)).filter(
    (item): item is PortalAchievement & { unlockedAt: string } =>
      item.unlocked && Boolean(item.unlockedAt),
  );
}
