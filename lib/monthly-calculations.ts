import type { MonthlySummaryData } from "@/types/monthly-summary";

export type ObligationState = "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "VOID";

export function obligationStatus(expected: number, paid: number, dueDate: string, asOf: string): ObligationState {
  if (paid >= expected) return "PAID";
  if (paid > 0) return "PARTIAL";
  return dueDate < asOf ? "OVERDUE" : "PENDING";
}

export function attendancePercentage(present: number, absent: number, justified: number) {
  const total = present + absent + justified;
  return total ? Math.round((present / total) * 1000) / 10 : null;
}

export function membershipConfigurationChanged(
  current: { plan: string; monthlyFee: number; serviceType: string; status: string },
  next: { plan: string; monthlyFee: number; serviceType: string; status: string },
) {
  return current.plan !== next.plan || current.monthlyFee !== next.monthlyFee || current.serviceType !== next.serviceType || current.status !== next.status;
}

export function closedMonthlySnapshot(data: MonthlySummaryData, closedAt: string): MonthlySummaryData {
  const frozen = structuredClone(data);
  return {
    ...frozen,
    metadata: { ...frozen.metadata, status: "CLOSED", closedAt, generatedAt: closedAt },
  };
}

export function hasHistoricalMembershipCoverage(monthStart: string, historyStart = "2026-08-01") {
  return monthStart >= historyStart;
}
