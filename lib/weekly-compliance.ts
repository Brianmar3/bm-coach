export type WeeklyComplianceRecord = {
  date: string;
  status: "PRESENT" | "ABSENT" | "JUSTIFIED" | string;
};

export type WeeklyCompliance = {
  expected: number;
  presentDays: number;
  manualAbsent: number;
  justified: number;
  automaticAbsent: number;
  resolved: number;
  closed: boolean;
};

export function weeklyCompliance(
  expected: number | null | undefined,
  records: WeeklyComplianceRecord[],
  closed: boolean,
): WeeklyCompliance {
  const target = Math.max(0, Math.trunc(expected ?? 0));
  const presentDays = new Set(records.filter((record) => record.status === "PRESENT").map((record) => record.date)).size;
  const manualAbsent = records.filter((record) => record.status === "ABSENT").length;
  const justified = records.filter((record) => record.status === "JUSTIFIED").length;
  const resolved = Math.min(target, presentDays + manualAbsent + justified);
  return {
    expected: target,
    presentDays,
    manualAbsent,
    justified,
    automaticAbsent: closed ? Math.max(0, target - resolved) : 0,
    resolved,
    closed,
  };
}

export function distinctPresentRecords<T extends { date: Date | string }>(records: T[]) {
  const byDate = new Map<string, T>();
  for (const record of records) {
    const date = record.date instanceof Date ? record.date.toISOString().slice(0, 10) : record.date.slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, record);
  }
  return [...byDate.values()];
}
