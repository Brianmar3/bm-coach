import "server-only";

import { prisma } from "@/lib/prisma";
import { studentName } from "@/lib/attendance";
import { pointPeriodStart, type PointRankingPeriod } from "@/lib/point-period";
import type { Student } from "@/types/gestion";
import type { StudentRankingEntry } from "@/types/points";

export async function loadPointRanking(period: PointRankingPeriod = "month") {
  const from = pointPeriodStart(period);
  const periodWhere = { active: true, ...(from ? { occurredAt: { gte: from } } : {}) } as const;
  const allStudents = await prisma.studentRecord.findMany({ select: { id: true, data: true }, orderBy: { createdAt: "asc" } });
  const students = allStudents.filter((record) => (record.data as unknown as Student).status !== "inactivo");
  const studentIds = students.map((student) => student.id);
  const [totals, historicalTotals, details, movements] = await Promise.all([
    prisma.studentPointTransaction.groupBy({ by: ["studentId"], where: { ...periodWhere, studentId: { in: studentIds } }, _sum: { points: true } }),
    prisma.studentPointTransaction.groupBy({ by: ["studentId"], where: { active: true, studentId: { in: studentIds } }, _sum: { points: true } }),
    prisma.studentPointTransaction.groupBy({ by: ["studentId", "eventType"], where: { ...periodWhere, studentId: { in: studentIds } }, _count: { _all: true } }),
    prisma.studentPointTransaction.findMany({ where: { ...periodWhere, studentId: { in: studentIds } }, select: { id: true, studentId: true, eventType: true, points: true, description: true, occurredAt: true }, orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }] }),
  ]);
  const totalByStudent = new Map(totals.map((item) => [item.studentId, item._sum.points ?? 0]));
  const historicalByStudent = new Map(historicalTotals.map((item) => [item.studentId, item._sum.points ?? 0]));
  const detail = new Map<string, Map<string, number>>();
  for (const item of details) {
    const values = detail.get(item.studentId) ?? new Map<string, number>();
    values.set(item.eventType, item._count._all);
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
      serviceType: data.serviceType ?? "CLASSES",
      achievementCount: (counts.get("ACHIEVEMENT") ?? 0) + (counts.get("MILESTONE") ?? 0),
      attendanceThisMonth: counts.get("ATTENDANCE") ?? 0,
      recordCount: counts.get("RECORD") ?? 0,
      movements: movementsByStudent.get(record.id) ?? [],
    };
  }).sort((left, right) => right.total - left.total || right.historicalTotal - left.historicalTotal || left.studentName.localeCompare(right.studentName, "es"));
}

