import "server-only";

import type { Student } from "@/types/gestion";
import type { PortalAchievement } from "@/lib/portal-achievements";
import { calculatePortalAchievements } from "@/lib/portal-achievements";
import { bmTrainingActivityStart } from "@/lib/bm-training";
import { argentinaDateKey, dateKeyToDatabase } from "@/lib/payment-dates";
import { planDays } from "@/lib/student-enrollment";
import { loadStrengthAchievements } from "@/lib/strength-achievements";
import { prisma } from "@/lib/prisma";

const notifiableCategories = new Set(["ASISTENCIA", "CONSTANCIA", "FUERZA", "REPETICIONES", "VOLUMEN", "RECORDS_PERSONALES"]);

export async function loadNotifiableAchievements(studentId: string) {
  const record = await prisma.studentRecord.findUnique({ where: { id: studentId }, select: { data: true, primaryScheduleId: true, weeklyClasses: { where: { active: true }, select: { scheduleId: true }, take: 1 } } });
  if (!record) return [];
  const student = record.data as unknown as Student;
  const today = argentinaDateKey();
  const activityStart = dateKeyToDatabase(bmTrainingActivityStart(student.joinedAt));
  const [workouts, occurrenceAttendances, legacyAttendances, evaluations, firstStrength, strength] = await Promise.all([
    prisma.workoutSession.findMany({ where: { studentId, status: "COMPLETED", date: { gte: activityStart } }, select: { date: true }, orderBy: { date: "asc" } }),
    prisma.classOccurrenceAttendance.findMany({ where: { studentId, actualAttendance: "PRESENT", occurrence: { date: { gte: activityStart } } }, select: { occurrence: { select: { date: true } } }, orderBy: { occurrence: { date: "asc" } } }),
    prisma.classAttendance.findMany({ where: { studentId, status: "PRESENT", date: { gte: activityStart } }, select: { date: true }, orderBy: { date: "asc" } }),
    prisma.physicalEvaluation.findMany({ where: { studentId, date: { gte: activityStart }, OR: [{ weight: { not: null } }, { height: { not: null } }, { bodyFatPercentage: { not: null } }, { muscleMass: { not: null } }, { waist: { not: null } }, { hip: { not: null } }] }, select: { date: true }, orderBy: { date: "asc" } }),
    prisma.classWorkoutLog.findFirst({ where: { studentId, status: "COMPLETED", classDateSnapshot: { gte: activityStart } }, select: { classDateSnapshot: true }, orderBy: { classDateSnapshot: "asc" } }),
    loadStrengthAchievements(studentId, activityStart),
  ]);
  const newDates = occurrenceAttendances.map((item) => item.occurrence.date.toISOString().slice(0, 10));
  const firstNewDate = newDates[0] ?? "";
  const attendanceDates = [...legacyAttendances.map((item) => item.date.toISOString().slice(0, 10)).filter((value) => !firstNewDate || value < firstNewDate), ...newDates].sort();
  const hasClasses = Boolean(record.primaryScheduleId || record.weeklyClasses.length || attendanceDates.length || firstStrength);
  const general = calculatePortalAchievements({
    completedWorkoutDates: workouts.map((item) => item.date.toISOString().slice(0, 10)),
    attendedClassDates: attendanceDates,
    evaluationDates: evaluations.map((item) => item.date.toISOString().slice(0, 10)),
    firstStrengthLogDate: firstStrength?.classDateSnapshot.toISOString().slice(0, 10) ?? "",
    joinedAt: student.joinedAt,
    today,
    weeklyGoal: planDays(student.plan) ?? 0,
    active: student.status !== "inactivo",
    hasRoutine: workouts.length > 0,
    hasClassParticipation: hasClasses,
  });
  return [...general.filter((item) => notifiableCategories.has(item.category ?? "") || (item.category === "EVALUACIONES" && item.level !== "COMUN")), ...strength]
    .filter((item): item is PortalAchievement & { unlockedAt: string } => item.unlocked && Boolean(item.unlockedAt));
}
