import { ARGENTINA_TIME_ZONE, argentinaDateKey } from "./payment-dates.ts";

export type TraceablePayment = {
  id: string;
  studentId: string;
  amount: number;
  status: string;
  billingPeriod: string | null;
  paidDate: string | null;
  createdAt: string;
  method: string;
};

export type TraceableObligation = {
  studentId: string;
  expectedAmount: number;
};

export type MonthlyPaymentMovement = TraceablePayment & {
  studentName: string;
};

export type MonthlyCollectionWeek = {
  key: string;
  label: string;
  startDate: string | null;
  endDate: string | null;
  total: number;
  paymentCount: number;
  payments: MonthlyPaymentMovement[];
  kind: "CALENDAR" | "OUTSIDE_PERIOD" | "MISSING_DATE";
};

export type ActivityEvidence = {
  validPayments: number;
  voidedPayments: number;
  presentAttendances: number;
  absentAttendances: number;
  justifiedAttendances: number;
  evaluations: number;
  completedWorkouts: number;
  otherWorkouts: number;
  enrollments: number;
  deactivations: number;
  reactivations: number;
  suspensions: number;
};

export type MissingObligationCause = "NO_MEMBERSHIP" | "INVALID_MEMBERSHIP_AMOUNT" | "MEMBERSHIP_NOT_ACTIVE" | "OBLIGATION_NOT_GENERATED";

function uniquePayments(payments: TraceablePayment[]) {
  return [...new Map(payments.map((payment) => [payment.id, payment])).values()];
}

function moneyTotal(payments: TraceablePayment[]) {
  return payments.reduce((sum, payment) => sum + payment.amount, 0);
}

function dateKeyAfter(value: string, days = 1) {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function periodMonthKey(period: string | null) {
  return period?.slice(0, 7) ?? "";
}

export function registeredTodaySummary(
  payments: TraceablePayment[],
  selectedMonthKey: string,
  collectedTotal: number,
  studentNames: Map<string, string>,
  now = new Date(),
) {
  const todayKey = argentinaDateKey(now);
  const tomorrowKey = dateKeyAfter(todayKey);
  const valid = uniquePayments(payments).filter((payment) => payment.status === "PAGADO");
  const registered = valid.filter((payment) => {
    const registeredKey = argentinaDateKey(new Date(payment.createdAt));
    return registeredKey >= todayKey && registeredKey < tomorrowKey;
  });
  const impacting = registered.filter((payment) => periodMonthKey(payment.billingPeriod) === selectedMonthKey);
  return {
    dateKey: todayKey,
    isCurrentPeriod: selectedMonthKey === todayKey.slice(0, 7),
    registeredTotal: moneyTotal(registered),
    registeredCount: registered.length,
    selectedPeriodImpactTotal: moneyTotal(impacting),
    selectedPeriodImpactCount: impacting.length,
    totalBeforeToday: collectedTotal - moneyTotal(impacting),
    currentTotal: collectedTotal,
    movements: registered
      .map((payment) => ({ ...payment, studentName: studentNames.get(payment.studentId) ?? "Alumno" }))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
  };
}

function daysInMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function shortMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { timeZone: ARGENTINA_TIME_ZONE, month: "short" })
    .format(new Date(Date.UTC(year, month - 1, 15)))
    .replace(".", "");
}

export function weeklyCollections(
  payments: TraceablePayment[],
  selectedMonthKey: string,
  studentNames: Map<string, string>,
  now = new Date(),
) {
  const valid = uniquePayments(payments).filter((payment) => payment.status === "PAGADO" && periodMonthKey(payment.billingPeriod) === selectedMonthKey);
  const lastDay = daysInMonth(selectedMonthKey);
  const monthLabel = shortMonth(selectedMonthKey);
  const currentKey = argentinaDateKey(now);
  const currentMonth = currentKey.slice(0, 7) === selectedMonthKey;
  const result: MonthlyCollectionWeek[] = [];

  for (let startDay = 1; startDay <= lastDay; startDay += 7) {
    const endDay = Math.min(startDay + 6, lastDay);
    const startDate = `${selectedMonthKey}-${String(startDay).padStart(2, "0")}`;
    const endDate = `${selectedMonthKey}-${String(endDay).padStart(2, "0")}`;
    const weekPayments = valid.filter((payment) => payment.paidDate && payment.paidDate >= startDate && payment.paidDate <= endDate);
    if (currentMonth && startDate > currentKey && weekPayments.length === 0) continue;
    const movements = weekPayments.map((payment) => ({ ...payment, studentName: studentNames.get(payment.studentId) ?? "Alumno" }));
    result.push({
      key: startDate,
      label: `${startDay}–${endDay} ${monthLabel}`,
      startDate,
      endDate,
      total: moneyTotal(weekPayments),
      paymentCount: weekPayments.length,
      payments: movements.sort((left, right) => (right.paidDate ?? "").localeCompare(left.paidDate ?? "") || right.createdAt.localeCompare(left.createdAt)),
      kind: "CALENDAR",
    });
  }

  const missingDate = valid.filter((payment) => !payment.paidDate);
  const outsidePeriod = valid.filter((payment) => payment.paidDate && !payment.paidDate.startsWith(`${selectedMonthKey}-`));
  for (const [key, label, kind, found] of [
    ["missing-date", "Sin fecha efectiva", "MISSING_DATE", missingDate],
    ["outside-period", "Fecha efectiva fuera del mes", "OUTSIDE_PERIOD", outsidePeriod],
  ] as const) {
    if (!found.length) continue;
    result.push({
      key,
      label,
      startDate: null,
      endDate: null,
      total: moneyTotal(found),
      paymentCount: found.length,
      payments: found.map((payment) => ({ ...payment, studentName: studentNames.get(payment.studentId) ?? "Alumno" })),
      kind,
    });
  }
  return result;
}

export function reconcileMonthlyFinances(payments: TraceablePayment[], obligations: TraceableObligation[]) {
  const valid = uniquePayments(payments).filter((payment) => payment.status === "PAGADO");
  const paidByStudent = new Map<string, number>();
  valid.forEach((payment) => paidByStudent.set(payment.studentId, (paidByStudent.get(payment.studentId) ?? 0) + payment.amount));
  const obligationByStudent = new Map(obligations.map((obligation) => [obligation.studentId, obligation]));
  const expectedTotal = obligations.reduce((sum, obligation) => sum + obligation.expectedAmount, 0);
  const collectedTotal = moneyTotal(valid);
  const appliedToObligations = obligations.reduce((sum, obligation) => sum + Math.min(paidByStudent.get(obligation.studentId) ?? 0, obligation.expectedAmount), 0);
  const paymentsWithoutObligation = [...paidByStudent.entries()]
    .filter(([studentId]) => !obligationByStudent.has(studentId))
    .reduce((sum, [, amount]) => sum + amount, 0);
  const overpaymentsOnObligations = obligations.reduce((sum, obligation) => sum + Math.max((paidByStudent.get(obligation.studentId) ?? 0) - obligation.expectedAmount, 0), 0);
  const pendingTotal = obligations.reduce((sum, obligation) => sum + Math.max(obligation.expectedAmount - (paidByStudent.get(obligation.studentId) ?? 0), 0), 0);
  return {
    expectedTotal,
    collectedTotal,
    appliedToObligations,
    paymentsWithoutObligation,
    overpaymentsOnObligations,
    pendingTotal,
    simpleDifference: expectedTotal - collectedTotal,
    unreconciledCollected: paymentsWithoutObligation + overpaymentsOnObligations,
  };
}

export function emptyActivityEvidence(): ActivityEvidence {
  return { validPayments: 0, voidedPayments: 0, presentAttendances: 0, absentAttendances: 0, justifiedAttendances: 0, evaluations: 0, completedWorkouts: 0, otherWorkouts: 0, enrollments: 0, deactivations: 0, reactivations: 0, suspensions: 0 };
}

export function activityEvidenceLabels(activity: ActivityEvidence) {
  const labels: string[] = [];
  if (activity.validPayments) labels.push(`${activity.validPayments} ${activity.validPayments === 1 ? "pago válido" : "pagos válidos"}`);
  if (activity.voidedPayments) labels.push(`${activity.voidedPayments} ${activity.voidedPayments === 1 ? "pago anulado" : "pagos anulados"}`);
  const attendances = activity.presentAttendances + activity.absentAttendances + activity.justifiedAttendances;
  if (attendances) labels.push(`${attendances} ${attendances === 1 ? "asistencia" : "asistencias"} (${activity.presentAttendances} presentes, ${activity.absentAttendances} faltas, ${activity.justifiedAttendances} justificadas)`);
  if (activity.evaluations) labels.push(`${activity.evaluations} ${activity.evaluations === 1 ? "evaluación" : "evaluaciones"}`);
  const workouts = activity.completedWorkouts + activity.otherWorkouts;
  if (workouts) labels.push(`${workouts} ${workouts === 1 ? "sesión de rutina" : "sesiones de rutina"} (${activity.completedWorkouts} completadas)`);
  if (activity.enrollments) labels.push(`${activity.enrollments} ${activity.enrollments === 1 ? "alta" : "altas"}`);
  if (activity.deactivations) labels.push(`${activity.deactivations} ${activity.deactivations === 1 ? "baja" : "bajas"}`);
  if (activity.reactivations) labels.push(`${activity.reactivations} ${activity.reactivations === 1 ? "reactivación" : "reactivaciones"}`);
  if (activity.suspensions) labels.push(`${activity.suspensions} ${activity.suspensions === 1 ? "suspensión" : "suspensiones"}`);
  return labels;
}

export function missingObligationCause(membership: { status: string; monthlyAmount: number | null } | null): { code: MissingObligationCause; label: string } {
  if (!membership) return { code: "NO_MEMBERSHIP", label: "Sin historial de membresía para el período" };
  if (membership.status !== "ACTIVE") return { code: "MEMBERSHIP_NOT_ACTIVE", label: `Membresía histórica ${membership.status === "SUSPENDED" ? "suspendida" : "inactiva"}` };
  if (membership.monthlyAmount === null || membership.monthlyAmount <= 0) return { code: "INVALID_MEMBERSHIP_AMOUNT", label: "Membresía sin importe histórico válido" };
  return { code: "OBLIGATION_NOT_GENERATED", label: "Membresía válida sin obligación generada para el período" };
}
