import "server-only";

import { prisma } from "@/lib/prisma";
import { studentName } from "@/lib/attendance";
import { pointPeriodStart, type PointRankingPeriod } from "@/lib/point-period";
import type { Student } from "@/types/gestion";
import type { StudentRankingEntry } from "@/types/points";
import { isCompetitiveGamificationEligible, wasCompetitiveDuringMembership } from "@/lib/student-service";

export async function loadPointRanking(period: PointRankingPeriod = "month") {
  const from = pointPeriodStart(period);
  const allStudents = await prisma.studentRecord.findMany({ select: { id: true, data: true, serviceType: true }, orderBy: { createdAt: "asc" } });
  const students = allStudents.filter((record) => (record.data as unknown as Student).status !== "inactivo" && isCompetitiveGamificationEligible(record.serviceType));
  const studentIds = students.map((student) => student.id);
  const [allMovements, membershipPeriods] = await Promise.all([
    prisma.studentPointTransaction.findMany({ where: { active: true, studentId: { in: studentIds } }, select: { id: true, studentId: true, eventType: true, points: true, description: true, occurredAt: true }, orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }] }),
    prisma.studentMembershipHistory.findMany({ where: { studentId: { in: studentIds } }, select: { studentId: true, startDate: true, endDate: true, serviceType: true } }),
  ]);
  const periodsByStudent = new Map<string, typeof membershipPeriods>();
  for (const membership of membershipPeriods) periodsByStudent.set(membership.studentId, [...(periodsByStudent.get(membership.studentId) ?? []), membership]);
  const eligibleMovements = allMovements.filter((item) => wasCompetitiveDuringMembership(item.occurredAt, periodsByStudent.get(item.studentId) ?? []));
  const movements = eligibleMovements.filter((item) => !from || item.occurredAt >= from);
  const totalByStudent = new Map<string, number>();
  const historicalByStudent = new Map<string, number>();
  for (const item of eligibleMovements) historicalByStudent.set(item.studentId, (historicalByStudent.get(item.studentId) ?? 0) + item.points);
  for (const item of movements) totalByStudent.set(item.studentId, (totalByStudent.get(item.studentId) ?? 0) + item.points);
  const detail = new Map<string, Map<string, number>>();
  for (const item of movements) {
    const values = detail.get(item.studentId) ?? new Map<string, number>();
    values.set(item.eventType, (values.get(item.eventType) ?? 0) + 1);
    detail.set(item.studentId, values);
  }
  const movementsByStudent = new Map<string, StudentRankingEntry["movements"]>();
  for (const item of movements) {
    const values = movementsByStudent.get(item.studentId) ?? [];
    values.push({ id: item.id, eventType: item.eventType, points: item.points, description: item.description, occurredAt: item.occurredAt.toISOString() });
    movementsByStudent.set(item.studentId, values);
  }
  return students.map((record): StudentRankingEntry => {
    const data = record.data as unknown as Student;
    const counts = detail.get(record.id) ?? new Map<string, number>();
    const historicalTotal = historicalByStudent.get(record.id) ?? 0;
    return {
      studentId: record.id,
      studentName: studentName(record.data),
      profileImageUrl: data.profileImageUrl ?? "",
      total: totalByStudent.get(record.id) ?? 0,
      historicalTotal,
      level: historicalTotal >= 500 ? "Hito" : historicalTotal >= 250 ? "Progreso" : historicalTotal >= 100 ? "Constancia" : "Inicio",
      serviceType: record.serviceType,
      achievementCount: (counts.get("ACHIEVEMENT") ?? 0) + (counts.get("MILESTONE") ?? 0),
      attendanceThisMonth: counts.get("ATTENDANCE") ?? 0,
      recordCount: counts.get("RECORD") ?? 0,
      movements: movementsByStudent.get(record.id) ?? [],
    };
  }).sort((left, right) => right.total - left.total || right.historicalTotal - left.historicalTotal || left.studentName.localeCompare(right.studentName, "es"));
}
