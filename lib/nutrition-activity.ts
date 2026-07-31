export type NutritionScheduledActivity = {
  source: "OCCURRENCE" | "SCHEDULE" | "ROUTINE";
  name: string;
  startTime: string;
  status: "UPCOMING" | "IN_PROGRESS" | "COMPLETED" | "GENERAL";
};

const WEEKDAY_BY_NUMBER = [
  "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY",
];

export function weekdayForDateKey(dateKey: string) {
  return WEEKDAY_BY_NUMBER[new Date(`${dateKey}T12:00:00.000Z`).getUTCDay()] ?? "";
}

export function resolveNutritionActivities(input: {
  today: string;
  localTime: string;
  occurrences: Array<{ name: string; startTime: string; endTime: string; status: string }>;
  weeklySchedules: Array<{ dayOfWeek: string; startTime: string; endTime?: string; classType: string }>;
  routineName?: string | null;
}) {
  const occurrences: NutritionScheduledActivity[] = input.occurrences
    .filter((item) => item.status !== "CANCELLED")
    .map((item) => ({
      source: "OCCURRENCE" as const,
      name: item.name,
      startTime: item.startTime,
      status:
        item.status === "COMPLETED" || item.endTime <= input.localTime
          ? "COMPLETED" as const
          : item.startTime <= input.localTime && item.endTime > input.localTime
            ? "IN_PROGRESS" as const
            : "UPCOMING" as const,
    }));
  const existing = new Set(
    occurrences.map((item) => `${item.startTime}|${item.name.toLocaleLowerCase("es-AR")}`),
  );
  const weekday = weekdayForDateKey(input.today);
  const scheduleFallback: NutritionScheduledActivity[] = input.weeklySchedules
    .filter((item) => item.dayOfWeek === weekday)
    .filter((item) => !existing.has(`${item.startTime}|${item.classType.toLocaleLowerCase("es-AR")}`))
    .map((item) => ({
      source: "SCHEDULE" as const,
      name: item.classType,
      startTime: item.startTime,
      status:
        item.endTime && item.endTime <= input.localTime
          ? "COMPLETED" as const
          : item.startTime <= input.localTime && (!item.endTime || item.endTime > input.localTime)
            ? "IN_PROGRESS" as const
            : "UPCOMING" as const,
    }));
  const activities = [...occurrences, ...scheduleFallback].sort((left, right) =>
    left.startTime.localeCompare(right.startTime),
  );
  if (!activities.length && input.routineName) {
    activities.push({ source: "ROUTINE", name: input.routineName, startTime: "", status: "GENERAL" });
  }
  const relevantActivity =
    activities.find((item) => item.status === "IN_PROGRESS") ??
    activities.find((item) => item.status === "UPCOMING") ??
    activities.at(-1) ?? null;
  return { activities, relevantActivity };
}
