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

export function uniqueMonthlyStatusStudents(events: ReadonlyArray<{ studentId: string; type: string }>, type: "ENROLLMENT" | "DEACTIVATION") {
  return new Set(events.filter((event) => event.type === type).map((event) => event.studentId)).size;
}

export function uniqueActiveToInactiveStudents(events: ReadonlyArray<{ studentId: string; type: string; eventDate: string }>, monthStart: string, monthEnd: string) {
  const status = new Map<string, "active" | "suspended" | "inactive">();
  const deactivated = new Set<string>();
  let unknownPriorStatus = false;
  for (const event of events) {
    const previous = status.get(event.studentId);
    if (event.type === "DEACTIVATION") {
      if (previous === "active" && event.eventDate >= monthStart && event.eventDate < monthEnd) deactivated.add(event.studentId);
      if (!previous && event.eventDate >= monthStart && event.eventDate < monthEnd) unknownPriorStatus = true;
      status.set(event.studentId, "inactive");
    } else if (event.type === "SUSPENSION") status.set(event.studentId, "suspended");
    else if (event.type === "ENROLLMENT" || event.type === "REACTIVATION") status.set(event.studentId, "active");
  }
  return unknownPriorStatus ? null : deactivated.size;
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
