import type { Prisma, PrismaClient } from "@prisma/client";
import { serializeAttendance, studentName, monthRange } from "@/lib/attendance";
import { coachedStudentsWhere } from "@/lib/coached-students";
import { ATTENDANCE_HISTORY_PAGE_SIZE as SIZE } from "@/lib/student-attendance-history";
import { PERFECT_ATTENDANCE_LIMITATION, type AttendanceReport, type AttendanceReportFilter } from "@/lib/attendance-report";

export async function loadAttendanceReport(db: Pick<PrismaClient, "studentRecord" | "classAttendance">, workspaceId: string, filter: AttendanceReportFilter): Promise<AttendanceReport> {
  if (!workspaceId) throw new Error("Workspace requerido.");
  const nameFilters: Prisma.StudentRecordWhereInput[] = filter.q.split(/\s+/).filter(Boolean).map(word => ({ OR: ["firstName", "lastName"].map(field => ({ data: { path: [field], string_contains: word, mode: "insensitive" } })) }));
  const where: Prisma.ClassAttendanceWhereInput = {
    student: { workspaceId, AND: [coachedStudentsWhere, ...nameFilters] },
    OR: [{ scheduleId: null }, { schedule: { workspaceId } }],
  };
  if (filter.filter === "month") { const range = monthRange(filter.month)!; where.date = { gte: range.start, lt: range.end }; }
  if (filter.filter === "range") where.date = { gte: new Date(filter.from + "T00:00:00Z"), lte: new Date(filter.to + "T00:00:00Z") };
  if (filter.report === "history") {
    if (filter.status !== "all") where.status = filter.status;
    const total = await db.classAttendance.count({ where });
    const pages = Math.max(1, Math.ceil(total / SIZE)); const page = Math.min(filter.page, pages);
    const records = await db.classAttendance.findMany({ where, include: { student: true }, orderBy: [{ date: "desc" }, { scheduleStartTime: "asc" }, { id: "asc" }], take: SIZE, skip: (page - 1) * SIZE });
    return { report: "history", history: records.map(row => serializeAttendance(row, false)), total, page, pages };
  }
  // Compact aggregates only: no attendance rows or per-student queries for statistics.
  const groups = await db.classAttendance.groupBy({ by: ["studentId", "status"], where, _count: { _all: true } });
  const counts = new Map<string, number>(); let attended = 0; let records = 0;
  for (const group of groups) {
    records += group._count._all;
    counts.set(group.studentId, (counts.get(group.studentId) ?? 0) + (group.status === "PRESENT" ? group._count._all : 0));
    if (group.status === "PRESENT") attended += group._count._all;
  }
  const ranked = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const low = ranked.filter(([, count]) => count <= 1).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  const pages = Math.max(1, Math.ceil(ranked.length / SIZE)); const page = Math.min(filter.page, pages);
  const lowPages = Math.max(1, Math.ceil(low.length / SIZE)); const lowPage = Math.min(filter.lowPage, lowPages);
  const ranking = ranked.slice((page - 1) * SIZE, page * SIZE); const lowRanking = low.slice((lowPage - 1) * SIZE, lowPage * SIZE);
  const ids = [...new Set([...ranking, ...lowRanking].map(([id]) => id))];
  const students = ids.length ? await db.studentRecord.findMany({ where: { workspaceId, id: { in: ids }, AND: [coachedStudentsWhere] }, select: { id: true, data: true } }) : [];
  const names = new Map(students.map(student => [student.id, studentName(student.data)]));
  const rows = (values: typeof ranked) => values.map(([studentId, count]) => ({ studentId, name: names.get(studentId) ?? "Alumno", attended: count }));
  return { report: "stats", history: [], total: ranked.length, page, pages, summary: { records, attended, distinctStudents: ranked.filter(([, count]) => count > 0).length }, students: rows(ranking), lowFrequency: rows(lowRanking), lowTotal: low.length, lowPage, lowPages, perfectAttendance: { evaluable: false, reason: PERFECT_ATTENDANCE_LIMITATION } };
}
