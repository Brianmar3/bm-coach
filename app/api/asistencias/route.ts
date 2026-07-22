import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { apiAttendanceStatus, attendanceDate, attendanceStatus, classDayForDate, databaseAttendanceStatus, studentName } from "@/lib/attendance";
import { weeklyScheduleLabel } from "@/lib/student-enrollment";
import type { AttendanceRoster, Student } from "@/types/gestion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function databaseUnavailable(error: unknown) {
  return error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError && ["P1001", "P1002", "P1017"].includes(error.code));
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scheduleId = url.searchParams.get("scheduleId") ?? "";
    const dateValue = url.searchParams.get("date") ?? "";
    const date = attendanceDate(dateValue);
    if (!scheduleId || !date) return Response.json({ error: "Seleccioná una fecha y un horario válidos." }, { status: 400 });
    const schedule = await prisma.weeklyClassSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        assignments: { include: { student: true } },
        attendances: { where: { date }, include: { student: true } },
      },
    });
    if (!schedule) return Response.json({ error: "Horario no encontrado." }, { status: 404 });
    if (classDayForDate(date) !== schedule.dayOfWeek) return Response.json({ error: "La fecha elegida no corresponde al día semanal de este horario." }, { status: 400 });

    const attendanceByStudent = new Map(schedule.attendances.map((attendance) => [attendance.studentId, attendance]));
    const assignedIds = new Set(schedule.assignments.map((assignment) => assignment.studentId));
    const assigned = schedule.assignments
      .filter((assignment) => (assignment.student.data as unknown as Partial<Student>).status === "activo" || attendanceByStudent.has(assignment.studentId))
      .map((assignment) => {
        const attendance = attendanceByStudent.get(assignment.studentId);
        const data = assignment.student.data as unknown as Partial<Student>;
        return { id: assignment.studentId, name: studentName(assignment.student.data), phone: data.phone ?? "", assigned: true, status: attendance ? apiAttendanceStatus(attendance.status) : null, attendanceId: attendance?.id ?? null };
      });
    const exceptional = schedule.attendances
      .filter((attendance) => !assignedIds.has(attendance.studentId))
      .map((attendance) => {
        const data = attendance.student.data as unknown as Partial<Student>;
        return { id: attendance.studentId, name: studentName(attendance.student.data), phone: data.phone ?? "", assigned: false, status: apiAttendanceStatus(attendance.status), attendanceId: attendance.id };
      });
    const roster: AttendanceRoster = {
      date: dateValue,
      schedule: { id: schedule.id, label: weeklyScheduleLabel(schedule), startTime: schedule.startTime, endTime: schedule.endTime },
      students: [...assigned, ...exceptional].sort((left, right) => left.name.localeCompare(right.name, "es")),
    };
    return Response.json(roster);
  } catch (error) {
    console.error("Error al cargar asistencia", error);
    return Response.json({ error: databaseUnavailable(error) ? "Neon no está disponible temporalmente." : "No se pudo cargar la asistencia." }, { status: databaseUnavailable(error) ? 503 : 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as { date?: string; scheduleId?: string; records?: Array<{ studentId?: string; status?: unknown }> };
    const date = attendanceDate(body.date ?? "");
    if (!date || !body.scheduleId || !Array.isArray(body.records) || body.records.length === 0) return Response.json({ error: "Seleccioná fecha, horario y al menos una asistencia." }, { status: 400 });
    const parsedRecords = body.records.map((record) => ({ studentId: record.studentId?.trim() ?? "", status: attendanceStatus(record.status) }));
    if (parsedRecords.some((record) => !record.studentId || !record.status)) return Response.json({ error: "Todos los registros deben tener alumno y estado válido." }, { status: 400 });
    if (new Set(parsedRecords.map((record) => record.studentId)).size !== parsedRecords.length) return Response.json({ error: "Un alumno no puede repetirse en la misma clase y fecha." }, { status: 400 });

    const result = await prisma.$transaction(async (transaction) => {
      const schedule = await transaction.weeklyClassSchedule.findUnique({ where: { id: body.scheduleId }, select: { id: true, dayOfWeek: true, startTime: true, endTime: true, classType: true } });
      if (!schedule) throw new Error("SCHEDULE_NOT_FOUND");
      if (classDayForDate(date) !== schedule.dayOfWeek) throw new Error("DAY_MISMATCH");
      const students = await transaction.studentRecord.findMany({ where: { id: { in: parsedRecords.map((record) => record.studentId) } }, select: { id: true } });
      if (students.length !== parsedRecords.length) throw new Error("STUDENT_NOT_FOUND");
      const label = weeklyScheduleLabel(schedule);
      for (const record of parsedRecords) {
        await transaction.classAttendance.upsert({
          where: { scheduleId_studentId_date: { scheduleId: schedule.id, studentId: record.studentId, date } },
          create: { scheduleId: schedule.id, studentId: record.studentId, date, status: databaseAttendanceStatus(record.status!), scheduleLabel: label, scheduleStartTime: schedule.startTime },
          update: { status: databaseAttendanceStatus(record.status!), scheduleLabel: label, scheduleStartTime: schedule.startTime },
        });
      }
      return parsedRecords.length;
    });
    return Response.json({ ok: true, saved: result });
  } catch (error) {
    console.error("Error al guardar asistencia", error);
    if (error instanceof SyntaxError) return Response.json({ error: "Los datos enviados no son válidos." }, { status: 400 });
    if (error instanceof Error && error.message === "SCHEDULE_NOT_FOUND") return Response.json({ error: "El horario seleccionado ya no existe." }, { status: 404 });
    if (error instanceof Error && error.message === "DAY_MISMATCH") return Response.json({ error: "La fecha no corresponde al día semanal del horario." }, { status: 400 });
    if (error instanceof Error && error.message === "STUDENT_NOT_FOUND") return Response.json({ error: "Uno o más alumnos ya no existen." }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ error: "Ya existe una asistencia para ese alumno, horario y fecha." }, { status: 409 });
    return Response.json({ error: databaseUnavailable(error) ? "Neon no está disponible temporalmente." : "No se pudieron guardar las asistencias." }, { status: databaseUnavailable(error) ? 503 : 500 });
  }
}

export async function POST(request: Request) {
  return PUT(request);
}
