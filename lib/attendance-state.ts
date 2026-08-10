import type { AttendanceStatus } from "@/types/gestion";

export function toggledAttendanceStatus(current: AttendanceStatus | null, selected: AttendanceStatus) {
  return current === selected ? null : selected;
}
