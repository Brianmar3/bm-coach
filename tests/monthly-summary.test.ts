import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createAdminSessionValue, verifyAdminSessionValue } from "../lib/admin-auth.ts";
import { attendancePercentage, closedMonthlySnapshot, hasHistoricalMembershipCoverage, membershipConfigurationChanged, obligationStatus } from "../lib/monthly-calculations.ts";
import { monthlyGeneralCsv, monthlySummaryCsv } from "../lib/monthly-csv.ts";
import { currentArgentinaMonth, monthDatabaseBounds, monthLabel, shiftMonth } from "../lib/monthly-period.ts";
import { activityEvidenceLabels, emptyActivityEvidence, missingObligationCause, reconcileMonthlyFinances, registeredTodaySummary, weeklyCollections, type TraceablePayment } from "../lib/monthly-traceability.ts";
import { argentinaDateKey } from "../lib/payment-dates.ts";
import type { MonthlySummaryData } from "../types/monthly-summary.ts";

function sampleSummary(): MonthlySummaryData {
  return {
    metadata: { year: 2026, month: 7, monthKey: "2026-07", label: "Julio de 2026", timeZone: "America/Argentina/Buenos_Aires", generatedAt: "2026-08-01T12:00:00.000Z", status: "DRAFT", historicalPartial: true, closedAt: null },
    summary: { collectedTotal: 15000, paymentCount: 1, expectedTotal: null, pendingTotal: null, collectionPercentage: null, studentsWithActivity: 1, enrollments: 0, deactivations: null, attendancePercentage: 50 },
    finances: { paidObligations: null, partialObligations: null, pendingObligations: null, voidedPaymentCount: 0 },
    attendance: { present: 1, absent: 1, justified: 0, totalRecords: 2, percentageFormula: "Presentes / total × 100" },
    activity: { evaluations: 0, completedWorkoutSessions: 0, registeredWorkoutSessions: 0 },
    expenses: { operatingResult: null, message: "Resultado operativo: No disponible. Todavía no se registran gastos." },
    today: { dateKey: "2026-08-01", isCurrentPeriod: false, registeredTotal: 0, registeredCount: 0, selectedPeriodImpactTotal: 0, selectedPeriodImpactCount: 0, totalBeforeToday: 15000, currentTotal: 15000, movements: [] },
    weeklyCollections: [],
    reconciliation: null,
    dataReview: { membershipsWithoutAmount: [], activityWithoutObligation: [], missingObligationCauses: [] },
    warnings: ["No disponible: este dato no se registraba históricamente."],
    detailRows: [{ studentId: "a", studentName: "Ana, Pérez", collectedAmount: 15000, expectedAmount: null, balance: null, paymentStatus: "Sin obligación", paymentDates: ["2026-08-02"], paymentMethods: ["Transferencia"], attendancePresent: 1, attendanceAbsent: 1, attendanceJustified: 0, planName: null, serviceType: null, frequencyDays: null, joinedAt: null, deactivatedAt: null, warnings: ["Sin plan histórico"] }],
  };
}

test("julio conserva pagos y asistencias pero esperado y pendiente no están disponibles", () => {
  const summary = sampleSummary();
  assert.equal(summary.summary.collectedTotal, 15000);
  assert.equal(summary.attendance.present, 1);
  assert.equal(summary.summary.expectedTotal, null);
  assert.equal(summary.summary.pendingTotal, null);
  assert.equal(hasHistoricalMembershipCoverage("2026-07-01"), false);
});

test("agosto inicia cobertura histórica y julio permanece parcial", () => {
  assert.equal(hasHistoricalMembershipCoverage("2026-08-01"), true);
  assert.equal(hasHistoricalMembershipCoverage("2026-07-01"), false);
});

test("pago completo, parcial, pendiente, vencido y división por cero", () => {
  assert.equal(obligationStatus(30000, 30000, "2026-08-10", "2026-08-12"), "PAID");
  assert.equal(obligationStatus(30000, 10000, "2026-08-10", "2026-08-12"), "PARTIAL");
  assert.equal(obligationStatus(30000, 0, "2026-08-20", "2026-08-12"), "PENDING");
  assert.equal(obligationStatus(30000, 0, "2026-08-10", "2026-08-12"), "OVERDUE");
  assert.equal(attendancePercentage(0, 0, 0), null);
});

test("la asistencia usa presentes sobre todos los registros existentes", () => {
  assert.equal(attendancePercentage(7, 2, 1), 70);
});

test("cambio de precio o plan exige un nuevo historial", () => {
  const august = { plan: "3 días", monthlyFee: 30000, serviceType: "CLASSES", status: "activo" };
  assert.equal(membershipConfigurationChanged(august, { ...august, monthlyFee: 35000 }), true);
  assert.equal(membershipConfigurationChanged(august, { ...august, plan: "4 días" }), true);
  assert.equal(membershipConfigurationChanged(august, { ...august }), false);
  assert.equal(august.monthlyFee, 30000);
});

test("baja y reactivación se detectan como cambios históricos", () => {
  const active = { plan: "2 días", monthlyFee: 30000, serviceType: "CLASSES", status: "activo" };
  const inactive = { ...active, status: "inactivo" };
  assert.equal(membershipConfigurationChanged(active, inactive), true);
  assert.equal(membershipConfigurationChanged(inactive, active), true);
  assert.equal(membershipConfigurationChanged(active, { ...active, status: "suspendido" }), true);
});

test("el cierre clona y conserva los valores del borrador", () => {
  const draft = sampleSummary();
  const closed = closedMonthlySnapshot(draft, "2026-08-03T12:00:00.000Z");
  draft.summary.collectedTotal = 99999;
  assert.equal(closed.metadata.status, "CLOSED");
  assert.equal(closed.summary.collectedTotal, 15000);
});

test("selector de mes navega entre años y etiqueta en español", () => {
  assert.deepEqual(shiftMonth({ year: 2026, month: 1 }, -1), { year: 2025, month: 12 });
  assert.deepEqual(shiftMonth({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 });
  assert.match(monthLabel({ year: 2026, month: 7 }), /Julio/i);
});

test("inicio y fin mensual respetan America/Argentina/Buenos_Aires", () => {
  const bounds = monthDatabaseBounds({ year: 2026, month: 8 });
  assert.equal(bounds.startInstant.toISOString(), "2026-08-01T03:00:00.000Z");
  assert.equal(bounds.endInstant.toISOString(), "2026-09-01T03:00:00.000Z");
  assert.equal(argentinaDateKey(new Date("2026-08-01T02:30:00.000Z")), "2026-07-31");
  assert.deepEqual(currentArgentinaMonth(new Date("2026-08-01T02:30:00.000Z")), { year: 2026, month: 7 });
});

function payment(overrides: Partial<TraceablePayment> & Pick<TraceablePayment, "id" | "amount" | "createdAt">): TraceablePayment {
  return { studentId: "student-a", status: "PAGADO", billingPeriod: "2026-08-01", paidDate: "2026-08-12", method: "Transferencia", ...overrides };
}

test("movimientos de hoy usa createdAt en Argentina y suma pagos sin duplicarlos", () => {
  const payments = [
    payment({ id: "a", amount: 25000, createdAt: "2026-08-12T12:00:00.000Z" }),
    payment({ id: "b", amount: 30000, createdAt: "2026-08-13T01:30:00.000Z" }),
    payment({ id: "b", amount: 30000, createdAt: "2026-08-13T01:30:00.000Z" }),
  ];
  const result = registeredTodaySummary(payments, "2026-08", 100000, new Map([["student-a", "Ana"]]), new Date("2026-08-13T02:00:00.000Z"));
  assert.equal(result.dateKey, "2026-08-12");
  assert.equal(result.registeredTotal, 55000);
  assert.equal(result.registeredCount, 2);
  assert.equal(result.totalBeforeToday, 45000);
});

test("fecha efectiva de hoy no convierte en registrado hoy un pago creado ayer", () => {
  const result = registeredTodaySummary([
    payment({ id: "a", amount: 25000, createdAt: "2026-08-11T15:00:00.000Z", paidDate: "2026-08-12" }),
  ], "2026-08", 25000, new Map(), new Date("2026-08-12T15:00:00.000Z"));
  assert.equal(result.registeredCount, 0);
  assert.equal(result.registeredTotal, 0);
});

test("un pago creado hoy para julio aparece hoy pero no impacta agosto", () => {
  const result = registeredTodaySummary([
    payment({ id: "a", amount: 30000, createdAt: "2026-08-12T15:00:00.000Z", billingPeriod: "2026-07-01" }),
  ], "2026-08", 100000, new Map(), new Date("2026-08-12T16:00:00.000Z"));
  assert.equal(result.registeredTotal, 30000);
  assert.equal(result.selectedPeriodImpactTotal, 0);
  assert.equal(result.totalBeforeToday, 100000);
});

test("cobros semanales reconcilian exactamente con el total del período", () => {
  const payments = [
    payment({ id: "a", amount: 100000, createdAt: "2026-08-02T12:00:00.000Z", paidDate: "2026-08-02" }),
    payment({ id: "b", amount: 150000, createdAt: "2026-08-10T12:00:00.000Z", paidDate: "2026-08-10" }),
    payment({ id: "c", amount: 50000, createdAt: "2026-08-18T12:00:00.000Z", paidDate: "2026-08-18" }),
  ];
  const weeks = weeklyCollections(payments, "2026-08", new Map(), new Date("2026-09-01T12:00:00.000Z"));
  assert.equal(weeks.reduce((sum, week) => sum + week.total, 0), 300000);
  assert.deepEqual(weeks.slice(0, 3).map((week) => week.total), [100000, 150000, 50000]);
});

test("reconciliación explica por qué pendiente puede diferir de esperado menos cobrado", () => {
  const payments = [
    payment({ id: "a", studentId: "student-a", amount: 30000, createdAt: "2026-08-02T12:00:00.000Z" }),
    payment({ id: "b", studentId: "student-b", amount: 25000, createdAt: "2026-08-02T12:00:00.000Z" }),
  ];
  const result = reconcileMonthlyFinances(payments, [{ studentId: "student-a", expectedAmount: 25000 }, { studentId: "student-c", expectedAmount: 30000 }]);
  assert.equal(result.expectedTotal, 55000);
  assert.equal(result.collectedTotal, 55000);
  assert.equal(result.pendingTotal, 30000);
  assert.equal(result.paymentsWithoutObligation, 25000);
  assert.equal(result.overpaymentsOnObligations, 5000);
  assert.equal(result.unreconciledCollected, 30000);
});

test("diagnóstico distingue membresía sin importe de actividad sin obligación", () => {
  assert.deepEqual(missingObligationCause({ status: "ACTIVE", monthlyAmount: null }).code, "INVALID_MEMBERSHIP_AMOUNT");
  assert.deepEqual(missingObligationCause({ status: "ACTIVE", monthlyAmount: 30000 }).code, "OBLIGATION_NOT_GENERATED");
  assert.deepEqual(missingObligationCause(null).code, "NO_MEMBERSHIP");
  const activity = emptyActivityEvidence();
  activity.validPayments = 1;
  activity.presentAttendances = 3;
  assert.deepEqual(activityEvidenceLabels(activity), ["1 pago válido", "3 asistencias (3 presentes, 0 faltas, 0 justificadas)"]);
});

test("CSV usa UTF-8, español, importes numéricos y No disponible", () => {
  const detail = monthlySummaryCsv(sampleSummary());
  const general = monthlyGeneralCsv(sampleSummary());
  assert.ok(detail.startsWith("\uFEFF"));
  assert.match(detail, /"Ana, Pérez"/);
  assert.match(detail, /"15000"/);
  assert.match(detail, /"No disponible"/);
  assert.match(general, /"Ingreso esperado","No disponible"/);
});

test("la sesión administrativa válida es necesaria y no contiene identidad del cliente", () => {
  const previous = process.env.BM_COACH_ADMIN_TOKEN;
  process.env.BM_COACH_ADMIN_TOKEN = "x".repeat(32);
  try {
    const created = createAdminSessionValue(new Date("2026-08-01T12:00:00.000Z"));
    assert.ok(created);
    assert.equal(verifyAdminSessionValue(created.value, new Date("2026-08-01T13:00:00.000Z")).ok, true);
    assert.equal(verifyAdminSessionValue(`${created.value}x`, new Date("2026-08-01T13:00:00.000Z")).ok, false);
  } finally {
    if (previous === undefined) delete process.env.BM_COACH_ADMIN_TOKEN; else process.env.BM_COACH_ADMIN_TOKEN = previous;
  }
});

test("la migración impone idempotencia y relaciones normalizadas", async () => {
  const sql = await readFile(new URL("../prisma/migrations/20260801090000_monthly_historical_summary/migration.sql", import.meta.url), "utf8");
  assert.match(sql, /UNIQUE INDEX "monthly_student_obligations_studentId_period_key"/);
  assert.match(sql, /student_membership_history_studentId_fkey/);
  assert.match(sql, /student_status_events_studentId_fkey/);
  assert.doesNotMatch(sql, /db push|migrate reset/i);
});
