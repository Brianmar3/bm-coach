import { databaseDateKey, dateKeyToDatabase, isDateKey } from "@/lib/payment-dates";
import { ensureClassOccurrences, occurrenceHasStarted, occurrenceStatusLabel } from "@/lib/class-occurrences";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function studentName(data: unknown) {
  const value = data && typeof data === "object" ? data as Record<string, unknown> : {};
  return [value.firstName, value.lastName].filter((part): part is string => typeof part === "string" && Boolean(part.trim())).join(" ") || "Alumno";
}

export async function GET(request: Request) {
  try {
    await ensureClassOccurrences(35);
    const url = new URL(request.url);
    const date = url.searchParams.get("date");
    const where = date && isDateKey(date) ? { date: dateKeyToDatabase(date) } : undefined;
    const occurrences = await prisma.classOccurrence.findMany({
      where,
      include: {
        responses: { include: { student: { select: { id: true, data: true } } } },
        schedule: { include: { assignments: { include: { student: { select: { id: true, data: true } } } } } },
        strengthBlock: { include: { exercises: { orderBy: { order: "asc" } } } },
        workoutLogs: { select: { id: true, studentId: true, status: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: date ? 50 : 250,
    });
    return Response.json(occurrences.map((occurrence) => {
      const responses = new Map(occurrence.responses.map((item) => [item.studentId, item]));
      const assigned = occurrence.schedule?.assignments.map((item) => item.student) ?? [];
      const allStudents = new Map(assigned.map((student) => [student.id, student]));
      occurrence.responses.forEach((item) => allStudents.set(item.student.id, item.student));
      const students = [...allStudents.values()].map((student) => {
        const attendance = responses.get(student.id);
        return { id: student.id, name: studentName(student.data), response: attendance?.response ?? null, actualAttendance: attendance?.actualAttendance ?? "UNKNOWN" };
      });
      const started = occurrenceHasStarted(occurrence.date, occurrence.startTime);
      return {
        id: occurrence.id,
        scheduleId: occurrence.scheduleId,
        date: databaseDateKey(occurrence.date),
        startTime: occurrence.startTime,
        endTime: occurrence.endTime,
        name: occurrence.classNameSnapshot,
        category: occurrence.categorySnapshot,
        status: occurrence.status,
        statusLabel: occurrenceStatusLabel(occurrence.status, started),
        capacity: occurrence.capacityOverride,
        confirmedCount: occurrence.responses.filter((item) => item.response === "GOING").length,
        response: null,
        canRespond: false,
        strengthAvailable: occurrence.strengthEnabled || started,
        strengthEnabled: occurrence.strengthEnabled,
        internalNotes: occurrence.internalNotes,
        strengthBlock: occurrence.strengthBlock,
        workoutLog: null,
        students,
        noResponse: students.filter((student) => student.response === null),
        workoutLogCount: occurrence.workoutLogs.length,
      };
    }));
  } catch (error) {
    console.error("No se pudieron consultar las ocurrencias de clases", error);
    return Response.json({ error: "No se pudieron cargar las clases concretas." }, { status: 500 });
  }
}
