import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { JSDOM } from "jsdom";

const require = createRequire(import.meta.url);
const ts = require("typescript");
function loader(overrides = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const record = { exports: {} }; cache.set(file, record);
    const source = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
    const resolve = name => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name === "server-only") return {};
      if (!name.startsWith("@/") && !name.startsWith(".")) return require(name);
      const base = name.startsWith("@/") ? path.resolve(name.slice(2)) : path.resolve(path.dirname(file), name);
      return load([base + ".ts", base + ".tsx", base].find(existsSync));
    };
    new Function("require", "module", "exports", source)(resolve, record, record.exports);
    return record.exports;
  }
  return load;
}
const load = loader();
const { parseAttendanceHistoryFilter: parse, attendanceReturnHref, studentAttendanceHref } = load("lib/student-attendance-history.ts");
const { loadStudentAttendanceHistory: history } = load("lib/student-attendance-history-service.ts");
const all = () => parse(new URLSearchParams(), "2026-11-02");
const student = { id: "ana", workspaceId: "bm", data: { firstName: "Ana", lastName: "Pérez" } };
const row = (id, date, status = "PRESENT", extra = {}) => ({ id, studentId: "ana", date: new Date(date + "T00:00:00Z"), status, scheduleId: null, scheduleLabel: "Funcional", scheduleStartTime: "15:45", student, ...extra });

function database(rows, allowed = true) {
  const match = where => {
    assert.equal(where.studentId, "ana"); assert.deepEqual(where.student, { workspaceId: "bm" });
    assert.deepEqual(where.OR, [{ scheduleId: null }, { schedule: { workspaceId: "bm" } }]);
    return rows.filter(record => record.studentId === "ana" && record.student.workspaceId === "bm" && (!record.scheduleId || record.schedule?.workspaceId === "bm") && (!where.status || record.status === where.status) && (!where.date?.gte || record.date >= where.date.gte) && (!where.date?.lt || record.date < where.date.lt) && (!where.date?.lte || record.date <= where.date.lte));
  };
  return {
    studentRecord: { findFirst: async ({ where }) => { assert.equal(where.workspaceId, "bm"); assert.equal(where.id, "ana"); assert.ok(where.AND.length); return allowed ? student : null; } },
    classAttendance: {
      aggregate: async ({ where }) => { const dates = match(where).map(record => record.date).sort((a, b) => a - b); return { _count: { _all: dates.length }, _min: { date: dates[0] ?? null }, _max: { date: dates.at(-1) ?? null } }; },
      count: async ({ where }) => match(where).length,
      findMany: async ({ where, take, skip, orderBy }) => {
        assert.equal(take, 30); assert.deepEqual(orderBy, [{ date: "asc" }, { scheduleStartTime: "asc" }, { id: "asc" }]);
        return match(where).sort((a, b) => a.date - b.date || a.scheduleStartTime.localeCompare(b.scheduleStartTime) || a.id.localeCompare(b.id)).slice(skip, skip + take);
      },
    },
  };
}

test("sin filtro incluye registros antiguos; totales cuentan presentes y conservan ausencias explícitas", async () => {
  const rows = [row("old", "2021-02-01"), row("absence", "2026-11-01", "ABSENT"), row("new", "2026-11-02"), row("justified", "2026-10-31", "JUSTIFIED")];
  const result = await history(database(rows), "bm", "ana", all(), "2026-11-02");
  assert.deepEqual(result.summary, { attended: 2, firstAttendance: "2021-02-01", lastAttendance: "2026-11-02", currentMonth: 1 });
  assert.equal(result.totalRecords, 4);
  assert.deepEqual(result.history.map(item => item.id), ["old", "justified", "absence", "new"]);
  assert.deepEqual(result.history.map(item => item.status), ["presente", "justificado", "ausente", "presente"]);
  assert.equal("percentage" in result.summary, false);
});

test("mes y rango inclusivo filtran registros, sin alterar el resumen histórico", async () => {
  const db = database([row("old", "2021-01-01"), row("oct", "2026-10-31"), row("nov", "2026-11-01"), row("next", "2026-12-01")]);
  const monthly = await history(db, "bm", "ana", parse(new URLSearchParams("filter=month&month=2026-11")), "2026-11-02");
  assert.deepEqual(monthly.history.map(item => item.id), ["nov"]); assert.equal(monthly.summary.attended, 4);
  const range = await history(db, "bm", "ana", parse(new URLSearchParams("filter=range&from=2026-10-31&to=2026-11-01")), "2026-11-02");
  assert.deepEqual(range.history.map(item => item.id), ["oct", "nov"]);
});

test("paginación acotada permite recorrer todo el historial sin duplicar registros", async () => {
  const db = database(Array.from({ length: 65 }, (_, index) => row(String(index).padStart(3, "0"), "2021-01-01")));
  const records = [];
  for (let page = 1; page <= 3; page++) {
    const result = await history(db, "bm", "ana", { ...all(), page }, "2026-11-02");
    assert.equal(result.pages, 3); assert.ok(result.history.length <= 30); records.push(...result.history.map(item => item.id));
  }
  assert.equal(new Set(records).size, 65);
  assert.equal((await history(db, "bm", "ana", { ...all(), page: 999 }, "2026-11-02")).page, 3);
});

test("sin asistencias no inventa fechas, ausencias ni porcentajes", async () => {
  const result = await history(database([]), "bm", "ana", all(), "2026-11-02");
  assert.deepEqual(result.summary, { attended: 0, firstAttendance: null, lastAttendance: null, currentMonth: 0 });
  assert.deepEqual(result.history, []); assert.equal(result.totalRecords, 0);
});

test("rechaza otro workspace antes de consultar asistencias y excluye horarios cruzados", async () => {
  const denied = database([], false); denied.classAttendance = new Proxy({}, { get() { throw Error("No attendance reads allowed"); } });
  assert.equal(await history(denied, "bm", "ana", all(), "2026-11-02"), null);
  const rows = [row("own", "2026-11-01"), row("foreign-schedule", "2026-11-01", "PRESENT", { scheduleId: "other", schedule: { workspaceId: "foreign" } }), row("foreign-student", "2026-11-01", "PRESENT", { studentId: "other" })];
  assert.equal((await history(database(rows), "bm", "ana", all(), "2026-11-02")).totalRecords, 1);
});

test("validación de filtros y retorno seguro conserva búsqueda, filtros y ficha del alumno correcto", () => {
  assert.equal(all().filter, "all");
  for (const query of ["filter=today", "page=0", "page=1.5", "filter=month&month=2026-13", "filter=range&from=2026-02-30&to=2026-03-01", "filter=range&from=2026-11-02&to=2026-11-01"]) assert.throws(() => parse(new URLSearchParams(query)));
  const route = new URL(studentAttendanceHref("ana", "/alumnos?buscar=Ana&estado=activo&plan=Plan&servicio=CLASSES&scroll=800&studentId=other"), "https://bm.test");
  assert.equal(route.pathname, "/alumnos/ana/asistencias");
  const back = new URL(route.searchParams.get("returnTo"), route);
  for (const [key, value] of Object.entries({ buscar: "Ana", estado: "activo", plan: "Plan", servicio: "CLASSES", scroll: "800", studentId: "ana", section: "attendance" })) assert.equal(back.searchParams.get(key), value);
  assert.equal(attendanceReturnHref("ana", "https://evil.test/alumnos?buscar=x"), "/alumnos?studentId=ana&section=attendance");
});

test("API: exige sesión y workspace, devuelve 404 ajeno y 400 ante filtros inválidos", async () => {
  let auth = { ok: false }; let reads = 0;
  const GET = loader({
    "next/headers": { cookies: async () => ({ get: () => undefined }) },
    "@/lib/admin-auth": { ADMIN_SESSION_COOKIE: "admin", verifyAdminSessionValue: () => auth, adminAuthError: () => ({ error: "No autorizado", status: 401 }) },
    "@/lib/trainer-workspace": { requireTrainerWorkspace: async () => ({ workspaceId: "bm" }) },
    "@/lib/prisma": { prisma: {} },
    "@/lib/student-attendance-history-service": { loadStudentAttendanceHistory: async (_db, workspaceId, id) => { reads++; assert.equal(workspaceId, "bm"); assert.equal(id, "other"); return null; } },
  })("app/api/admin/alumnos/[id]/attendance-history/route.ts").GET;
  const context = { params: Promise.resolve({ id: "other" }) };
  assert.equal((await GET(new Request("https://bm.test/api/history"), context)).status, 401); assert.equal(reads, 0);
  auth = { ok: true };
  assert.equal((await GET(new Request("https://bm.test/api/history?filter=today"), context)).status, 400); assert.equal(reads, 0);
  assert.equal((await GET(new Request("https://bm.test/api/history"), context)).status, 404); assert.equal(reads, 1);
});

// Real React events and URL updates, without a database or browser installation.
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://bm.test/alumnos", pretendToBeVisual: true });
for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "HTMLInputElement", "Event", "MouseEvent", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"]) Object.defineProperty(globalThis, key, { configurable: true, value: ["getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"].includes(key) ? dom.window[key].bind(dom.window) : dom.window[key] });
window.scrollTo = () => {};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = require("react");
const { render, screen, fireEvent, cleanup, waitFor, act } = require("@testing-library/react");
const h = React.createElement;
const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; });
const router = { replace(href) { window.history.replaceState(null, "", href); window.dispatchEvent(new Event("querychange")); } };
const navigation = { useRouter: () => router, useSearchParams: () => {
  const query = React.useSyncExternalStore(callback => { window.addEventListener("querychange", callback); return () => window.removeEventListener("querychange", callback); }, () => window.location.search);
  return new URLSearchParams(query);
} };
const Link = ({ href, children, ...props }) => { delete props.replace; delete props.scroll; return h("a", { ...props, href }, children); };
const shell = { ModuleShell: ({ title, action, children }) => h("main", null, h("h1", null, title), action, children), inputClass: "input" };
const View = loader({ "next/link": { default: Link }, "next/navigation": navigation, "@/componentes/module-shell": shell })("componentes/student-attendance-history.tsx").StudentAttendanceHistoryView;

for (const width of [390, 1280]) test(`vista ${width}px: todo el historial, filtros, paginación y retorno sin búsqueda nueva`, async () => {
  window.innerWidth = width;
  const returnTo = attendanceReturnHref("ana", "/alumnos?buscar=Ana&estado=activo&scroll=400");
  window.history.replaceState(null, "", "/alumnos/ana/asistencias?" + new URLSearchParams({ returnTo }));
  const requests = [];
  globalThis.fetch = async url => {
    requests.push(url);
    const result = await history(database([row("old", "2021-01-01"), row("absent", "2026-11-02", "ABSENT")]), "bm", "ana", parse(new URL(url, window.location.origin).searchParams), "2026-11-02");
    return { ok: true, json: async () => result };
  };
  render(h(View, { studentId: "ana", returnTo, initialQuery: "" }));
  await screen.findByRole("heading", { name: "Ana Pérez" });
  assert.equal(screen.getByLabelText("Período").value, "all");
  assert.equal(screen.getAllByText("1/1/2021").length, 3); assert.ok(screen.getByText("Ausente"));
  assert.equal(screen.getByRole("link", { name: /Volver a la ficha/ }).getAttribute("href"), returnTo);
  fireEvent.change(screen.getByLabelText("Período"), { target: { value: "month" } });
  fireEvent.change(screen.getByLabelText("Mes"), { target: { value: "2026-11" } });
  fireEvent.submit(screen.getByRole("button", { name: "Aplicar filtros" }).closest("form"));
  await waitFor(() => assert.equal(screen.getAllByText("1/1/2021").length, 2));
  await screen.findByText("Ausente");
  assert.ok(requests.at(-1).includes("filter=month"));
  assert.equal(new URLSearchParams(window.location.search).get("returnTo"), returnTo);
  fireEvent.change(screen.getByLabelText("Período"), { target: { value: "range" } });
  fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2021-01-01" } });
  fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2021-01-01" } });
  fireEvent.submit(screen.getByRole("button", { name: "Aplicar filtros" }).closest("form"));
  await waitFor(() => assert.equal(screen.queryByText("Ausente"), null));
  await screen.findByText("Presente");
  assert.ok(requests.at(-1).includes("filter=range"));
});

test("vista paginada conserva el retorno y muestra páginas posteriores por URL", async () => {
  const db = database(Array.from({ length: 65 }, (_, index) => row(String(index).padStart(3, "0"), "2021-01-01")));
  const returnTo = attendanceReturnHref("ana", "/alumnos?buscar=Ana");
  window.history.replaceState(null, "", "/alumnos/ana/asistencias?" + new URLSearchParams({ returnTo }));
  globalThis.fetch = async url => ({ ok: true, json: async () => history(db, "bm", "ana", parse(new URL(url, window.location.origin).searchParams), "2026-11-02") });
  render(h(View, { studentId: "ana", initialQuery: "" }));
  await screen.findByText("Página 1 de 3");
  assert.equal(screen.getAllByRole("listitem").length, 30);
  const next = screen.getByRole("link", { name: "Siguiente" }).getAttribute("href");
  assert.equal(new URLSearchParams(next).get("returnTo"), returnTo);
  await act(async () => router.replace(next));
  await screen.findByText("Página 2 de 3");
  assert.equal(screen.getAllByRole("listitem").length, 30);
  assert.equal(new URLSearchParams(window.location.search).get("page"), "2");
});

test("vista vacía accesible y enlace rápido apuntan al historial individual", async () => {
  window.history.replaceState(null, "", "/alumnos/ana/asistencias");
  globalThis.fetch = async () => ({ ok: true, json: async () => history(database([]), "bm", "ana", all(), "2026-11-02") });
  render(h(View, { studentId: "ana", initialQuery: "" }));
  await screen.findByText("Todavía no hay asistencias registradas para este alumno.");
  assert.equal(screen.getAllByText("Sin registrar").length, 2);
  const quick = readFileSync("componentes/student-quick-panels.tsx", "utf8");
  assert.match(quick, /href=\{studentAttendanceHref\(studentId, returnTo\)\}/);
  assert.doesNotMatch(quick, /href=\{`\/asistencias\?studentId/);
});

test("Alumnos conserva filtros y alumno por URL, restaura Back y no cambia el registro general", () => {
  const source = readFileSync("app/alumnos/page.tsx", "utf8");
  assert.match(source, /Object.entries\(\{ buscar: query, estado: status, plan, servicio: serviceType \}\)/);
  assert.match(source, /window.addEventListener\("popstate", restore\)/);
  assert.match(source, /params.set\("studentId", viewing.id\)/);
  assert.match(source, /setViewing\(items.find/);
  assert.match(source, /window.scrollTo/);
});

test("flujo real de componentes: buscar → ficha → enlace individual → Atrás restaura ficha y filtros", async () => {
  const overrides = { "next/link": { default: Link }, "@/componentes/module-shell": shell };
  for (const [file, name] of Object.entries({
    "student-invitations": "StudentInvitations", "student-health-observations": "StudentHealthObservations",
    "student-access-controls": "StudentAccessControls", "student-account-deletion-requests": "StudentAccountDeletionRequests",
    "admin-quick-log-summary": "AdminQuickLogSummary", "admin-nutrition-summary": "AdminNutritionSummary",
    "student-evaluations": "StudentEvaluations", "student-latest-weight": "StudentLatestWeight", "trainer-floating-actions": "TrainerFloatingActions",
  })) overrides[`@/componentes/${file}`] = { [name]: () => null };
  overrides["@/componentes/icons"] = new Proxy({}, { get: () => () => null });
  overrides["@/componentes/keyboard-dialog"] = { KeyboardDialog: ({ children, ...props }) => { delete props.as; delete props.onClose; return h("section", { role: "dialog", ...props }, children); } };
  overrides["@/componentes/trainer-filters"] = { TrainerFilters: ({ search, filters }) => h("div", null, search, filters.map(filter => h("select", { key: filter.label, "aria-label": filter.label, value: filter.value, onChange: event => filter.change(event.target.value) }, filter.options.map(([value, label]) => h("option", { key: value, value }, label))))) };
  const Page = loader(overrides)("app/alumnos/page.tsx").default;
  const record = { id: "ana", firstName: "Ana", lastName: "Pérez", plan: "2 días", status: "activo", serviceType: "CLASSES", studentType: "Adulto", phone: "12345678", birthDate: "1990-01-01", weight: 70, height: 170, monthlyFee: 30000, dueDate: "2026-12-01", joinedAt: "2021-01-01", goal: "Fuerza", notes: "" };
  HTMLElement.prototype.scrollIntoView = () => {};
  globalThis.fetch = async url => ({ ok: true, json: async () => url === "/api/alumnos" ? [record] : url === "/api/alumnos/opciones" ? { plans: [], schedules: [] } : { panel: "attendance", month: "2026-11", summary: { attended: 1, absent: 0, justified: 0, percentage: 100 }, history: [{ id: "old", date: "2021-01-01", status: "presente", scheduleLabel: "Funcional", scheduleStartTime: "15:45" }] } });
  window.history.replaceState(null, "", "/alumnos?buscar=Ana&estado=activo&servicio=CLASSES&scroll=400");
  const view = render(h(Page));
  await screen.findAllByRole("button", { name: "Ver ficha" });
  assert.equal(screen.getByRole("searchbox", { name: "Buscar alumnos" }).value, "Ana");
  fireEvent.click(screen.getAllByRole("button", { name: "Ver ficha" })[0]);
  await screen.findByRole("dialog", { name: "Ficha de Ana Pérez" });
  fireEvent.click(screen.getByRole("button", { name: /Ver asistencias/ }));
  const link = await screen.findByRole("link", { name: /Ver historial completo/ });
  const href = link.getAttribute("href");
  assert.equal(new URL(href, window.location.origin).pathname, "/alumnos/ana/asistencias");
  link.addEventListener("click", event => event.preventDefault(), { once: true });
  fireEvent.click(link);
  const listUrl = window.location.href;
  assert.equal(new URL(listUrl).searchParams.get("studentId"), "ana");
  view.unmount();
  window.history.pushState(null, "", href);
  await act(async () => { const popped = new Promise(resolve => window.addEventListener("popstate", resolve, { once: true })); window.history.back(); await popped; });
  assert.equal(window.location.href, listUrl);
  render(h(Page));
  await screen.findByRole("dialog", { name: "Ficha de Ana Pérez" });
  assert.equal(screen.getByRole("searchbox", { name: "Buscar alumnos" }).value, "Ana");
  assert.equal(screen.getByRole("combobox", { name: "Estado" }).value, "activo");
  assert.equal(screen.getByRole("combobox", { name: "Servicio" }).value, "CLASSES");
  await screen.findByRole("link", { name: /Ver historial completo/ });
});
