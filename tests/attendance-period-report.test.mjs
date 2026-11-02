import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { JSDOM } from "jsdom";

const require = createRequire(import.meta.url); const ts = require("typescript");
function loader(overrides = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file); if (cache.has(file)) return cache.get(file).exports;
    const record = { exports: {} }; cache.set(file, record);
    const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
    const localRequire = name => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name === "server-only") return {};
      if (!name.startsWith("@/") && !name.startsWith(".")) return require(name);
      const base = name.startsWith("@/") ? path.resolve(name.slice(2)) : path.resolve(path.dirname(file), name);
      return load([base + ".ts", base + ".tsx", base].find(existsSync));
    };
    new Function("require", "module", "exports", code)(localRequire, record, record.exports);
    return record.exports;
  }
  return load;
}
const load = loader();
const { parseAttendanceReport: parse } = load("lib/attendance-report.ts");
const { loadAttendanceReport: report } = load("lib/attendance-report-service.ts");
const { attendanceOriginHref, studentAttendanceHref } = load("lib/student-attendance-history.ts");
const parseQuery = query => parse(new URLSearchParams(query), "2026-11-02");
const ana = { id: "a", workspaceId: "bm", data: { firstName: "Ana", lastName: "Pérez" } };
const bruno = { id: "b", workspaceId: "bm", data: { firstName: "Bruno", lastName: "Díaz" } };
const row = (id, date, status, student = ana, extra = {}) => ({ id, date: new Date(date + "T00:00:00Z"), status, student, studentId: student.id, scheduleId: null, scheduleLabel: "Funcional", scheduleStartTime: "15:00", ...extra });
const records = [row("old", "2021-01-01", "PRESENT"), row("oct", "2026-10-31", "PRESENT"), row("nov-a", "2026-11-01", "PRESENT"), row("nov-a2", "2026-11-02", "PRESENT"), row("absent", "2026-11-01", "ABSENT", bruno), row("b-present", "2026-11-02", "PRESENT", bruno)];

function database(rows = records) {
  const calls = [];
  function match(where) {
    assert.equal(where.student.workspaceId, "bm"); assert.ok(where.student.AND.length);
    assert.deepEqual(where.OR, [{ scheduleId: null }, { schedule: { workspaceId: "bm" } }]);
    const words = where.student.AND.slice(1).map(filter => filter.OR[0].data.string_contains.toLowerCase());
    return rows.filter(record => record.student.workspaceId === "bm" && record.student.data.accountType !== "SELF_SERVICE" && (!record.scheduleId || record.schedule?.workspaceId === "bm") && (!where.status || record.status === where.status) && (!where.date?.gte || record.date >= where.date.gte) && (!where.date?.lt || record.date < where.date.lt) && (!where.date?.lte || record.date <= where.date.lte) && words.every(word => [record.student.data.firstName, record.student.data.lastName].some(field => field.toLowerCase().includes(word))));
  }
  return { calls, classAttendance: {
    count: async ({ where }) => { calls.push("count"); return match(where).length; },
    findMany: async ({ where, skip, take, orderBy }) => { calls.push("records"); assert.equal(take, 30); assert.equal(orderBy[0].date, "desc"); return match(where).sort((a, b) => b.date - a.date || a.id.localeCompare(b.id)).slice(skip, skip + take); },
    groupBy: async ({ where }) => {
      calls.push("aggregate"); const groups = new Map();
      for (const record of match(where)) { const key = record.studentId + record.status; const group = groups.get(key) ?? { studentId: record.studentId, status: record.status, _count: { _all: 0 } }; group._count._all++; groups.set(key, group); }
      return [...groups.values()];
    },
  }, studentRecord: { findMany: async ({ where }) => { calls.push("names"); assert.equal(where.workspaceId, "bm"); assert.ok(where.AND.length); return [...new Map(rows.filter(record => record.student.workspaceId === "bm" && where.id.in.includes(record.studentId)).map(record => [record.studentId, record.student])).values()]; } } };
}

test("historial general incluye varios años, mes/rango inclusivo, nombre y estado; pagina en base", async () => {
  const all = await report(database(), "bm", parseQuery(""));
  assert.equal(all.total, 6); assert.equal(all.history.at(-1).id, "old");
  const month = await report(database(), "bm", parseQuery("filter=month&month=2026-11&q=ANA+PÉR&status=PRESENT"));
  assert.equal(month.total, 2); assert.ok(month.history.every(record => record.studentId === "a"));
  const range = await report(database(), "bm", parseQuery("filter=range&from=2026-10-31&to=2026-11-01&status=ABSENT"));
  assert.deepEqual(range.history.map(record => record.id), ["absent"]);
  const many = database(Array.from({ length: 65 }, (_, index) => row(String(index).padStart(3, "0"), "2021-01-01", "PRESENT")));
  const ids = [];
  for (let page = 1; page <= 3; page++) { const result = await report(many, "bm", parseQuery("page=" + page)); assert.equal(result.pages, 3); assert.ok(result.history.length <= 30); ids.push(...result.history.map(record => record.id)); }
  assert.equal(new Set(ids).size, 65);
});

test("estadísticas: presentes, registros, alumnos distintos y ranking consistentes; consultas fijas", async () => {
  const db = database(); const result = await report(db, "bm", parseQuery("report=stats&month=2026-11"));
  assert.deepEqual(result.summary, { attended: 3, records: 4, distinctStudents: 2 });
  assert.deepEqual(result.students.map(student => [student.studentId, student.attended]), [["a", 2], ["b", 1]]);
  assert.deepEqual(result.lowFrequency.map(student => student.studentId), ["b"]);
  assert.deepEqual(db.calls, ["aggregate", "names"]);
  assert.equal(result.perfectAttendance.evaluable, false); assert.match(result.perfectAttendance.reason, /No evaluable/);
  assert.equal("percentage" in result, false);
});

test("ni presentes solos ni planes o cancelaciones permiten inventar asistencia perfecta", async () => {
  for (const rows of [[row("single", "2026-11-01", "PRESENT")], [], [row("absence", "2026-11-01", "ABSENT")]]) {
    const result = await report(database(rows), "bm", parseQuery("report=stats"));
    assert.equal(result.perfectAttendance.evaluable, false); assert.equal(result.perfectAttendance.reason.includes("cancelaciones"), true);
    assert.ok(result.students.every(student => !("percentage" in student)));
  }
});

test("estadísticas de rango y búsqueda; alumnos con registros pero cero presentes", async () => {
  const result = await report(database(), "bm", parseQuery("report=stats&filter=range&from=2026-11-01&to=2026-11-01&q=Bruno"));
  assert.deepEqual(result.summary, { records: 1, attended: 0, distinctStudents: 0 }); assert.equal(result.lowFrequency[0].attended, 0);
});

test("ranking y baja frecuencia paginan agregados sin cargar filas históricas", async () => {
  const rows = Array.from({ length: 35 }, (_, index) => row(String(index), "2026-11-01", "PRESENT", { ...ana, id: String(index).padStart(3, "0") }));
  const db = database(rows);
  const result = await report(db, "bm", parseQuery("report=stats&page=2&lowPage=2"));
  assert.equal(result.total, 35); assert.equal(result.pages, 2); assert.equal(result.students.length, 5);
  assert.equal(result.lowTotal, 35); assert.equal(result.lowPages, 2); assert.equal(result.lowFrequency.length, 5);
  assert.deepEqual(result.summary, { attended: 35, records: 35, distinctStudents: 35 });
  assert.deepEqual(db.calls, ["aggregate", "names"]);
});

test("workspaces, horarios ajenos y alumnos autónomos quedan fuera de historial y estadísticas", async () => {
  const foreign = { ...ana, id: "foreign", workspaceId: "other" };
  const rows = [...records, row("foreign", "2026-11-01", "PRESENT", foreign), row("cross", "2026-11-01", "PRESENT", ana, { scheduleId: "other", schedule: { workspaceId: "other" } }), row("self", "2026-11-01", "PRESENT", { ...ana, id: "self", data: { ...ana.data, accountType: "SELF_SERVICE" } })];
  assert.equal((await report(database(rows), "bm", parseQuery(""))).total, 6);
  assert.equal((await report(database(rows), "bm", parseQuery("report=stats"))).summary.records, 4);
  await assert.rejects(() => report(database(), "", parseQuery("")));
});

test("parámetros inválidos se rechazan y el retorno sólo permite rutas locales de asistencia", () => {
  assert.equal(parseQuery("").filter, "all"); assert.equal(parseQuery("report=stats").filter, "month");
  for (const query of ["report=other", "report=stats&filter=all", "status=NO_RECORD", "lowPage=0", "filter=range&from=2026-11-02&to=2026-11-01", "q=" + "a".repeat(121)]) assert.throws(() => parseQuery(query));
  const origin = "/asistencias?view=history&mode=records&filter=month&month=2026-10&q=Ana&status=PRESENT&page=3";
  const href = new URL(studentAttendanceHref("a", origin), "https://bm.test");
  assert.equal(href.pathname, "/alumnos/a/asistencias"); assert.equal(href.searchParams.get("returnTo"), attendanceOriginHref("a", origin));
  assert.equal(attendanceOriginHref("a", "https://evil.test/asistencias?date=2026-11-02"), "/alumnos?studentId=a&section=attendance");
});

test("API de informes exige sesión, valida filtros y obtiene workspace desde servidor", async () => {
  let auth = { ok: false }; let count = 0;
  const GET = loader({ "next/headers": { cookies: async () => ({ get: () => undefined }) }, "@/lib/admin-auth": { ADMIN_SESSION_COOKIE: "admin", verifyAdminSessionValue: () => auth, adminAuthError: () => ({ error: "No autorizado", status: 401 }) }, "@/lib/trainer-workspace": { requireTrainerWorkspace: async () => ({ workspaceId: "bm" }) }, "@/lib/prisma": { prisma: {} }, "@/lib/attendance-report-service": { loadAttendanceReport: async (_db, workspace) => { assert.equal(workspace, "bm"); count++; return { total: 0 }; } } })("app/api/asistencias/historial/route.ts").GET;
  assert.equal((await GET(new Request("https://bm.test/api/asistencias/historial"))).status, 401); assert.equal(count, 0);
  auth = { ok: true };
  assert.equal((await GET(new Request("https://bm.test/api/asistencias/historial?status=bad"))).status, 400);
  const response = await GET(new Request("https://bm.test/api/asistencias/historial?workspaceId=evil"));
  assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "private, no-store"); assert.equal(count, 1);
});

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://bm.test/asistencias", pretendToBeVisual: true });
for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "HTMLInputElement", "HTMLSelectElement", "Event", "MouseEvent", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"]) Object.defineProperty(globalThis, key, { configurable: true, value: ["getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"].includes(key) ? dom.window[key].bind(dom.window) : dom.window[key] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = require("react"); const h = React.createElement;
const { render, screen, fireEvent, cleanup, waitFor, act } = require("@testing-library/react");
const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; });
const router = { replace(href) { window.history.replaceState(window.history.state, "", href); window.dispatchEvent(new Event("querychange")); } };
const navigation = { useRouter: () => router, useSearchParams: () => new URLSearchParams(React.useSyncExternalStore(callback => { window.addEventListener("querychange", callback); return () => window.removeEventListener("querychange", callback); }, () => window.location.search)) };
const Link = ({ href, children, ...props }) => { delete props.replace; delete props.scroll; return h("a", { ...props, href }, children); };
const shell = { ModuleShell: ({ children, action }) => h("main", null, action, children), inputClass: "input" };
const components = loader({ "next/link": { default: Link }, "next/navigation": navigation, "@/componentes/module-shell": shell, "@/componentes/weekly-attendance-history": { WeeklyAttendanceHistory: () => null }, "@/lib/client-api": { apiRequest: async (url, options) => (await globalThis.fetch(url, options)).json() } });
const Report = components("componentes/attendance-period-report.tsx").AttendancePeriodReport;
const Individual = components("componentes/student-attendance-history.tsx").StudentAttendanceHistoryView;
const Daily = components("app/asistencias/page.tsx").default;

for (const width of [390, 1280]) test(`informe ${width}px: búsqueda, estado, rango e historial individual conservan filtros`, async () => {
  window.innerWidth = width; window.history.replaceState(null, "", "/asistencias?view=history&mode=records");
  globalThis.fetch = async url => ({ ok: true, json: async () => report(database(), "bm", parse(new URL(url, window.location.origin).searchParams, "2026-11-02")) });
  const view = render(h(Report, { statistics: false }));
  await screen.findByText("6 registros · Del más reciente al más antiguo"); assert.ok(screen.getByText("1/1/2021"));
  fireEvent.change(screen.getByLabelText("Período"), { target: { value: "range" } });
  fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-11-01" } }); fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-11-02" } });
  fireEvent.change(screen.getByLabelText("Buscar alumno"), { target: { value: "Ana" } }); fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "PRESENT" } });
  fireEvent.submit(screen.getByRole("button", { name: "Aplicar filtros" }).closest("form"));
  await screen.findByText("2 registros · Del más reciente al más antiguo");
  const origin = window.location.pathname + window.location.search;
  const href = screen.getAllByRole("link", { name: "Ana Pérez →" })[0].getAttribute("href");
  const returnHref = attendanceOriginHref("a", origin);
  assert.equal(new URL(href, window.location.origin).searchParams.get("returnTo"), returnHref);
  view.unmount(); window.history.pushState(null, "", href);
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ student: { id: "a", name: "Ana Pérez" }, summary: { attended: 4, firstAttendance: "2021-01-01", lastAttendance: "2026-11-02", currentMonth: 2 }, history: [], totalRecords: 0, page: 1, pages: 1 }) });
  const individual = render(h(Individual, { studentId: "a", initialQuery: "" }));
  await screen.findByRole("link", { name: "← Volver a asistencias" });
  assert.equal(screen.getByRole("link", { name: "← Volver a asistencias" }).getAttribute("href"), returnHref);
  individual.unmount(); router.replace(returnHref);
  globalThis.fetch = async url => ({ ok: true, json: async () => report(database(), "bm", parseQuery(new URL(url, window.location.origin).searchParams.toString())) });
  render(h(Report, { statistics: false }));
  await screen.findByText("2 registros · Del más reciente al más antiguo");
  assert.equal(screen.getByLabelText("Buscar alumno").value, "Ana"); assert.equal(screen.getByLabelText("Desde").value, "2026-11-01"); assert.equal(screen.getByLabelText("Estado").value, "PRESENT");
});

test("estadísticas renderizan ranking y No evaluable sin ofrecer falsos alumnos perfectos", async () => {
  window.history.replaceState(null, "", "/asistencias?view=history&mode=stats&month=2026-11");
  globalThis.fetch = async url => ({ ok: true, json: async () => report(database(), "bm", parseQuery(new URL(url, window.location.origin).searchParams.toString())) });
  render(h(Report, { statistics: true }));
  await screen.findByRole("heading", { name: "Asistencia perfecta" });
  assert.ok(screen.getByText(/^No evaluable/)); assert.equal(screen.queryByText("100%"), null);
  assert.equal(screen.getByLabelText("Período").value, "month"); assert.ok(screen.getByText("2 presentes"));
});

test("registro diario: filtrar/seleccionar Todos no guarda; conserva día/clase y el guardado sigue igual", async () => {
  window.history.replaceState(null, "", "/asistencias?view=attendance&date=2026-11-02&scheduleId=slot&q=Ana");
  const puts = [];
  globalThis.fetch = async (url, options = {}) => {
    if (options.method === "PUT") { puts.push(JSON.parse(options.body)); return { ok: true, json: async () => ({}) }; }
    const body = url === "/api/clases" ? [{ id: "slot", dayOfWeek: "MONDAY", startTime: "15:00", endTime: "16:00", classType: "Funcional", active: true, students: [] }] : url === "/api/alumnos" ? [] : url.startsWith("/api/asistencias/resumen") ? { today: { present: 0, absent: 0, justified: 0, total: 0 }, monthlyPercentage: 0, recentAbsences: [] } : { students: [ana, bruno].map(student => ({ id: student.id, name: student.data.firstName + " " + student.data.lastName, assigned: true, status: null, confirmation: null })) };
    return { ok: true, json: async () => body };
  };
  const view = render(h(Daily));
  await screen.findByRole("article", { name: "Ana Pérez. Sin registrar" });
  assert.equal(screen.queryByRole("article", { name: "Bruno Díaz. Sin registrar" }), null);
  assert.equal(puts.length, 0);
  fireEvent.click(screen.getByRole("button", { name: "Todos los alumnos" }));
  await screen.findByRole("article", { name: "Bruno Díaz. Sin registrar" });
  assert.equal(screen.getByLabelText("Fecha").value, "2026-11-02"); assert.equal(puts.length, 0);
  fireEvent.change(screen.getByLabelText("Buscar alumno"), { target: { value: "PEREZ" } });
  await waitFor(() => assert.equal(screen.queryByRole("article", { name: "Bruno Díaz. Sin registrar" }), null));
  assert.equal(puts.length, 0);
  const link = screen.getByRole("link", { name: "Ver historial del alumno →" });
  const origin = new URL(link.getAttribute("href"), window.location.origin).searchParams.get("returnTo");
  assert.equal(new URL(origin, window.location.origin).searchParams.get("scheduleId"), "slot");
  assert.equal(new URL(origin, window.location.origin).searchParams.get("q"), "PEREZ");
  link.addEventListener("click", event => event.preventDefault(), { once: true });
  fireEvent.click(link);
  assert.equal(new URLSearchParams(window.location.search).get("q"), "PEREZ");
  view.unmount();
  render(h(Daily));
  await screen.findByRole("article", { name: "Ana Pérez. Sin registrar" });
  assert.equal(screen.getByLabelText("Buscar alumno").value, "PEREZ");
  assert.equal(screen.getByLabelText("Fecha").value, "2026-11-02"); assert.equal(puts.length, 0);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Presente" })));
  assert.deepEqual(puts, [{ date: "2026-11-02", scheduleId: "slot", records: [{ studentId: "a", status: "presente" }] }]);
});
