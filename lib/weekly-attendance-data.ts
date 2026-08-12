import "server-only";

import type { ClassActualAttendance, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { databaseDateKey, dateKeyToDatabase } from "@/lib/payment-dates";
import {
  argentinaDateKey,
  assignmentCoversDateKeys,
  studentIsActiveOnDate,
  summarizeStudent,
  weekDays,
  weekLabel,
  weekRange,
  type WeeklyAttendanceEntry,
  type WeeklyAttendanceResponse,
  type WeeklyAttendanceState,
} from "@/lib/weekly-attendance";
import type { Student } from "@/types/gestion";
import { planDays } from "@/lib/student-enrollment";
import { hasGroupClasses } from "@/lib/student-service";

const SERVICE_LABEL = {
  CLASSES: "Clases",
  PERSONALIZED: "Personalizado",
  MIXED: "Mixto",
} as const;

function studentData(value: Prisma.JsonValue) {
  return value as unknown as Partial<Student>;
}

function studentName(value: Prisma.JsonValue) {
  const student = studentData(value);
  return `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim() || "Alumno sin nombre";
}

function dateTimeKey(value: Date) {
  return argentinaDateKey(value);
}

function occurrenceAttendanceState(value: ClassActualAttendance): WeeklyAttendanceState | null {
  if (value === "PRESENT") return "PRESENT";
  if (value === "ABSENT") return "ABSENT";
  // La pantalla diaria persiste JUSTIFIED como CANCELLED en la respuesta de ocurrencia.
  if (value === "CANCELLED") return "JUSTIFIED";
  return null;
}

function attendanceState(value: "PRESENT" | "ABSENT" | "JUSTIFIED"): WeeklyAttendanceState {
  return value;
}

function historicalStatusAllowsClass(
  date: string,
  data: Partial<Student>,
  events: Array<{ type: string; eventDate: Date }>,
) {
  const joinedAt = typeof data.joinedAt === "string" ? data.joinedAt : "";
  return studentIsActiveOnDate(joinedAt || null, events.map((event) => ({ type: event.type, date: databaseDateKey(event.eventDate) })), date);
}

function assignmentCoversDate(assignment: { assignedAt: Date; endedAt: Date | null }, date: string) {
  return assignmentCoversDateKeys(dateTimeKey(assignment.assignedAt), assignment.endedAt ? dateTimeKey(assignment.endedAt) : null, date);
}

function recordKey(studentId: string, date: string, scheduleId: string | null, occurrenceId: string | null) {
  return `${studentId}|${date}|${scheduleId ?? occurrenceId ?? "unassigned"}`;
}

export async function loadWeeklyAttendance(referenceDate: string): Promise<WeeklyAttendanceResponse> {
  const range = weekRange(referenceDate);
  if (!range) throw new Error("INVALID_WEEK");
  const startDate = dateKeyToDatabase(range.start);
  const endDate = dateKeyToDatabase(range.endExclusive);

  const [attendanceRecords, occurrences, students, memberships, statusEvents] = await Promise.all([
    prisma.classAttendance.findMany({
      where: { date: { gte: startDate, lt: endDate } },
      select: {
        id: true,
        studentId: true,
        scheduleId: true,
        date: true,
        status: true,
        scheduleLabel: true,
        scheduleStartTime: true,
        updatedAt: true,
      },
      orderBy: [{ date: "asc" }, { scheduleStartTime: "asc" }],
    }),
    prisma.classOccurrence.findMany({
      where: { date: { gte: startDate, lt: endDate } },
      select: {
        id: true,
        scheduleId: true,
        date: true,
        startTime: true,
        endTime: true,
        classNameSnapshot: true,
        categorySnapshot: true,
        status: true,
        responses: {
          select: {
            id: true,
            studentId: true,
            response: true,
            actualAttendance: true,
            checkedInAt: true,
            updatedAt: true,
          },
        },
        schedule: {
          select: {
            assignments: {
              select: { studentId: true, assignedAt: true, endedAt: true, active: true },
            },
          },
        },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    prisma.studentRecord.findMany({
      select: { id: true, data: true, serviceType: true },
    }),
    prisma.studentMembershipHistory.findMany({
      where: {
        startDate: { lt: endDate },
        OR: [{ endDate: null }, { endDate: { gte: startDate } }],
      },
      select: { studentId: true, startDate: true, endDate: true, planName: true, serviceType: true, frequencyDays: true, status: true },
      orderBy: { startDate: "asc" },
    }),
    prisma.studentStatusEvent.findMany({
      where: { eventDate: { lt: endDate } },
      select: { studentId: true, type: true, eventDate: true },
      orderBy: { eventDate: "asc" },
    }),
  ]);

  const studentById = new Map(students.map((student) => [student.id, student]));
  const eventsByStudent = new Map<string, typeof statusEvents>();
  for (const event of statusEvents) {
    const list = eventsByStudent.get(event.studentId) ?? [];
    list.push(event);
    eventsByStudent.set(event.studentId, list);
  }
  const membershipByStudent = new Map<string, typeof memberships>();
  for (const membership of memberships) {
    const list = membershipByStudent.get(membership.studentId) ?? [];
    list.push(membership);
    membershipByStudent.set(membership.studentId, list);
  }

  const entriesByStudent = new Map<string, Map<string, WeeklyAttendanceEntry>>();
  const scheduleLabels = new Map<string, string>();
  let inferredAssignmentOpportunity = false;
  let missingMembership = false;

  function setEntry(studentId: string, key: string, entry: WeeklyAttendanceEntry, overwrite = false) {
    const entries = entriesByStudent.get(studentId) ?? new Map<string, WeeklyAttendanceEntry>();
    if (overwrite || !entries.has(key)) entries.set(key, entry);
    entriesByStudent.set(studentId, entries);
    if (entry.scheduleId) scheduleLabels.set(entry.scheduleId, `${entry.discipline} · ${entry.startTime}`);
  }

  const occurrenceByScheduleDate = new Map(
    occurrences.filter((item) => item.scheduleId).map((item) => [`${item.scheduleId}|${databaseDateKey(item.date)}`, item] as const),
  );

  for (const attendance of attendanceRecords) {
    const date = databaseDateKey(attendance.date);
    const occurrence = attendance.scheduleId
      ? occurrenceByScheduleDate.get(`${attendance.scheduleId}|${date}`)
      : null;
    const discipline = occurrence?.categorySnapshot || occurrence?.classNameSnapshot || attendance.scheduleLabel || "Clase";
    const key = recordKey(attendance.studentId, date, attendance.scheduleId, occurrence?.id ?? null);
    setEntry(attendance.studentId, key, {
      id: attendance.id,
      occurrenceId: occurrence?.id ?? null,
      scheduleId: attendance.scheduleId,
      date,
      startTime: attendance.scheduleStartTime || occurrence?.startTime || "",
      endTime: occurrence?.endTime ?? "",
      discipline,
      status: attendanceState(attendance.status),
      recordedAt: attendance.updatedAt.toISOString(),
      observation: null,
      recordedBy: null,
      method: null,
    }, true);
  }

  for (const occurrence of occurrences) {
    const date = databaseDateKey(occurrence.date);
    const discipline = occurrence.categorySnapshot || occurrence.classNameSnapshot || "Clase";
    const explicitStudents = new Set(occurrence.responses.map((response) => response.studentId));
    const candidateStudents = new Set(explicitStudents);
    for (const assignment of occurrence.schedule?.assignments ?? []) {
      const student = studentById.get(assignment.studentId);
      if (!student || !assignmentCoversDate(assignment, date)) continue;
      if (!historicalStatusAllowsClass(date, studentData(student.data), eventsByStudent.get(student.id) ?? [])) continue;
      candidateStudents.add(student.id);
      if (!explicitStudents.has(student.id)) inferredAssignmentOpportunity = true;
    }

    for (const studentId of candidateStudents) {
      const response = occurrence.responses.find((item) => item.studentId === studentId);
      const actual = response ? occurrenceAttendanceState(response.actualAttendance) : null;
      const status: WeeklyAttendanceState = occurrence.status === "CANCELLED"
        ? "CANCELLED"
        : actual ?? "NO_RECORD";
      const key = recordKey(studentId, date, occurrence.scheduleId, occurrence.id);
      setEntry(studentId, key, {
        id: response?.id ?? `occurrence-${occurrence.id}-${studentId}`,
        occurrenceId: occurrence.id,
        scheduleId: occurrence.scheduleId,
        date,
        startTime: occurrence.startTime,
        endTime: occurrence.endTime,
        discipline,
        status,
        recordedAt: actual ? (response?.checkedInAt ?? response?.updatedAt ?? null)?.toISOString() ?? null : null,
        observation: null,
        recordedBy: null,
        method: null,
      });
    }
  }

  const historical = range.start < mondayForCurrentWeek();
  for (const student of students) {
    const data = studentData(student.data);
    const events = eventsByStudent.get(student.id) ?? [];
    const activeDuringWeek = weekDays(range.start).some((day) => historicalStatusAllowsClass(day.date, data, events));
    const membershipsForWeek = (membershipByStudent.get(student.id) ?? []).filter((membership) => {
      const start = databaseDateKey(membership.startDate);
      const end = membership.endDate ? databaseDateKey(membership.endDate) : null;
      return start < range.endExclusive && (!end || end >= range.start);
    });
    const currentMembership = membershipsForWeek.at(-1);
    const serviceType = currentMembership?.serviceType ?? (!historical ? student.serviceType : null);
    const expected = currentMembership?.frequencyDays ?? (!historical ? planDays(data.plan ?? "") : null) ?? 0;
    if (activeDuringWeek && serviceType && hasGroupClasses(serviceType) && expected > 0 && !entriesByStudent.has(student.id)) {
      entriesByStudent.set(student.id, new Map());
    }
  }
  const weeklyStudents = [...entriesByStudent].flatMap(([studentId, entryMap]) => {
    const student = studentById.get(studentId);
    if (!student) return [];
    const entries = [...entryMap.values()].sort((left, right) => left.date.localeCompare(right.date) || left.startTime.localeCompare(right.startTime));
    const membershipsForWeek = (membershipByStudent.get(studentId) ?? []).filter((membership) => {
      const start = databaseDateKey(membership.startDate);
      const end = membership.endDate ? databaseDateKey(membership.endDate) : null;
      return start < range.endExclusive && (!end || end >= range.start);
    });
    const serviceSet = new Set(membershipsForWeek.map((membership) => SERVICE_LABEL[membership.serviceType]));
    const planSet = new Set(membershipsForWeek.map((membership) => membership.planName).filter(Boolean));
    const currentMembership = membershipsForWeek.at(-1);
    const expected = currentMembership?.frequencyDays ?? (!historical ? planDays(studentData(student.data).plan ?? "") : null) ?? 0;
    if (historical && membershipsForWeek.length === 0) missingMembership = true;
    return [summarizeStudent({
      id: student.id,
      name: studentName(student.data),
      studentType: studentData(student.data).studentType ?? "No disponible",
      service: serviceSet.size > 1 ? "Varios" : [...serviceSet][0] ?? (historical ? null : SERVICE_LABEL[student.serviceType]),
      plan: planSet.size > 1 ? "Varios" : [...planSet][0] ?? null,
      entries,
      expected,
      weekClosed: historical,
    })];
  }).sort((left, right) => left.name.localeCompare(right.name, "es"));

  const allEntries = weeklyStudents.flatMap((student) => student.entries);
  const present = weeklyStudents.reduce((sum, student) => sum + student.present, 0);
  const absent = weeklyStudents.reduce((sum, student) => sum + student.absent, 0);
  const justified = weeklyStudents.reduce((sum, student) => sum + student.justified, 0);
  const attendanceDenominator = present + absent + justified;
  const studentsWithRecordedState = weeklyStudents.filter((student) => student.present + student.absent + student.justified > 0).length;
  const completedClassKeys = new Set<string>();
  for (const occurrence of occurrences) {
    if (occurrence.status === "COMPLETED") completedClassKeys.add(occurrence.id);
  }
  for (const entry of allEntries) {
    if (["PRESENT", "ABSENT", "JUSTIFIED"].includes(entry.status)) {
      completedClassKeys.add(entry.occurrenceId ?? `${entry.date}|${entry.scheduleId ?? entry.startTime}`);
    }
  }
  const unresolvedPastClasses = occurrences.some((occurrence) =>
    occurrence.status === "SCHEDULED" &&
    databaseDateKey(occurrence.date) < argentinaDateKey() &&
    !completedClassKeys.has(occurrence.id),
  );

  const warnings = [
    historical
      ? "Los estados manuales provienen de registros persistidos. Los faltantes se derivan al consultar la semana cerrada y no crean filas en la base de datos."
      : "La semana actual permanece abierta: Sin registro sigue pendiente y no genera ausencias anticipadas.",
    "Los registros actuales no guardan observación, actor ni método de carga; esos campos figuran como No disponible.",
  ];
  if (historical && inferredAssignmentOpportunity) warnings.push("Las asistencias registradas son reales. Algunas oportunidades se obtienen de intervalos de asignación; las reasignaciones antiguas pueden no estar completas.");
  if (missingMembership) warnings.push("El servicio o plan aparece como No disponible cuando no existe historial de membresía para esa semana.");
  if (occurrences.length === 0 && historical) warnings.push("No existen ocurrencias concretas para esta semana; no se reconstruyeron clases usando horarios actuales.");
  if (unresolvedPastClasses) warnings.push("Clases realizadas figura como No disponible porque hay ocurrencias pasadas sin cierre ni registros de asistencia.");

  return {
    metadata: {
      start: range.start,
      end: range.end,
      endExclusive: range.endExclusive,
      label: weekLabel(range.start),
      generatedAt: new Date().toISOString(),
      historicalIncomplete: warnings.length > 2,
    },
    summary: {
      studentsWithAttendance: weeklyStudents.filter((student) => student.present > 0).length,
      present,
      absent,
      justified,
      attendancePercentage: attendanceDenominator ? Math.round((present / attendanceDenominator) * 1000) / 10 : null,
      completedClasses: unresolvedPastClasses ? null : completedClassKeys.size,
      cancelledClasses: occurrences.filter((occurrence) => occurrence.status === "CANCELLED").length,
      averagePerStudent: studentsWithRecordedState ? Math.round((present / studentsWithRecordedState) * 10) / 10 : null,
    },
    days: weekDays(range.start),
    students: weeklyStudents,
    disciplines: [...new Set(allEntries.map((entry) => entry.discipline))].sort((left, right) => left.localeCompare(right, "es")),
    schedules: [...scheduleLabels].map(([id, label]) => ({ id, label })).sort((left, right) => left.label.localeCompare(right.label, "es")),
    warnings,
  };
}

function mondayForCurrentWeek() {
  const range = weekRange(argentinaDateKey());
  return range?.start ?? argentinaDateKey();
}
