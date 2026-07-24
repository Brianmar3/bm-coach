import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { argentinaClock, ensureClassOccurrences } from "@/lib/class-occurrences";
import { addMonthsToDateKey, argentinaDateKey, databaseDateKey, dateKeyToDatabase } from "@/lib/payment-dates";
import type { DashboardActivity, DashboardData } from "@/types/dashboard";
import type { Student } from "@/types/gestion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function studentData(data: Prisma.JsonValue) {
  return data as unknown as Student;
}

function studentName(data: Prisma.JsonValue) {
  const student = studentData(data);
  return `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim() || "Alumno sin nombre";
}

function addDays(value: string, days: number) {
  const date = dateKeyToDatabase(value);
  date.setUTCDate(date.getUTCDate() + days);
  return databaseDateKey(date);
}

function unavailable(error: unknown) {
  return error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError && ["P1001", "P1002", "P1017"].includes(error.code));
}

export async function GET() {
  try {
    const today = argentinaDateKey();
    const clock = argentinaClock();
    const todayDate = dateKeyToDatabase(today);
    const tomorrowDate = dateKeyToDatabase(addDays(today, 1));
    const recentStart = dateKeyToDatabase(addDays(today, -29));
    const monthStart = `${today.slice(0, 7)}-01`;
    const nextMonthStart = addMonthsToDateKey(monthStart);
    const dueSoonLimit = addDays(today, 3);

    await ensureClassOccurrences(35);

    const [
      studentRecords,
      monthPayments,
      recentPayments,
      todayOccurrences,
      legacyTodayAttendances,
      legacyAbsences,
      occurrenceAbsences,
      evaluationEvents,
      recentEvaluations,
      recentRoutines,
      recentLegacyAttendances,
      recentOccurrenceAttendances,
    ] = await Promise.all([
      prisma.studentRecord.findMany({ select: { id: true, data: true } }),
      prisma.studentPayment.aggregate({
        where: { status: "PAGADO", paidDate: { gte: dateKeyToDatabase(monthStart), lt: dateKeyToDatabase(nextMonthStart) } },
        _sum: { amount: true },
      }),
      prisma.studentPayment.findMany({
        where: { status: "PAGADO" },
        select: { id: true, amount: true, paidDate: true, createdAt: true, student: { select: { data: true } } },
        orderBy: [{ paidDate: "desc" }, { createdAt: "desc" }],
        take: 5,
      }),
      prisma.classOccurrence.findMany({
        where: { date: todayDate },
        include: {
          schedule: { include: { assignments: { include: { student: { select: { data: true } } } } } },
          responses: true,
        },
        orderBy: { startTime: "asc" },
      }),
      prisma.classAttendance.findMany({
        where: { date: { gte: todayDate, lt: tomorrowDate }, status: "PRESENT" },
        select: { scheduleId: true, studentId: true },
      }),
      prisma.classAttendance.findMany({
        where: { date: { gte: recentStart, lt: tomorrowDate }, status: "ABSENT" },
        select: { studentId: true, scheduleId: true, date: true, student: { select: { data: true } } },
      }),
      prisma.classOccurrenceAttendance.findMany({
        where: { actualAttendance: "ABSENT", occurrence: { date: { gte: recentStart, lt: tomorrowDate } } },
        select: { studentId: true, student: { select: { data: true } }, occurrence: { select: { date: true, scheduleId: true } } },
      }),
      prisma.coachEvent.findMany({
        where: { type: "EVALUACION", status: "PENDIENTE", date: { gte: todayDate } },
        select: { id: true, title: true, date: true, time: true },
        orderBy: [{ date: "asc" }, { time: "asc" }],
        take: 4,
      }),
      prisma.physicalEvaluation.findMany({
        select: { id: true, date: true, createdAt: true, student: { select: { data: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.trainingRoutine.findMany({
        select: { id: true, name: true, createdAt: true, assignments: { where: { active: true }, select: { student: { select: { data: true } } }, take: 1 } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.classAttendance.findMany({
        select: { id: true, status: true, date: true, scheduleId: true, scheduleLabel: true, studentId: true, student: { select: { data: true } } },
        orderBy: { updatedAt: "desc" },
        take: 8,
      }),
      prisma.classOccurrenceAttendance.findMany({
        where: { actualAttendance: { not: "UNKNOWN" } },
        select: { id: true, studentId: true, actualAttendance: true, updatedAt: true, student: { select: { data: true } }, occurrence: { select: { date: true, scheduleId: true, classNameSnapshot: true } } },
        orderBy: { updatedAt: "desc" },
        take: 8,
      }),
    ]);

    const activeStudents = studentRecords
      .map((record) => ({ id: record.id, student: studentData(record.data) }))
      .filter(({ student }) => student.status !== "inactivo");
    const studentNameById = new Map(activeStudents.map(({ id, student }) => [id, `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim() || "Alumno"]));

    const accounts = activeStudents.map(({ id, student }) => ({
      studentId: id,
      studentName: studentNameById.get(id) ?? "Alumno",
      dueDate: student.dueDate ?? "",
      amount: Number(student.monthlyFee ?? 0),
    }));
    const overdue = accounts.filter((item) => item.dueDate && item.dueDate < today);
    const dueSoon = accounts.filter((item) => item.dueDate >= today && item.dueDate <= dueSoonLimit);
    const paymentAlerts: DashboardData["paymentAlerts"] = [
      ...overdue.map((item) => ({ ...item, status: "VENCIDA" as const })),
      ...dueSoon.map((item) => ({ ...item, status: "VENCE_PRONTO" as const })),
    ].sort((left, right) => left.dueDate.localeCompare(right.dueDate)).slice(0, 8);

    const legacyPresentKeys = new Set(legacyTodayAttendances.map((item) => `${item.scheduleId ?? ""}:${item.studentId}`));
    const todayClasses: DashboardData["todayClasses"] = todayOccurrences.map((occurrence) => {
      const hasNewAttendance = occurrence.responses.some((item) => item.actualAttendance !== "UNKNOWN");
      const enrolled = occurrence.schedule?.assignments.filter(({ student }) => studentData(student.data).status !== "inactivo").length ?? 0;
      const attendance = hasNewAttendance
        ? occurrence.responses.filter((item) => item.actualAttendance === "PRESENT").length
        : occurrence.schedule?.assignments.filter((item) => legacyPresentKeys.has(`${occurrence.scheduleId ?? ""}:${item.studentId}`)).length ?? 0;
      const status = occurrence.status === "CANCELLED"
        ? "cancelada"
        : occurrence.status === "COMPLETED" || clock.time >= occurrence.endTime
          ? "finalizada"
          : clock.time >= occurrence.startTime
            ? "en_curso"
            : "programada";
      return {
        id: occurrence.id,
        scheduleId: occurrence.scheduleId,
        startTime: occurrence.startTime,
        endTime: occurrence.endTime,
        name: occurrence.classNameSnapshot,
        enrolled,
        attendance,
        status,
      };
    });

    const absenceKeys = new Set<string>();
    const absenceCounts = new Map<string, { studentName: string; count: number }>();
    for (const item of occurrenceAbsences) {
      const key = `${item.studentId}:${databaseDateKey(item.occurrence.date)}:${item.occurrence.scheduleId ?? ""}`;
      absenceKeys.add(key);
      const current = absenceCounts.get(item.studentId);
      absenceCounts.set(item.studentId, { studentName: studentName(item.student.data), count: (current?.count ?? 0) + 1 });
    }
    for (const item of legacyAbsences) {
      const key = `${item.studentId}:${databaseDateKey(item.date)}:${item.scheduleId ?? ""}`;
      if (absenceKeys.has(key)) continue;
      const current = absenceCounts.get(item.studentId);
      absenceCounts.set(item.studentId, { studentName: studentName(item.student.data), count: (current?.count ?? 0) + 1 });
    }
    const absenceAlerts = [...absenceCounts.entries()]
      .filter(([, item]) => item.count >= 2)
      .map(([studentId, item]) => ({ studentId, ...item }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 6);

    const attendanceActivityKeys = new Set<string>();
    const attendanceActivity: DashboardActivity[] = [];
    for (const item of recentOccurrenceAttendances) {
      const date = databaseDateKey(item.occurrence.date);
      attendanceActivityKeys.add(`${item.studentId}:${date}:${item.occurrence.scheduleId ?? ""}`);
      attendanceActivity.push({
        id: `new-attendance-${item.id}`,
        type: "attendance",
        title: studentName(item.student.data),
        detail: `${item.occurrence.classNameSnapshot} · ${item.actualAttendance === "PRESENT" ? "Presente" : item.actualAttendance === "ABSENT" ? "Ausente" : "Justificado"}`,
        date: item.updatedAt.toISOString(),
        href: `/asistencias?date=${date}`,
      });
    }
    for (const item of recentLegacyAttendances) {
      const date = databaseDateKey(item.date);
      if (attendanceActivityKeys.has(`${item.studentId}:${date}:${item.scheduleId ?? ""}`)) continue;
      attendanceActivity.push({
        id: `legacy-attendance-${item.id}`,
        type: "attendance",
        title: studentName(item.student.data),
        detail: `${item.scheduleLabel || "Clase"} · ${item.status === "PRESENT" ? "Presente" : item.status === "ABSENT" ? "Ausente" : "Justificado"}`,
        date: item.date.toISOString(),
        href: `/asistencias?date=${date}`,
      });
    }

    const recentActivity: DashboardActivity[] = [
      ...recentPayments.map((item) => ({
        id: `payment-${item.id}`,
        type: "payment" as const,
        title: studentName(item.student.data),
        detail: `Pago registrado · ${new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(item.amount))}`,
        date: (item.paidDate ?? item.createdAt).toISOString(),
        href: "/pagos",
      })),
      ...recentEvaluations.map((item) => ({
        id: `evaluation-${item.id}`,
        type: "evaluation" as const,
        title: studentName(item.student.data),
        detail: "Evaluación registrada",
        date: item.createdAt.toISOString(),
        href: "/evaluaciones",
      })),
      ...recentRoutines.map((item) => ({
        id: `routine-${item.id}`,
        type: "routine" as const,
        title: item.name,
        detail: item.assignments[0] ? `Asignada a ${studentName(item.assignments[0].student.data)}` : "Rutina creada",
        date: item.createdAt.toISOString(),
        href: "/rutinas",
      })),
      ...attendanceActivity,
    ].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 12);

    const data: DashboardData = {
      generatedAt: new Date().toISOString(),
      today,
      metrics: {
        activeStudents: activeStudents.length,
        classesToday: todayClasses.length,
        attendanceToday: todayClasses.reduce((sum, item) => sum + item.attendance, 0),
        monthIncome: Number(monthPayments._sum.amount ?? 0),
        overdueCount: overdue.length,
        dueSoonCount: dueSoon.length,
      },
      todayClasses,
      paymentAlerts,
      absenceAlerts,
      evaluationAlerts: evaluationEvents.map((item) => ({ id: item.id, title: item.title, date: databaseDateKey(item.date), time: item.time })),
      recentActivity,
    };
    return Response.json(data);
  } catch (error) {
    console.error("Error al construir el dashboard", error);
    return Response.json(
      { error: unavailable(error) ? "Neon no está disponible temporalmente." : "No se pudo cargar el Dashboard desde PostgreSQL." },
      { status: unavailable(error) ? 503 : 500 },
    );
  }
}
