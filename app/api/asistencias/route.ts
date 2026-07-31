import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { apiAttendanceStatus, attendanceDate, attendanceStatus, classDayForDate, databaseAttendanceStatus, studentName } from "@/lib/attendance";
import { weeklyScheduleLabel } from "@/lib/student-enrollment";
import type { AttendanceRoster, Student } from "@/types/gestion";
import { achievementCelebrationPayload, notifyNewAchievements } from "@/lib/push-notifications";
import { reconcileStudentPointsAfterMutation } from "@/lib/student-points";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function databaseUnavailable(error: unknown) {
  return error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError && ["P1001", "P1002", "P1017"].includes(error.code));
}

function occurrenceAttendanceStatus(value: string) {
  if (value === "PRESENT") return "presente" as const;
  if (value === "ABSENT") return "ausente" as const;
  if (value === "CANCELLED") return "justificado" as const;
  return null;
}

function databaseOccurrenceAttendanceStatus(value: AttendanceStatus) {
  if (value === "presente") return "PRESENT" as const;
  if (value === "ausente") return "ABSENT" as const;
  return "CANCELLED" as const;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scheduleId = url.searchParams.get("scheduleId") ?? "";
    const dateValue = url.searchParams.get("date") ?? "";
    const date = attendanceDate(dateValue);
    if (!date) return Response.json({ error: "Seleccioná una fecha válida." }, { status: 400 });

    if (!scheduleId) {
      const students = await prisma.studentRecord.findMany({ include: { primarySchedule: true }, orderBy: { updatedAt: "desc" } });
      const activeStudents = students.filter((student) =>
        (student.data as unknown as Partial<Student>).status === "activo" &&
        student.serviceType !== "PERSONALIZED"
      );
      const attendanceRecords = await prisma.classAttendance.findMany({ where: { date, scheduleId: null }, include: { student: true }, orderBy: { updatedAt: "desc" } });
      const attendanceByStudent = new Map(attendanceRecords.map((attendance) => [attendance.studentId, attendance]));
      const rosterStudents = activeStudents.map((student) => {
        const data = student.data as unknown as Partial<Student>;
        const attendance = attendanceByStudent.get(student.id);
        return { id: student.id, name: studentName(student.data), phone: data.phone ?? "", assigned: false, confirmation: null, status: attendance ? apiAttendanceStatus(attendance.status) : null, attendanceId: attendance?.id ?? null };
      }).sort((left, right) => left.name.localeCompare(right.name, "es"));
      const roster: AttendanceRoster = {
        date: dateValue,
        schedule: { id: "", label: "Sin horario", startTime: "", endTime: "" },
        students: rosterStudents,
      };
      return Response.json(roster);
    }

    const schedule = await prisma.weeklyClassSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        assignments: { where: { active: true }, include: { student: true } },
        attendances: { where: { date }, include: { student: true } },
        occurrences: {
          where: { date },
          take: 1,
          include: {
            responses: { include: { student: true } },
          },
        },
      },
    });
    if (!schedule) return Response.json({ error: "Horario no encontrado." }, { status: 404 });
    if (classDayForDate(date) !== schedule.dayOfWeek) return Response.json({ error: "La fecha elegida no corresponde al día semanal de este horario." }, { status: 400 });

    const attendanceByStudent = new Map(schedule.attendances.map((attendance) => [attendance.studentId, attendance]));
    const occurrence = schedule.occurrences[0] ?? null;
    const occurrenceByStudent = new Map(
      (occurrence?.responses ?? []).map((response) => [response.studentId, response]),
    );
    const assignedIds = new Set(schedule.assignments.map((assignment) => assignment.studentId));
    const assigned = schedule.assignments
      .filter((assignment) => (assignment.student.data as unknown as Partial<Student>).status === "activo" || attendanceByStudent.has(assignment.studentId))
      .map((assignment) => {
        const attendance = attendanceByStudent.get(assignment.studentId);
        const occurrenceAttendance = occurrenceByStudent.get(assignment.studentId);
        const data = assignment.student.data as unknown as Partial<Student>;
        return {
          id: assignment.studentId,
          name: studentName(assignment.student.data),
          phone: data.phone ?? "",
          assigned: true,
          confirmation: occurrenceAttendance?.response ?? null,
          status: attendance
            ? apiAttendanceStatus(attendance.status)
            : occurrenceAttendanceStatus(occurrenceAttendance?.actualAttendance ?? "UNKNOWN"),
          attendanceId: attendance?.id ?? null,
        };
      });
    const exceptionalStudents = new Map<string, typeof schedule.assignments[number]["student"]>();
    schedule.attendances
      .filter((attendance) => !assignedIds.has(attendance.studentId))
      .forEach((attendance) =>
        exceptionalStudents.set(attendance.studentId, attendance.student),
      );
    (occurrence?.responses ?? [])
      .filter((response) => !assignedIds.has(response.studentId))
      .forEach((response) =>
        exceptionalStudents.set(response.studentId, response.student),
      );
    const exceptional = [...exceptionalStudents].map(([studentId, student]) => {
      const attendance = attendanceByStudent.get(studentId);
      const occurrenceAttendance = occurrenceByStudent.get(studentId);
      const data = student.data as unknown as Partial<Student>;
      return {
        id: studentId,
        name: studentName(student.data),
        phone: data.phone ?? "",
        assigned: false,
        confirmation: occurrenceAttendance?.response ?? null,
        status: attendance
          ? apiAttendanceStatus(attendance.status)
          : occurrenceAttendanceStatus(occurrenceAttendance?.actualAttendance ?? "UNKNOWN"),
        attendanceId: attendance?.id ?? null,
      };
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
    const body = await request.json() as { date?: string; scheduleId?: string | null; records?: Array<{ studentId?: string; status?: unknown }> };
    const date = attendanceDate(body.date ?? "");
    if (!date || !Array.isArray(body.records) || body.records.length === 0) return Response.json({ error: "Seleccioná fecha y al menos una asistencia." }, { status: 400 });
    const parsedRecords = body.records.map((record) => ({ studentId: record.studentId?.trim() ?? "", status: attendanceStatus(record.status) }));
    if (parsedRecords.some((record) => !record.studentId || !record.status)) return Response.json({ error: "Todos los registros deben tener alumno y estado válido." }, { status: 400 });
    if (new Set(parsedRecords.map((record) => record.studentId)).size !== parsedRecords.length) return Response.json({ error: "Un alumno no puede repetirse en la misma clase y fecha." }, { status: 400 });

    const result = await prisma.$transaction(async (transaction) => {
      const schedule = body.scheduleId
        ? await transaction.weeklyClassSchedule.findUnique({ where: { id: body.scheduleId }, select: { id: true, dayOfWeek: true, startTime: true, endTime: true, classType: true } })
        : null;
      if (body.scheduleId && !schedule) throw new Error("SCHEDULE_NOT_FOUND");
      if (body.scheduleId && schedule && classDayForDate(date) !== schedule.dayOfWeek) throw new Error("DAY_MISMATCH");
      const students = await transaction.studentRecord.findMany({ where: { id: { in: parsedRecords.map((record) => record.studentId) } }, select: { id: true } });
      if (students.length !== parsedRecords.length) throw new Error("STUDENT_NOT_FOUND");
      const label = schedule ? weeklyScheduleLabel(schedule) : "Sin horario";
      const startTime = schedule?.startTime ?? "";
      const occurrence = schedule
        ? await transaction.classOccurrence.findFirst({
            where: { scheduleId: schedule.id, date },
            select: { id: true },
          })
        : null;
      for (const record of parsedRecords) {
        if (body.scheduleId) {
          await transaction.classAttendance.upsert({
            where: { scheduleId_studentId_date: { scheduleId: body.scheduleId, studentId: record.studentId, date } },
            create: { scheduleId: body.scheduleId, studentId: record.studentId, date, status: databaseAttendanceStatus(record.status!), scheduleLabel: label, scheduleStartTime: startTime },
            update: { status: databaseAttendanceStatus(record.status!), scheduleLabel: label, scheduleStartTime: startTime },
          });
          if (occurrence) {
            await transaction.classOccurrenceAttendance.upsert({
              where: {
                occurrenceId_studentId: {
                  occurrenceId: occurrence.id,
                  studentId: record.studentId,
                },
              },
              create: {
                occurrenceId: occurrence.id,
                studentId: record.studentId,
                actualAttendance: databaseOccurrenceAttendanceStatus(record.status!),
                checkedInAt: new Date(),
              },
              update: {
                actualAttendance: databaseOccurrenceAttendanceStatus(record.status!),
                checkedInAt: new Date(),
              },
            });
          }
          continue;
        }
        const existingAttendance = await transaction.classAttendance.findFirst({
          where: {
            studentId: record.studentId,
            date,
            ...(body.scheduleId ? { scheduleId: body.scheduleId } : { scheduleId: null }),
          },
        });
        if (existingAttendance) {
          await transaction.classAttendance.update({
            where: { id: existingAttendance.id },
            data: { status: databaseAttendanceStatus(record.status!), scheduleLabel: label, scheduleStartTime: startTime },
          });
        } else {
          await transaction.classAttendance.create({
            data: { scheduleId: body.scheduleId ?? null, studentId: record.studentId, date, status: databaseAttendanceStatus(record.status!), scheduleLabel: label, scheduleStartTime: startTime },
          });
        }
      }
      return parsedRecords.length;
    });
    const claimedByStudent = new Map(
      await Promise.all(parsedRecords
        .filter((record) => record.status === "presente")
        .map(async (record) => [record.studentId, await notifyNewAchievements(record.studentId)] as const)),
    );
    const pointResults = new Map(
      await Promise.all(parsedRecords.map(async (record) => [
        record.studentId,
        await reconcileStudentPointsAfterMutation(record.studentId),
      ] as const)),
    );
    const achievementResults = await Promise.all([...claimedByStudent].map(async ([studentId, claimed]) => {
      const newAchievements = await achievementCelebrationPayload(studentId, claimed);
      return {
        studentId,
        newAchievements,
        pointsAwarded: pointResults.get(studentId)?.gained.reduce((sum, item) => sum + item.points, 0) ?? 0,
      };
    }));
    return Response.json({ ok: true, saved: result, achievementResults });
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
