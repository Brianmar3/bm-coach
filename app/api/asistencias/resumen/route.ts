import { prisma } from "@/lib/prisma";
import { attendanceDate, monthRange, studentName } from "@/lib/attendance";
import type { AttendanceGeneralSummary } from "@/types/gestion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const dateValue = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    const date = attendanceDate(dateValue);
    const range = monthRange(dateValue.slice(0, 7));
    if (!date || !range) return Response.json({ error: "La fecha no es válida." }, { status: 400 });
    const recentStart = new Date(date); recentStart.setUTCDate(recentStart.getUTCDate() - 29);
    const nextDay = new Date(date); nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const [todayRecords, monthlyRecords, absenceGroups] = await Promise.all([
      prisma.classAttendance.groupBy({ by: ["status"], where: { date: { gte: date, lt: nextDay } }, _count: { _all: true } }),
      prisma.classAttendance.groupBy({ by: ["status"], where: { date: { gte: range.start, lt: range.end } }, _count: { _all: true } }),
      prisma.classAttendance.groupBy({ by: ["studentId"], where: { status: "ABSENT", date: { gte: recentStart, lte: date } }, _count: { _all: true }, having: { studentId: { _count: { gte: 2 } } }, orderBy: { _count: { studentId: "desc" } }, take: 8 }),
    ]);
    const students = absenceGroups.length ? await prisma.studentRecord.findMany({ where: { id: { in: absenceGroups.map((group) => group.studentId) } }, select: { id: true, data: true } }) : [];
    const nameById = new Map(students.map((student) => [student.id, studentName(student.data)]));
    const count = (records: typeof todayRecords, status: "PRESENT" | "ABSENT" | "JUSTIFIED") => records.find((record) => record.status === status)?._count._all ?? 0;
    const monthPresent = count(monthlyRecords, "PRESENT");
    const monthTotal = monthlyRecords.reduce((total, record) => total + record._count._all, 0);
    const summary: AttendanceGeneralSummary = {
      date: dateValue,
      month: dateValue.slice(0, 7),
      today: { present: count(todayRecords, "PRESENT"), absent: count(todayRecords, "ABSENT"), justified: count(todayRecords, "JUSTIFIED"), total: todayRecords.reduce((total, record) => total + record._count._all, 0) },
      monthlyPercentage: monthTotal ? Math.round((monthPresent / monthTotal) * 1000) / 10 : 0,
      recentAbsences: absenceGroups.map((group) => ({ studentId: group.studentId, studentName: nameById.get(group.studentId) ?? "Alumno", count: group._count._all })),
    };
    return Response.json(summary);
  } catch (error) {
    console.error("Error al construir resumen de asistencias", error);
    return Response.json({ error: "No se pudo cargar el resumen de asistencias." }, { status: 500 });
  }
}
