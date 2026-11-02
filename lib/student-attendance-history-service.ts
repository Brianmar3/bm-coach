import type { Prisma, PrismaClient } from "@prisma/client";
import { serializeAttendance, studentName, monthRange } from "@/lib/attendance";
import { coachedStudentsWhere } from "@/lib/coached-students";
import { ATTENDANCE_HISTORY_PAGE_SIZE, type AttendanceHistoryFilter, type StudentAttendanceHistory } from "@/lib/student-attendance-history";

export async function loadStudentAttendanceHistory(db: Pick<PrismaClient, "studentRecord" | "classAttendance">, workspaceId: string, studentId: string, filter: AttendanceHistoryFilter, today: string): Promise<StudentAttendanceHistory | null> {
  const student = await db.studentRecord.findFirst({ where: { id: studentId, workspaceId, AND: [coachedStudentsWhere] }, select: { id: true, data: true } });
  if (!student) return null;
  // Match the quick panel's definition, including historical records whose schedule was deleted.
  const base: Prisma.ClassAttendanceWhereInput = { studentId, student: { workspaceId }, OR: [{ scheduleId: null }, { schedule: { workspaceId } }] };
  let date: Prisma.DateTimeFilter | undefined;
  if (filter.filter === "month") {
    const range = monthRange(filter.month)!;
    date = { gte: range.start, lt: range.end };
  } else if (filter.filter === "range") {
    date = { gte: new Date(`${filter.from}T00:00:00.000Z`), lte: new Date(`${filter.to}T00:00:00.000Z`) };
  }
  const where = { ...base, ...(date ? { date } : {}) };
  const month = monthRange(today.slice(0, 7))!;
  const [summary, currentMonth, totalRecords] = await Promise.all([
    db.classAttendance.aggregate({ where: { ...base, status: "PRESENT" }, _count: { _all: true }, _min: { date: true }, _max: { date: true } }),
    db.classAttendance.count({ where: { ...base, status: "PRESENT", date: { gte: month.start, lt: month.end } } }),
    db.classAttendance.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(totalRecords / ATTENDANCE_HISTORY_PAGE_SIZE));
  const page = Math.min(filter.page, pages);
  const records = await db.classAttendance.findMany({ where, include: { student: true }, orderBy: [{ date: "asc" }, { scheduleStartTime: "asc" }, { id: "asc" }], take: ATTENDANCE_HISTORY_PAGE_SIZE, skip: (page - 1) * ATTENDANCE_HISTORY_PAGE_SIZE });
  return {
    student: { id: student.id, name: studentName(student.data) },
    summary: { attended: summary._count._all, firstAttendance: summary._min.date?.toISOString().slice(0, 10) ?? null, lastAttendance: summary._max.date?.toISOString().slice(0, 10) ?? null, currentMonth },
    history: records.map(record => serializeAttendance(record, false)), totalRecords, page, pages,
  };
}
