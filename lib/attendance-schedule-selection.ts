type Schedule = { id: string; dayOfWeek: string; startTime: string; endTime: string; active: boolean };
const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

/** Select active schedules without depending on their roster or mutating their order. */
export function automaticAttendanceSchedule(schedules: readonly Schedule[], date: string, now = new Date()): string {
  const day = days[new Date(`${date}T12:00:00Z`).getUTCDay()];
  const candidates = schedules.filter((schedule) => schedule.active && schedule.dayOfWeek === day)
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime) || a.id.localeCompare(b.id));
  const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  // End is exclusive: at a consecutive class boundary the next class is in progress.
  const running = candidates.filter((schedule) => schedule.startTime <= clock && clock < schedule.endTime);
  return running.at(-1)?.id ?? candidates.find((schedule) => schedule.startTime > clock)?.id ?? candidates.at(-1)?.id ?? "";
}

export function attendanceScheduleSelection(manualId: string | null, automaticId: string): string {
  return manualId ?? automaticId;
}
