import { parseAttendanceHistoryFilter, type AttendanceHistoryFilter } from "./student-attendance-history";
import type { AttendanceEntry } from "../types/gestion";

export const PERFECT_ATTENDANCE_LIMITATION = "No evaluable: las clases se generan desde el día actual y las asignaciones no conservan todos sus cambios históricos. No se puede garantizar qué clases correspondían a cada alumno, incluidas altas, cambios y cancelaciones del período.";
export type AttendanceReportFilter = AttendanceHistoryFilter & { report: "history" | "stats"; q: string; status: "all" | "PRESENT" | "ABSENT" | "JUSTIFIED"; lowPage: number };
export type AttendanceReportStudent = { studentId: string; name: string; attended: number };
export type AttendanceReport = {
  report: "history" | "stats";
  history: AttendanceEntry[];
  total: number; page: number; pages: number;
  summary?: { records: number; attended: number; distinctStudents: number };
  students?: AttendanceReportStudent[];
  lowFrequency?: AttendanceReportStudent[];
  lowTotal?: number; lowPage?: number; lowPages?: number;
  perfectAttendance?: { evaluable: false; reason: string };
};

export function parseAttendanceReport(params: URLSearchParams, today?: string): AttendanceReportFilter {
  const report = params.get("report") ?? "history";
  if (report !== "history" && report !== "stats") throw new Error("Informe no válido.");
  const copy = new URLSearchParams(params);
  if (!copy.has("filter")) copy.set("filter", report === "stats" ? "month" : "all");
  const filter = parseAttendanceHistoryFilter(copy, today);
  if (report === "stats" && filter.filter === "all") throw new Error("Seleccioná un mes o rango para las estadísticas.");
  const status = params.get("status") ?? "all";
  if (!["all", "PRESENT", "ABSENT", "JUSTIFIED"].includes(status)) throw new Error("Estado no válido.");
  const lowPage = Number(params.get("lowPage") ?? 1);
  if (!Number.isSafeInteger(lowPage) || lowPage < 1) throw new Error("Página no válida.");
  const q = (params.get("q") ?? "").trim();
  if (q.length > 120) throw new Error("La búsqueda es demasiado larga.");
  return { ...filter, report, q, status: status as AttendanceReportFilter["status"], lowPage };
}
