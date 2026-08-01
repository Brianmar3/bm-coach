import "server-only";

import { Prisma, type MonthlyObligationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { attendancePercentage, closedMonthlySnapshot, hasHistoricalMembershipCoverage, obligationStatus } from "@/lib/monthly-calculations";
import { argentinaDateKey, databaseDateKey, dateKeyToDatabase } from "@/lib/payment-dates";
import { dueDateForPeriod, monthDatabaseBounds, monthKey, monthLabel, type MonthSelection } from "@/lib/monthly-period";
import type { Student } from "@/types/gestion";
import type { MonthlyDetailRow, MonthlySummaryData } from "@/types/monthly-summary";

export const MONTHLY_HISTORY_START = "2026-08-01";
const PARTIAL_WARNING = "Histórico parcial: algunos datos no se registraban históricamente.";
const UNAVAILABLE_WARNING = "No disponible: este dato no se registraba históricamente.";

function storedStudent(value: Prisma.JsonValue) {
  return value as unknown as Partial<Student>;
}

function studentName(value: Prisma.JsonValue) {
  const student = storedStudent(value);
  return `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim() || "Alumno sin nombre";
}

function paymentLabel(status: MonthlyObligationStatus | null, hasPayments: boolean, onlyVoided: boolean): MonthlyDetailRow["paymentStatus"] {
  if (!status) return onlyVoided ? "Anulado" : "Sin obligación";
  if (status === "PAID") return "Pagado";
  if (status === "PARTIAL") return "Parcial";
  if (status === "OVERDUE") return "Vencido";
  if (status === "VOID") return "Anulado";
  return hasPayments ? "Parcial" : "Pendiente";
}

export async function generateMonthlyObligations(selection: MonthSelection) {
  const bounds = monthDatabaseBounds(selection);
  const existingSummary = await prisma.monthlySummary.findUnique({ where: { year_month: selection }, select: { status: true } });
  if (existingSummary?.status === "CLOSED") throw new Error("MONTH_CLOSED");

  const [memberships, students, payments] = await Promise.all([
    prisma.studentMembershipHistory.findMany({
      where: {
        startDate: { lt: bounds.endDate },
        OR: [{ endDate: null }, { endDate: { gt: bounds.startDate } }],
        status: "ACTIVE",
      },
      orderBy: [{ studentId: "asc" }, { startDate: "desc" }],
    }),
    prisma.studentRecord.findMany({ select: { id: true, data: true } }),
    prisma.studentPayment.groupBy({
      by: ["studentId"],
      where: { billingPeriod: bounds.startDate, status: "PAGADO" },
      _sum: { amount: true },
    }),
  ]);
  const studentById = new Map(students.map((student) => [student.id, student]));
  const paidByStudent = new Map(payments.map((payment) => [payment.studentId, Number(payment._sum.amount ?? 0)]));
  const latestMembership = new Map<string, typeof memberships[number]>();
  memberships.forEach((membership) => {
    if (!latestMembership.has(membership.studentId)) latestMembership.set(membership.studentId, membership);
  });

  await prisma.$transaction([...latestMembership.values()].flatMap((membership) => {
    const studentRecord = studentById.get(membership.studentId);
    const current = studentRecord ? storedStudent(studentRecord.data) : {};
    const expected = membership.monthlyAmount === null ? null : Number(membership.monthlyAmount);
    if (expected === null || expected <= 0) return [];
    const paid = paidByStudent.get(membership.studentId) ?? 0;
    const dueDate = dueDateForPeriod(bounds.period, current.dueDate ?? "");
    const status = obligationStatus(expected, paid, dueDate, argentinaDateKey());
    return [prisma.monthlyStudentObligation.upsert({
      where: { studentId_period: { studentId: membership.studentId, period: bounds.startDate } },
      create: {
        studentId: membership.studentId,
        period: bounds.startDate,
        expectedAmount: expected,
        paidAmount: paid,
        balance: Math.max(expected - paid, 0),
        studentNameSnapshot: studentRecord ? studentName(studentRecord.data) : "Alumno",
        planNameSnapshot: membership.planName,
        serviceSnapshot: membership.serviceType,
        frequencySnapshot: membership.frequencyDays,
        dueDate: dateKeyToDatabase(dueDate),
        status,
      },
      update: { paidAmount: paid, balance: Math.max(expected - paid, 0), status },
    })];
  }));
}

export async function buildMonthlySummary(selection: MonthSelection, allowClosedSnapshot = true): Promise<MonthlySummaryData> {
  const bounds = monthDatabaseBounds(selection);
  const savedSummary = await prisma.monthlySummary.findUnique({ where: { year_month: selection } });
  if (allowClosedSnapshot && savedSummary?.status === "CLOSED") return savedSummary.snapshot as unknown as MonthlySummaryData;

  const [students, payments, obligations, attendances, evaluations, workouts, events, memberships] = await Promise.all([
    prisma.studentRecord.findMany({ select: { id: true, data: true } }),
    prisma.studentPayment.findMany({
      where: { billingPeriod: bounds.startDate },
      select: { studentId: true, amount: true, paidDate: true, method: true, status: true },
      orderBy: [{ paidDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.monthlyStudentObligation.findMany({ where: { period: bounds.startDate } }),
    prisma.classAttendance.findMany({
      where: { date: { gte: bounds.startDate, lt: bounds.endDate } },
      select: { studentId: true, status: true },
    }),
    prisma.physicalEvaluation.findMany({
      where: { date: { gte: bounds.startInstant, lt: bounds.endInstant } },
      select: { studentId: true },
    }),
    prisma.workoutSession.findMany({
      where: { date: { gte: bounds.startDate, lt: bounds.endDate } },
      select: { studentId: true, status: true },
    }),
    prisma.studentStatusEvent.findMany({
      where: { eventDate: { gte: bounds.startDate, lt: bounds.endDate } },
      select: { studentId: true, type: true, eventDate: true },
    }),
    prisma.studentMembershipHistory.findMany({
      where: { startDate: { lt: bounds.endDate }, OR: [{ endDate: null }, { endDate: { gt: bounds.startDate } }] },
      orderBy: [{ studentId: "asc" }, { startDate: "desc" }],
    }),
  ]);

  const studentById = new Map(students.map((student) => [student.id, student]));
  const obligationByStudent = new Map(obligations.map((item) => [item.studentId, item]));
  const membershipByStudent = new Map<string, typeof memberships[number]>();
  memberships.forEach((membership) => {
    if (!membershipByStudent.has(membership.studentId)) membershipByStudent.set(membership.studentId, membership);
  });
  const validPayments = payments.filter((payment) => payment.status === "PAGADO");
  const collectedTotal = validPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const expectedTotal = obligations.length ? obligations.reduce((sum, item) => sum + Number(item.expectedAmount), 0) : null;
  const validPaidByStudent = new Map<string, number>();
  validPayments.forEach((payment) => validPaidByStudent.set(payment.studentId, (validPaidByStudent.get(payment.studentId) ?? 0) + Number(payment.amount)));
  const pendingTotal = expectedTotal === null ? null : obligations.reduce((sum, item) => sum + Math.max(Number(item.expectedAmount) - (validPaidByStudent.get(item.studentId) ?? 0), 0), 0);
  const collectionPercentage = expectedTotal === null || expectedTotal <= 0 ? null : Math.round((collectedTotal / expectedTotal) * 1000) / 10;
  const present = attendances.filter((item) => item.status === "PRESENT").length;
  const absent = attendances.filter((item) => item.status === "ABSENT").length;
  const justified = attendances.filter((item) => item.status === "JUSTIFIED").length;
  const attendanceRate = attendancePercentage(present, absent, justified);
  const historicalCoverage = hasHistoricalMembershipCoverage(bounds.start, MONTHLY_HISTORY_START);
  const warnings = new Set<string>();
  if (!historicalCoverage) warnings.add(PARTIAL_WARNING);
  if (!obligations.length) warnings.add(UNAVAILABLE_WARNING);

  const activityIds = new Set<string>();
  [...payments, ...attendances, ...evaluations, ...workouts, ...events, ...obligations].forEach((item) => activityIds.add(item.studentId));
  const membershipsWithoutAmount = memberships.filter((item) => item.status === "ACTIVE" && (item.monthlyAmount === null || Number(item.monthlyAmount) <= 0)).length;
  if (membershipsWithoutAmount) warnings.add(`${membershipsWithoutAmount} membresías activas no tienen un importe histórico válido.`);
  const paymentsWithoutDate = payments.filter((item) => item.status === "PAGADO" && !item.paidDate).length;
  if (paymentsWithoutDate) warnings.add(`${paymentsWithoutDate} pagos válidos no tienen fecha real de pago.`);
  const studentsWithoutObligation = [...activityIds].filter((studentId) => !obligationByStudent.has(studentId)).length;
  if (historicalCoverage && studentsWithoutObligation) warnings.add(`${studentsWithoutObligation} alumnos con actividad no tienen obligación para el período.`);
  const rows: MonthlyDetailRow[] = [...activityIds].map((studentId) => {
    const student = studentById.get(studentId);
    const obligation = obligationByStudent.get(studentId);
    const membership = membershipByStudent.get(studentId);
    const studentPayments = payments.filter((item) => item.studentId === studentId);
    const studentValidPayments = studentPayments.filter((item) => item.status === "PAGADO");
    const studentAttendances = attendances.filter((item) => item.studentId === studentId);
    const enrollment = events.find((item) => item.studentId === studentId && item.type === "ENROLLMENT");
    const deactivation = events.find((item) => item.studentId === studentId && item.type === "DEACTIVATION");
    const rowWarnings: string[] = [];
    if (!obligation) rowWarnings.push("Sin obligación histórica para el período.");
    if (!obligation && !membership) rowWarnings.push("Plan, servicio y frecuencia históricos no disponibles.");
    const expectedAmount = obligation ? Number(obligation.expectedAmount) : null;
    const collectedAmount = studentValidPayments.reduce((sum, item) => sum + Number(item.amount), 0);
    const liveStatus = obligation ? obligationStatus(Number(obligation.expectedAmount), collectedAmount, databaseDateKey(obligation.dueDate), argentinaDateKey()) as MonthlyObligationStatus : null;
    return {
      studentId,
      studentName: obligation?.studentNameSnapshot ?? (student ? studentName(student.data) : "Alumno"),
      collectedAmount,
      expectedAmount,
      balance: expectedAmount === null ? null : Math.max(expectedAmount - collectedAmount, 0),
      paymentStatus: paymentLabel(liveStatus, studentValidPayments.length > 0, studentPayments.length > 0 && studentValidPayments.length === 0),
      paymentDates: studentValidPayments.flatMap((item) => item.paidDate ? [databaseDateKey(item.paidDate)] : []),
      paymentMethods: [...new Set(studentValidPayments.map((item) => item.method).filter(Boolean))],
      attendancePresent: studentAttendances.filter((item) => item.status === "PRESENT").length,
      attendanceAbsent: studentAttendances.filter((item) => item.status === "ABSENT").length,
      attendanceJustified: studentAttendances.filter((item) => item.status === "JUSTIFIED").length,
      planName: obligation?.planNameSnapshot ?? membership?.planName ?? null,
      serviceType: obligation?.serviceSnapshot ?? membership?.serviceType ?? null,
      frequencyDays: obligation?.frequencySnapshot ?? membership?.frequencyDays ?? null,
      joinedAt: enrollment ? databaseDateKey(enrollment.eventDate) : null,
      deactivatedAt: deactivation ? databaseDateKey(deactivation.eventDate) : null,
      warnings: rowWarnings,
    };
  }).sort((left, right) => left.studentName.localeCompare(right.studentName, "es"));

  const deactivationCount = historicalCoverage ? events.filter((item) => item.type === "DEACTIVATION").length : null;
  const liveObligationStatuses = obligations.map((item) => obligationStatus(
    Number(item.expectedAmount),
    validPaidByStudent.get(item.studentId) ?? 0,
    databaseDateKey(item.dueDate),
    argentinaDateKey(),
  ));
  const data: MonthlySummaryData = {
    metadata: {
      year: selection.year,
      month: selection.month,
      monthKey: monthKey(selection),
      label: monthLabel(selection),
      timeZone: "America/Argentina/Buenos_Aires",
      generatedAt: savedSummary?.updatedAt.toISOString() ?? new Date().toISOString(),
      status: savedSummary?.status ?? "UNGENERATED",
      historicalPartial: !historicalCoverage || warnings.size > 0,
      closedAt: savedSummary?.closedAt?.toISOString() ?? null,
    },
    summary: {
      collectedTotal,
      paymentCount: validPayments.length,
      expectedTotal,
      pendingTotal,
      collectionPercentage,
      studentsWithActivity: activityIds.size,
      enrollments: events.filter((item) => item.type === "ENROLLMENT").length,
      deactivations: deactivationCount,
      attendancePercentage: attendanceRate,
    },
    finances: {
      paidObligations: obligations.length ? liveObligationStatuses.filter((status) => status === "PAID").length : null,
      partialObligations: obligations.length ? liveObligationStatuses.filter((status) => status === "PARTIAL").length : null,
      pendingObligations: obligations.length ? liveObligationStatuses.filter((status) => status === "PENDING" || status === "OVERDUE").length : null,
      voidedPaymentCount: payments.filter((item) => item.status === "ANULADO").length,
    },
    attendance: { present, absent, justified, totalRecords: present + absent + justified, percentageFormula: "Presentes / (presentes + ausentes + justificadas) × 100" },
    activity: {
      evaluations: evaluations.length,
      completedWorkoutSessions: workouts.filter((item) => item.status === "COMPLETED").length,
      registeredWorkoutSessions: workouts.length,
    },
    expenses: { operatingResult: null, message: "Resultado operativo: No disponible. Todavía no se registran gastos." },
    warnings: [...warnings],
    detailRows: rows,
  };
  return data;
}

function summaryPersistence(data: MonthlySummaryData) {
  return {
    historicalPartial: data.metadata.historicalPartial,
    expectedTotal: data.summary.expectedTotal,
    collectedTotal: data.summary.collectedTotal,
    pendingTotal: data.summary.pendingTotal,
    collectionPercentage: data.summary.collectionPercentage,
    activeStudentCount: data.summary.studentsWithActivity,
    enrollmentCount: data.summary.enrollments,
    deactivationCount: data.summary.deactivations,
    attendancePercentage: data.summary.attendancePercentage,
    warnings: data.warnings as Prisma.InputJsonValue,
    snapshot: data as unknown as Prisma.InputJsonValue,
  };
}

export async function saveMonthlyDraft(selection: MonthSelection) {
  await generateMonthlyObligations(selection);
  const data = await buildMonthlySummary(selection, false);
  const record = await prisma.monthlySummary.upsert({
    where: { year_month: selection },
    create: { year: selection.year, month: selection.month, status: "DRAFT", ...summaryPersistence(data) },
    update: { generatedAt: new Date(), version: { increment: 1 }, ...summaryPersistence(data) },
  });
  return buildMonthlySummary(selection, record.status === "CLOSED");
}

export async function closeMonthlySummary(selection: MonthSelection, actor = "coach") {
  const existing = await prisma.monthlySummary.findUnique({ where: { year_month: selection }, select: { status: true } });
  if (existing?.status === "CLOSED") return buildMonthlySummary(selection);
  const refreshed = await saveMonthlyDraft(selection);
  const closedAt = new Date();
  const closedData = closedMonthlySnapshot(refreshed, closedAt.toISOString());
  await prisma.monthlySummary.update({
    where: { year_month: selection },
    data: { status: "CLOSED", closedAt, closedBy: actor, version: { increment: 1 }, ...summaryPersistence(closedData) },
  });
  return closedData;
}
