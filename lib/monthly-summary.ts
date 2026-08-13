import "server-only";

import { Prisma, type MonthlyObligationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { attendancePercentage, closedMonthlySnapshot, hasHistoricalMembershipCoverage, obligationStatus } from "@/lib/monthly-calculations";
import { activityEvidenceLabels, emptyActivityEvidence, missingObligationCause, reconcileMonthlyFinances, registeredTodaySummary, weeklyCollections, type TraceablePayment } from "@/lib/monthly-traceability";
import { argentinaDateKey, argentinaDateTimeBoundary, databaseDateKey, dateKeyToDatabase } from "@/lib/payment-dates";
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

  const todayKey = argentinaDateKey();
  const tomorrow = new Date(`${todayKey}T12:00:00.000Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowKey = tomorrow.toISOString().slice(0, 10);
  const paymentSelection = { id: true, studentId: true, amount: true, paidDate: true, billingPeriod: true, method: true, status: true, createdAt: true } as const;

  const [students, payments, todayPayments, obligations, attendances, evaluations, workouts, events, memberships] = await Promise.all([
    prisma.studentRecord.findMany({ select: { id: true, data: true, serviceType: true } }),
    prisma.studentPayment.findMany({
      where: { billingPeriod: bounds.startDate },
      select: paymentSelection,
      orderBy: [{ paidDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.studentPayment.findMany({
      where: { status: "PAGADO", createdAt: { gte: argentinaDateTimeBoundary(todayKey), lt: argentinaDateTimeBoundary(tomorrowKey) } },
      select: paymentSelection,
      orderBy: [{ createdAt: "desc" }],
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
  const studentNames = new Map(students.map((student) => [student.id, studentName(student.data)]));
  const obligationByStudent = new Map(obligations.map((item) => [item.studentId, item]));
  const membershipByStudent = new Map<string, typeof memberships[number]>();
  memberships.forEach((membership) => {
    if (!membershipByStudent.has(membership.studentId)) membershipByStudent.set(membership.studentId, membership);
  });
  const serializeTraceablePayment = (payment: typeof payments[number]): TraceablePayment => ({
    id: payment.id,
    studentId: payment.studentId,
    amount: Number(payment.amount),
    status: payment.status,
    billingPeriod: payment.billingPeriod ? databaseDateKey(payment.billingPeriod) : null,
    paidDate: payment.paidDate ? databaseDateKey(payment.paidDate) : null,
    createdAt: payment.createdAt.toISOString(),
    method: payment.method,
  });
  const traceablePayments = payments.map(serializeTraceablePayment);
  const traceableTodayPayments = todayPayments.map(serializeTraceablePayment);
  const validPayments = payments.filter((payment) => payment.status === "PAGADO");
  const collectedTotal = validPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const expectedTotal = obligations.length ? obligations.reduce((sum, item) => sum + Number(item.expectedAmount), 0) : null;
  const validPaidByStudent = new Map<string, number>();
  validPayments.forEach((payment) => validPaidByStudent.set(payment.studentId, (validPaidByStudent.get(payment.studentId) ?? 0) + Number(payment.amount)));
  const reconciliation = obligations.length ? reconcileMonthlyFinances(
    traceablePayments,
    obligations.map((item) => ({ studentId: item.studentId, expectedAmount: Number(item.expectedAmount) })),
  ) : null;
  const pendingTotal = reconciliation?.pendingTotal ?? null;
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
  const activityByStudent = new Map<string, ReturnType<typeof emptyActivityEvidence>>();
  const evidenceFor = (studentId: string) => {
    const existing = activityByStudent.get(studentId);
    if (existing) return existing;
    const created = emptyActivityEvidence();
    activityByStudent.set(studentId, created);
    return created;
  };
  payments.forEach((item) => {
    const evidence = evidenceFor(item.studentId);
    if (item.status === "PAGADO") evidence.validPayments += 1;
    else if (item.status === "ANULADO") evidence.voidedPayments += 1;
  });
  attendances.forEach((item) => {
    const evidence = evidenceFor(item.studentId);
    if (item.status === "PRESENT") evidence.presentAttendances += 1;
    else if (item.status === "ABSENT") evidence.absentAttendances += 1;
    else evidence.justifiedAttendances += 1;
  });
  evaluations.forEach((item) => { evidenceFor(item.studentId).evaluations += 1; });
  workouts.forEach((item) => {
    const evidence = evidenceFor(item.studentId);
    if (item.status === "COMPLETED") evidence.completedWorkouts += 1;
    else evidence.otherWorkouts += 1;
  });
  events.forEach((item) => {
    const evidence = evidenceFor(item.studentId);
    if (item.type === "ENROLLMENT") evidence.enrollments += 1;
    else if (item.type === "DEACTIVATION") evidence.deactivations += 1;
    else if (item.type === "REACTIVATION") evidence.reactivations += 1;
    else evidence.suspensions += 1;
  });

  const membershipsWithoutAmount = memberships
    .filter((item) => item.status === "ACTIVE" && (item.monthlyAmount === null || Number(item.monthlyAmount) <= 0))
    .map((item) => ({
      membershipId: item.id,
      studentId: item.studentId,
      studentName: studentNames.get(item.studentId) ?? "Alumno",
      serviceType: item.serviceType,
      planName: item.planName,
      frequencyDays: item.frequencyDays,
      startDate: databaseDateKey(item.startDate),
      endDate: item.endDate ? databaseDateKey(item.endDate) : null,
      amount: item.monthlyAmount === null ? null : Number(item.monthlyAmount),
      reason: item.monthlyAmount === null ? "No hay un importe guardado en este tramo histórico." : "El importe histórico no es mayor que cero.",
    }));
  if (membershipsWithoutAmount.length) warnings.add(`${membershipsWithoutAmount.length} membresías activas no tienen un importe histórico válido.`);
  const paymentsWithoutDate = payments.filter((item) => item.status === "PAGADO" && !item.paidDate).length;
  if (paymentsWithoutDate) warnings.add(`${paymentsWithoutDate} pagos válidos no tienen fecha real de pago.`);
  const activityWithoutObligation = [...activityIds].filter((studentId) => !obligationByStudent.has(studentId)).map((studentId) => {
    const student = studentById.get(studentId);
    const membership = membershipByStudent.get(studentId);
    const cause = missingObligationCause(membership ? { status: membership.status, monthlyAmount: membership.monthlyAmount === null ? null : Number(membership.monthlyAmount) } : null);
    return {
      studentId,
      studentName: studentNames.get(studentId) ?? "Alumno",
      serviceType: membership?.serviceType ?? student?.serviceType ?? null,
      studentStatus: student ? storedStudent(student.data).status ?? null : null,
      membershipStatus: membership?.status ?? null,
      membershipAmount: membership?.monthlyAmount === null || membership?.monthlyAmount === undefined ? null : Number(membership.monthlyAmount),
      membershipStartDate: membership ? databaseDateKey(membership.startDate) : null,
      membershipEndDate: membership?.endDate ? databaseDateKey(membership.endDate) : null,
      activity: activityEvidenceLabels(activityByStudent.get(studentId) ?? emptyActivityEvidence()),
      cause: cause.code,
      reason: cause.label,
    };
  }).sort((left, right) => left.studentName.localeCompare(right.studentName, "es"));
  if (historicalCoverage && activityWithoutObligation.length) warnings.add(`${activityWithoutObligation.length} alumnos con actividad no tienen obligación para el período.`);
  const causeLabels = new Map(activityWithoutObligation.map((item) => [item.cause, item.reason]));
  const missingObligationCauses = [...causeLabels].map(([cause, label]) => ({ cause, label, count: activityWithoutObligation.filter((item) => item.cause === cause).length }));
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
  const today = registeredTodaySummary(traceableTodayPayments, monthKey(selection), collectedTotal, studentNames);
  const collectionsByWeek = weeklyCollections(traceablePayments, monthKey(selection), studentNames);
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
    today,
    weeklyCollections: collectionsByWeek,
    reconciliation,
    dataReview: {
      membershipsWithoutAmount,
      activityWithoutObligation,
      missingObligationCauses,
    },
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
