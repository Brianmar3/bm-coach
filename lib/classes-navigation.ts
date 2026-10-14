type Query = Pick<URLSearchParams, "get">;

/** Navigation intent lives in the URL, never in the last visited tab. */
export function classesView(pathname: string, query: Query) {
  if (pathname === "/clases") return "calendar";
  const view = query.get("view");
  return view === "history" || view === "low-activity" ? view : "attendance";
}

/** A new entry must initialize its own date, schedule and transient form state. */
export function attendanceEntryKey(query: Query) {
  return JSON.stringify([classesView("/asistencias", query), ...["mode", "scheduleId", "date", "studentId"].map((name) => query.get(name) ?? "")]);
}
