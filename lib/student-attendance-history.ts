import { argentinaDateKey, isDateKey } from "./payment-dates";
import type { AttendanceEntry } from "../types/gestion";

export const ATTENDANCE_HISTORY_PAGE_SIZE = 30;
export type AttendanceHistoryFilter = { filter: "all" | "month" | "range"; from?: string; to?: string; month: string; page: number };
export type StudentAttendanceHistory = {
  student: { id: string; name: string };
  summary: { attended: number; firstAttendance: string | null; lastAttendance: string | null; currentMonth: number };
  history: AttendanceEntry[];
  totalRecords: number;
  page: number;
  pages: number;
};

export function parseAttendanceHistoryFilter(params: URLSearchParams, today = argentinaDateKey()): AttendanceHistoryFilter {
  const filter = params.get("filter") ?? "all";
  if (!["all", "month", "range"].includes(filter)) throw new Error("Seleccioná un filtro válido.");
  const month = params.get("month") ?? today.slice(0, 7);
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  if (filter === "month" && !isDateKey(`${month}-01`)) throw new Error("Seleccioná un mes válido.");
  if (filter === "range" && (!isDateKey(from) || !isDateKey(to) || from > to)) throw new Error("Seleccioná un rango de fechas válido.");
  const page = Number(params.get("page") ?? 1);
  if (!Number.isSafeInteger(page) || page < 1) throw new Error("La página no es válida.");
  return { filter: filter as AttendanceHistoryFilter["filter"], month, from, to, page };
}

/** Only return to the student list, never to an arbitrary URL supplied by the client. */
export function attendanceReturnHref(studentId: string, value?: string | null) {
  const url = new URL("/alumnos", "https://bm.invalid");
  if (value?.startsWith("/alumnos?") && !value.includes("\\")) {
    const incoming = new URL(value, url);
    for (const key of ["buscar", "estado", "plan", "servicio", "scroll"]) {
      const field = incoming.searchParams.get(key);
      if (field) url.searchParams.set(key, field);
    }
  }
  url.searchParams.set("studentId", studentId);
  url.searchParams.set("section", "attendance");
  return `${url.pathname}?${url.searchParams}`;
}

export function studentAttendanceHref(studentId: string, returnTo: string) {
  return `/alumnos/${encodeURIComponent(studentId)}/asistencias?${new URLSearchParams({ returnTo: attendanceReturnHref(studentId, returnTo) })}`;
}
