import { prisma } from "@/lib/prisma";
import { monthRange, serializeAttendance } from "@/lib/attendance";
import type { StudentAttendanceSummary } from "@/types/gestion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext<"/api/asistencias/alumno/[id]">) {
  try {
    const { id } = await context.params;
    const url = new URL(request.url);
    const month = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
    const range = monthRange(month);
    if (!range) return Response.json({ error: "El período no es válido." }, { status: 400 });
    const student = await prisma.studentRecord.findUnique({ where: { id }, select: { id: true, weeklyClasses: { select: { scheduleId: true } } } });
    if (!student) return Response.json({ error: "Alumno no encontrado." }, { status: 404 });
    const history = await prisma.classAttendance.findMany({ where: { studentId: id }, include: { student: true }, orderBy: [{ date: "desc" }, { scheduleStartTime: "asc" }] });
    const assignedScheduleIds = new Set(student.weeklyClasses.map((assignment) => assignment.scheduleId));
    const current = history.filter((record) => record.date >= range.start && record.date < range.end);
    const attended = current.filter((record) => record.status === "PRESENT").length;
    const absent = current.filter((record) => record.status === "ABSENT").length;
    const justified = current.filter((record) => record.status === "JUSTIFIED").length;
    const summary: StudentAttendanceSummary = {
      month,
      attended,
      absent,
      justified,
      percentage: current.length ? Math.round((attended / current.length) * 1000) / 10 : 0,
      lastAttendanceDate: history[0]?.date.toISOString().slice(0, 10) ?? null,
      history: history.map((record) => serializeAttendance(record, record.scheduleId ? assignedScheduleIds.has(record.scheduleId) : false)),
    };
    return Response.json(summary);
  } catch (error) {
    console.error("Error al cargar historial de asistencias", error);
    return Response.json({ error: "No se pudo cargar el historial de asistencias." }, { status: 500 });
  }
}
