import { Prisma, type ClassWeekday } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  addMonthsToDateKey,
  argentinaDateKey,
  argentinaDateTimeBoundary,
  databaseDateKey,
  dateKeyToDatabase,
  paymentAccountStatus,
} from "@/lib/payment-dates";
import type { DashboardData } from "@/types/dashboard";
import type { PaymentAccountStatus, Student } from "@/types/gestion";
import { ensureClassOccurrences, occurrenceClassName } from "@/lib/class-occurrences";
import {
  buildDashboardPriorities,
  compactRanking,
  countPaymentStatuses,
  dashboardPaymentAttention,
  latestEvaluationPriorityCounts,
  lowActivityStudentIds,
} from "@/lib/dashboard-read-model";
import { registeredTodaySummary, type TraceablePayment } from "@/lib/monthly-traceability";
import { requireAdminApiResponse } from "@/lib/admin-api-auth";
import { normalizeArgentineWhatsAppPhone } from "@/lib/argentine-phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEEKDAY: Partial<Record<number, ClassWeekday>> = { 1: "MONDAY", 2: "TUESDAY", 3: "WEDNESDAY", 4: "THURSDAY", 5: "FRIDAY" };
const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const STATUS_ORDER: Record<PaymentAccountStatus, number> = { SIN_CONFIGURAR: 0, SIN_PAGOS: 1, VENCIDA: 2, VENCE_PRONTO: 3, AL_DIA: 4 };

function studentData(data: Prisma.JsonValue) {
  return data as unknown as Student;
}

function studentName(student: Student) {
  return `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim() || "Alumno sin nombre";
}

function addDays(value: string, days: number) {
  const date = dateKeyToDatabase(value);
  date.setUTCDate(date.getUTCDate() + days);
  return databaseDateKey(date);
}

function startOfWeek(value: string) {
  const date = dateKeyToDatabase(value);
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return databaseDateKey(date);
}

function planDays(value: string) {
  const match = value.match(/(?:^|\D)([1-7])(?:\D|$)/);
  return match ? Number(match[1]) : null;
}

function databaseUnavailable(error: unknown) {
  return error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError && ["P1001", "P1002", "P1017"].includes(error.code));
}

export async function GET() {
  try {
    const unauthorized = await requireAdminApiResponse();
    if (unauthorized) return unauthorized;
    const today = argentinaDateKey();
    const monthStart = `${today.slice(0, 7)}-01`;
    const nextMonthStart = addMonthsToDateKey(monthStart);
    const threeDaysFromToday = addDays(today, 3);
    const previousMonthStart = addMonthsToDateKey(monthStart, -1);
    const weekStart = startOfWeek(today);
    const nextWeekStart = addDays(weekStart, 7);
    const todayDate = dateKeyToDatabase(today);
    const tomorrowDate = dateKeyToDatabase(addDays(today, 1));
    const recentActivityStart = dateKeyToDatabase(addDays(today, -6));
    const establishedBefore = argentinaDateTimeBoundary(addDays(today, -7));
    const weekday = WEEKDAY[todayDate.getUTCDay()];
    await ensureClassOccurrences(35);

    const [studentRecords, paymentRecords, todayPaymentRecords, todayOccurrences, todayAttendances, weeklyAttendances, newWeeklyAttendances, events, evaluations, pointTotals, routineAssignments, classAssignments, recentWorkouts, recentAttendances, recentOccurrenceAttendances] = await Promise.all([
      prisma.studentRecord.findMany({
        select: {
          id: true,
          data: true,
          createdAt: true,
          payments: { select: { status: true, paidDate: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.studentPayment.findMany({
        where: { status: "PAGADO", paidDate: { gte: dateKeyToDatabase(previousMonthStart), lt: dateKeyToDatabase(nextMonthStart) } },
        select: { amount: true, paidDate: true },
        orderBy: { paidDate: "asc" },
      }),
      prisma.studentPayment.findMany({
        where: { status: "PAGADO", createdAt: { gte: argentinaDateTimeBoundary(today), lt: argentinaDateTimeBoundary(addDays(today, 1)) } },
        select: { id: true, studentId: true, amount: true, paidDate: true, billingPeriod: true, method: true, status: true, createdAt: true },
        orderBy: [{ createdAt: "desc" }],
      }),
      weekday ? prisma.classOccurrence.findMany({
        where: { date: todayDate },
        include: {
          schedule: { include: { assignments: { where: { active: true }, include: { student: { select: { data: true } } } } } },
          responses: { include: { student: { select: { data: true } } } },
        },
        orderBy: { startTime: "asc" },
      }) : Promise.resolve([]),
      prisma.classAttendance.groupBy({
        by: ["scheduleId"],
        where: { date: { gte: todayDate, lt: tomorrowDate }, status: "PRESENT" },
        _count: { _all: true },
      }),
      prisma.classAttendance.groupBy({
        by: ["date", "status"],
        where: { date: { gte: dateKeyToDatabase(weekStart), lt: dateKeyToDatabase(nextWeekStart) } },
        _count: { _all: true },
        orderBy: { date: "asc" },
      }),
      prisma.classOccurrenceAttendance.findMany({
        where: {
          actualAttendance: { not: "UNKNOWN" },
          occurrence: { date: { gte: dateKeyToDatabase(weekStart), lt: dateKeyToDatabase(nextWeekStart) } },
        },
        select: { actualAttendance: true, occurrence: { select: { date: true } } },
      }),
      prisma.coachEvent.findMany({
        where: { status: "PENDIENTE", date: { gte: todayDate } },
        orderBy: [{ date: "asc" }, { time: "asc" }],
        take: 3,
      }),
      prisma.physicalEvaluation.findMany({
        select: { studentId: true, status: true, reassessmentDate: true },
        distinct: ["studentId"],
        orderBy: [{ studentId: "asc" }, { date: "desc" }, { version: "desc" }],
      }),
      prisma.studentPointTransaction.groupBy({
        by: ["studentId"],
        where: { active: true, occurredAt: { gte: argentinaDateTimeBoundary(monthStart) } },
        _sum: { points: true },
      }),
      prisma.trainingRoutineAssignment.findMany({
        where: { active: true, assignedAt: { lte: establishedBefore }, routine: { kind: "ASSIGNED", status: "ACTIVA", days: { some: { active: true } } } },
        select: { studentId: true },
      }),
      prisma.weeklyClassAssignment.findMany({
        where: { active: true, assignedAt: { lte: establishedBefore }, schedule: { active: true } },
        select: { studentId: true },
      }),
      prisma.workoutSession.findMany({
        where: { status: "COMPLETED", date: { gte: recentActivityStart, lt: tomorrowDate } },
        select: { studentId: true, date: true },
      }),
      prisma.classAttendance.findMany({
        where: { status: "PRESENT", date: { lt: tomorrowDate } },
        select: { studentId: true, date: true },
        orderBy: { date: "desc" },
      }),
      prisma.classOccurrenceAttendance.findMany({
        where: { actualAttendance: "PRESENT", occurrence: { date: { lt: tomorrowDate } } },
        select: { studentId: true, occurrence: { select: { date: true } } },
      }),
    ]);

    const students = studentRecords.map((record) => ({ ...record, student: studentData(record.data) }));
    const active = students.filter(({ student }) => student.status !== "inactivo");
    const activeStudentIds = new Set(active.map(({ id }) => id));
    const personalizedStudentIds = new Set(active.filter(({ student }) => student.serviceType === "PERSONALIZED" || student.serviceType === "MIXED").map(({ id }) => id));
    const namesByStudent = new Map(active.map(({ id, student }) => [id, studentName(student)]));
    const accounts = active.map(({ id, student, payments }) => ({
      studentId: id,
      studentName: studentName(student),
      plan: student.plan ?? "",
      dueDate: student.dueDate ?? "",
      amount: Number(student.monthlyFee ?? 0),
      status: paymentAccountStatus({
        dueDate: student.dueDate ?? "",
        monthlyFee: Number(student.monthlyFee ?? 0),
        validPaymentCount: payments.filter((payment) => payment.status === "PAGADO" && payment.paidDate).length,
        hasOutstandingDebt: payments.some((payment) => payment.status === "PENDIENTE" || payment.status === "VENCIDO"),
      }, today),
    }));
    const actionableAccounts = accounts
      .filter((account) => account.status === "VENCIDA" || account.status === "VENCE_PRONTO" || account.status === "SIN_PAGOS")
      .sort((left, right) => STATUS_ORDER[left.status] - STATUS_ORDER[right.status] || left.dueDate.localeCompare(right.dueDate));
    const threeDayAccounts = accounts.filter((account) =>
      account.dueDate &&
      (account.dueDate < today || (account.dueDate >= today && account.dueDate <= threeDaysFromToday)),
    );
    const paymentAttention = dashboardPaymentAttention(accounts, today, threeDaysFromToday);
    const dueSoonThreeDaysCount = paymentAttention.dueSoonCount;
    const attentionStudentIds = new Set([...paymentAttention.overdueStudentIds, ...paymentAttention.dueSoonStudentIds]);
    const attentionAccounts = accounts.filter((account) => attentionStudentIds.has(account.studentId));
    const paymentPriorityCounts = countPaymentStatuses(accounts.map((account) => account.status));
    const evaluationPriorityCounts = latestEvaluationPriorityCounts(evaluations, activeStudentIds, today);
    const priorities = buildDashboardPriorities({
      overdue: paymentAttention.overdueCount,
      dueSoon: dueSoonThreeDaysCount,
      unconfigured: paymentPriorityCounts.unconfigured,
      reassessments: evaluationPriorityCounts.reassessments,
      evaluationsInProgress: evaluationPriorityCounts.inProgress,
    });
    const ranking = compactRanking(
      pointTotals.map((entry) => ({ studentId: entry.studentId, points: entry._sum.points ?? 0 })),
      namesByStudent,
      activeStudentIds,
    );
    const estimatedPendingBalance = threeDayAccounts.every((account) => account.amount > 0)
      ? threeDayAccounts.reduce((sum, account) => sum + account.amount, 0)
      : null;

    const currentPayments = paymentRecords.filter((payment) => payment.paidDate && databaseDateKey(payment.paidDate) >= monthStart);
    const previousPayments = paymentRecords.filter((payment) => payment.paidDate && databaseDateKey(payment.paidDate) < monthStart);
    const monthIncome = currentPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const previousIncome = previousPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const todayPaymentSummary = registeredTodaySummary(todayPaymentRecords.map((payment): TraceablePayment => ({
      id: payment.id, studentId: payment.studentId, amount: Number(payment.amount), status: payment.status,
      billingPeriod: payment.billingPeriod ? databaseDateKey(payment.billingPeriod) : null,
      paidDate: payment.paidDate ? databaseDateKey(payment.paidDate) : null,
      createdAt: payment.createdAt.toISOString(), method: payment.method,
    })), today.slice(0, 7), monthIncome, namesByStudent);
    const establishedRoutineIds = new Set(routineAssignments.map((item) => item.studentId));
    const establishedClassIds = new Set(classAssignments.map((item) => item.studentId));
    const weeklyFrequencyByStudent = new Map<string, number>();
    for (const assignment of classAssignments) weeklyFrequencyByStudent.set(assignment.studentId, (weeklyFrequencyByStudent.get(assignment.studentId) ?? 0) + 1);
    const recentWorkoutIds = new Set(recentWorkouts.map((item) => item.studentId));
    const lastAttendanceByStudent = new Map<string, string>();
    for (const attendance of recentAttendances) {
      const date = databaseDateKey(attendance.date);
      if (date > (lastAttendanceByStudent.get(attendance.studentId) ?? "")) lastAttendanceByStudent.set(attendance.studentId, date);
    }
    for (const attendance of recentOccurrenceAttendances) {
      const date = databaseDateKey(attendance.occurrence.date);
      if (date > (lastAttendanceByStudent.get(attendance.studentId) ?? "")) lastAttendanceByStudent.set(attendance.studentId, date);
    }
    const recentActivityStartKey = databaseDateKey(recentActivityStart);
    const recentAttendanceIds = new Set([...lastAttendanceByStudent].filter(([, date]) => date >= recentActivityStartKey).map(([studentId]) => studentId));
    const lowActivityIds = lowActivityStudentIds(students.map(({ id, student }) => ({
      studentId: id, status: student.status, serviceType: student.serviceType,
      hasEstablishedRoutine: establishedRoutineIds.has(id), hasEstablishedClasses: establishedClassIds.has(id),
      hasRecentWorkout: recentWorkoutIds.has(id), hasRecentAttendance: recentAttendanceIds.has(id),
    })));
    const studentById = new Map(students.map(({ id, student }) => [id, student]));
    const lowActivityStudents = lowActivityIds.map((studentId) => {
      const student = studentById.get(studentId)!;
      const lastAttendanceDate = lastAttendanceByStudent.get(studentId) ?? null;
      const rawPhone = String(student.phone ?? "").trim();
      const phoneNormalized = normalizeArgentineWhatsAppPhone(rawPhone);
      return {
        studentId,
        studentName: studentName(student),
        serviceType: student.serviceType as "CLASSES" | "MIXED",
        phoneNormalized: phoneNormalized ?? "",
        phoneState: !rawPhone ? "missing" as const : phoneNormalized ? "valid" as const : "invalid" as const,
        lastAttendanceDate,
        daysSinceLastAttendance: lastAttendanceDate
          ? Math.floor((todayDate.getTime() - dateKeyToDatabase(lastAttendanceDate).getTime()) / 86_400_000)
          : null,
        weeklyFrequency: weeklyFrequencyByStudent.get(studentId) ?? 0,
      };
    }).sort((left, right) =>
      (right.daysSinceLastAttendance ?? Number.MAX_SAFE_INTEGER) - (left.daysSinceLastAttendance ?? Number.MAX_SAFE_INTEGER)
      || left.studentName.localeCompare(right.studentName, "es"),
    );
    const incomeByDate = new Map<string, number>();
    for (const payment of currentPayments) {
      if (!payment.paidDate) continue;
      const key = databaseDateKey(payment.paidDate);
      incomeByDate.set(key, (incomeByDate.get(key) ?? 0) + Number(payment.amount));
    }
    const elapsedDays = Number(today.slice(8, 10));
    const income = Array.from({ length: elapsedDays }, (_, index) => {
      const date = addDays(monthStart, index);
      return { date, label: String(index + 1), amount: incomeByDate.get(date) ?? 0 };
    });

    const attendanceTodayBySchedule = new Map(todayAttendances.map((item) => [item.scheduleId ?? "", item._count._all]));
    const todayClasses = todayOccurrences.map((occurrence) => ({
      id: occurrence.id,
      startTime: occurrence.startTime,
      endTime: occurrence.endTime,
      name: occurrenceClassName(occurrence),
      enrolled: occurrence.schedule?.assignments.filter(({ student }) => studentData(student.data).status !== "inactivo").length ?? 0,
      attendance: occurrence.responses.some((item) => item.actualAttendance !== "UNKNOWN")
        ? occurrence.responses.filter((item) => item.actualAttendance === "PRESENT").length
        : occurrence.scheduleId ? attendanceTodayBySchedule.get(occurrence.scheduleId) ?? 0 : 0,
      confirmed: occurrence.responses.filter((item) => item.response === "GOING").length,
      confirmedStudents: occurrence.responses.filter((item) => item.response === "GOING").map(({ student }) => studentName(studentData(student.data))),
    }));

    const weeklyAttendance = Array.from({ length: 7 }, (_, index) => {
      const date = addDays(weekStart, index);
      const newRecords = newWeeklyAttendances.filter((item) => databaseDateKey(item.occurrence.date) === date);
      const legacyRecords = weeklyAttendances.filter((item) => databaseDateKey(item.date) === date);
      const present = newRecords.length
        ? newRecords.filter((item) => item.actualAttendance === "PRESENT").length
        : legacyRecords.find((item) => item.status === "PRESENT")?._count._all ?? 0;
      const total = newRecords.length ? newRecords.length : legacyRecords.reduce((sum, item) => sum + item._count._all, 0);
      return { date, label: DAY_LABELS[new Date(`${date}T12:00:00.000Z`).getUTCDay()], present, total, percentage: total ? Math.round((present / total) * 100) : 0 };
    });
    const weeklyPresent = weeklyAttendance.reduce((sum, day) => sum + day.present, 0);
    const weeklyTotal = weeklyAttendance.reduce((sum, day) => sum + day.total, 0);
    const bestDay = weeklyAttendance.reduce((best, day) => day.present > best.present ? day : best, weeklyAttendance[0]);

    const currentNewStudents = students.filter(({ createdAt }) => databaseDateKey(createdAt) >= monthStart).length;
    const previousNewStudents = students.filter(({ createdAt }) => {
      const key = databaseDateKey(createdAt);
      return key >= previousMonthStart && key < monthStart;
    }).length;
    const data: DashboardData = {
      generatedAt: new Date().toISOString(),
      today,
      metrics: {
        activeStudents: active.length,
        activeStudentsMonthChange: currentNewStudents - previousNewStudents,
        monthIncome,
        monthPaymentCount: currentPayments.length,
        incomeChangePercent: previousIncome > 0 ? Math.round(((monthIncome - previousIncome) / previousIncome) * 100) : null,
        pendingCount: paymentAttention.attentionCount,
        pendingAmount: attentionAccounts.reduce((sum, account) => sum + account.amount, 0),
        overdueCount: paymentAttention.overdueCount,
        dueSoonThreeDaysCount,
        estimatedPendingBalance,
        classesToday: todayClasses.length,
        attendanceToday: todayAttendances.reduce((sum, item) => sum + item._count._all, 0),
        newStudents: currentNewStudents,
      },
      income,
      priorities,
      attentionToday: {
        attentionCount: paymentAttention.attentionCount,
        overdueCount: paymentAttention.overdueCount,
        dueSoonCount: dueSoonThreeDaysCount,
        lowActivityStudentCount: new Set(lowActivityIds).size,
        lowActivityStudents,
        completedWorkoutCount: recentWorkouts.filter((session) => personalizedStudentIds.has(session.studentId) && databaseDateKey(session.date) === today).length,
        registeredPaymentTotal: todayPaymentSummary.registeredTotal,
        registeredPaymentCount: todayPaymentSummary.registeredCount,
      },
      ranking,
      todayClasses: todayClasses.slice(0, 3),
      upcomingPayments: actionableAccounts.slice(0, 3),
      recentStudents: active.slice(0, 3).map(({ id, student, payments }) => ({
        id,
        studentName: studentName(student),
        plan: student.plan ?? "",
        days: planDays(student.plan ?? ""),
        dueDate: student.dueDate ?? "",
      status: paymentAccountStatus({
        dueDate: student.dueDate ?? "",
        monthlyFee: Number(student.monthlyFee ?? 0),
        validPaymentCount: payments.filter((payment) => payment.status === "PAGADO" && payment.paidDate).length,
        hasOutstandingDebt: payments.some((payment) => payment.status === "PENDIENTE" || payment.status === "VENCIDO"),
      }, today),
      })),
      weeklyAttendance,
      attendanceSummary: {
        weeklyAverage: weeklyTotal ? Math.round((weeklyPresent / weeklyTotal) * 100) : 0,
        bestDay: bestDay?.present ? bestDay.label : "Sin datos",
        totalAttendance: weeklyPresent,
      },
      upcomingEvents: events.map((event) => ({
        id: event.id,
        title: event.title,
        type: event.type.toLowerCase(),
        date: databaseDateKey(event.date),
        time: event.time,
        color: event.color,
        status: event.status.toLowerCase(),
      })),
    };
    return Response.json(data);
  } catch (error) {
    console.error("Error al construir el dashboard", error);
    const unavailable = databaseUnavailable(error);
    return Response.json({ error: unavailable ? "Neon no está disponible temporalmente." : "No se pudo cargar el Dashboard desde PostgreSQL." }, { status: unavailable ? 503 : 500 });
  }
}
