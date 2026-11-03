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
      return load([base + ".ts", base + ".tsx", path.join(base, "index.ts"), path.join(base, "index.tsx"), base].find(existsSync));
    };
    new Function("require", "module", "exports", code)(localRequire, record, record.exports);
    return record.exports;
  }
  return load;
}
const occurrenceTools = { argentinaClock: () => ({ date: "2026-11-03", time: "12:00" }), occurrenceClassName: row => row.classNameSnapshot };
const load = loader({ "@/lib/class-occurrences": occurrenceTools });
const { feedbackInput, CLASS_REACTIONS } = load("lib/class-communication.ts");
const { pendingClassFeedback, submitClassFeedback, reactToConfirmation, classOpinions, feedbackReportFilter, classOpinionsReceivedToday } = load("lib/class-communication-service.ts");
const occurrence = { id: "class-a", workspaceId: "bm", date: new Date("2026-11-03T00:00:00Z"), startTime: "09:00", endTime: "10:00", status: "SCHEDULED", classNameSnapshot: "Funcional", categorySnapshot: "Funcional" };
function attendance(patch = {}) { return { id: "attendance-a", occurrenceId: "class-a", studentId: "a", student: { workspaceId: "bm", data: { firstName: "Ana", lastName: "Pérez" } }, occurrence, response: "GOING", actualAttendance: "PRESENT", updatedAt: new Date("2026-11-03T10:00:00Z"), classRating: null, classComment: null, classFeedbackAt: null, classFeedbackSkippedAt: null, ...patch }; }

function matches(row, where) {
  return Object.entries(where).every(([field, expected]) => {
    if (field === "AND") return expected.every(part => matches(row, part));
    if (field === "OR") return expected.some(part => matches(row, part));
    const actual = row[field];
    if (expected instanceof Date) return actual?.getTime() === expected.getTime();
    if (expected && typeof expected === "object") {
      if ("not" in expected) return actual !== expected.not && (!expected.notIn || !expected.notIn.includes(actual));
      if (["gte", "lte", "lt", "contains"].some(key => key in expected)) return (!Object.hasOwn(expected, "gte") || actual >= expected.gte) && (!Object.hasOwn(expected, "lte") || actual <= expected.lte) && (!Object.hasOwn(expected, "lt") || actual < expected.lt) && (!Object.hasOwn(expected, "contains") || String(actual).toLowerCase().includes(expected.contains.toLowerCase()));
      return actual && matches(actual, expected);
    }
    return actual === expected;
  });
}
function database(rows) {
  const writes = [];
  function scoped(where) {
    assert.ok(where.student?.workspaceId); assert.ok(where.occurrence);
    return rows.filter(row => matches(row, where));
  }
  return { writes, classOccurrenceAttendance: {
    findFirst: async ({ where }) => scoped(where).sort((a, b) => b.occurrence.date - a.occurrence.date)[0] ?? null,
    updateMany: async ({ where, data }) => { const found = scoped(where); for (const row of found) Object.assign(row, data, { updatedAt: data.updatedAt ?? new Date() }); writes.push(data); return { count: found.length }; },
    count: async ({ where }) => scoped(where).length,
    findMany: async ({ where, take, skip, orderBy }) => { assert.equal(take, 30); const rows = scoped(where); if (orderBy?.[0]?.classRating) rows.sort((a,b) => b.classRating.localeCompare(a.classRating)); return rows.slice(skip, skip + take); },
    groupBy: async ({ where }) => {
      const groups = new Map(); for (const row of scoped(where)) { const key = row.occurrenceId + row.classRating; const group = groups.get(key) ?? { occurrenceId: row.occurrenceId, classRating: row.classRating, _count: { _all: 0 } }; group._count._all++; groups.set(key, group); } return [...groups.values()];
    },
  } };
}

test("una clase finalizada con PRESENT invita y acepta una sola valoración incluso ante envíos simultáneos", async () => {
  const row = attendance(); const db = database([row]);
  assert.equal((await pendingClassFeedback(db, "a", "bm")).occurrenceId, "class-a");
  const input = feedbackInput({ occurrenceId: "class-a", rating: "EXCELLENT", comment: "Muy buena clase" });
  assert.deepEqual(await Promise.all([submitClassFeedback(db, "a", "bm", input), submitClassFeedback(db, "a", "bm", input)]), [true, false]);
  assert.equal(row.classRating, "EXCELLENT"); assert.equal(row.classComment, "Muy buena clase");
  assert.equal(await pendingClassFeedback(db, "a", "bm"), null);
  assert.equal(row.actualAttendance, "PRESENT"); assert.equal(row.response, "GOING");
  assert.ok(db.writes.every(write => !Object.hasOwn(write, "actualAttendance") && !Object.hasOwn(write, "response")));
});

for (const [name, patch] of [
  ["ausente", { actualAttendance: "ABSENT" }], ["sólo confirmado", { actualAttendance: "UNKNOWN" }],
  ["cancelada", { occurrence: { ...occurrence, status: "CANCELLED" } }], ["otro alumno", { studentId: "other" }],
  ["otro workspace de clase", { occurrence: { ...occurrence, workspaceId: "foreign" } }],
  ["otro workspace de alumno", { student: { workspaceId: "foreign", data: {} } }],
  ["futura", { occurrence: { ...occurrence, date: new Date("2026-11-04T00:00:00Z") } }],
  ["todavía en curso", { occurrence: { ...occurrence, endTime: "12:01" } }],
]) test(`no permite opinar: ${name}`, async () => {
  const row = attendance(patch); const db = database([row]);
  assert.equal(await pendingClassFeedback(db, "a", "bm"), null);
  assert.equal(await submitClassFeedback(db, "a", "bm", feedbackInput({ occurrenceId: "class-a", rating: "GOOD" })), false);
  assert.equal(row.classFeedbackAt, null);
});

test("Omitir persiste sin valoración y evita repetir la invitación", async () => {
  const row = attendance(); const db = database([row]);
  assert.equal(await submitClassFeedback(db, "a", "bm", feedbackInput({ occurrenceId: "class-a", skip: true })), true);
  assert.ok(row.classFeedbackSkippedAt); assert.equal(row.classRating, null); assert.equal(row.classFeedbackAt, null);
  assert.equal(await pendingClassFeedback(db, "a", "bm"), null);
});

test("opinar no cambia la cronología ni la sesión efectiva de asistencias antiguas sin checkedInAt", async () => {
  const { effectiveSessionForStudentsOnDate, effectiveOccurrenceId } = load("lib/effective-class-session.ts");
  const first = attendance({ checkedInAt: null, updatedAt: new Date("2026-11-03T10:00:00Z") });
  const second = attendance({ id: "second", occurrenceId: "class-b", checkedInAt: null, updatedAt: new Date("2026-11-03T11:00:00Z") });
  const sessions = () => [first, second].map(row => ({ id: row.occurrenceId, date: "2026-11-03", scheduleId: null, startTime: "09:00", responses: [row] }));
  const timestamp = first.updatedAt;
  assert.equal(effectiveOccurrenceId(effectiveSessionForStudentsOnDate(sessions()), "a", "2026-11-03"), "class-b");
  assert.equal(await submitClassFeedback(database([first]), "a", "bm", feedbackInput({ occurrenceId: "class-a", rating: "GOOD" })), true);
  assert.equal(first.updatedAt, timestamp);
  assert.equal(effectiveOccurrenceId(effectiveSessionForStudentsOnDate(sessions()), "a", "2026-11-03"), "class-b");
});

test("las opiniones se agregan por clase real, fecha y workspace y se paginan", async () => {
  const rows = [attendance({ classRating: "EXCELLENT", classFeedbackAt: new Date(), classComment: "Me gustó" }), attendance({ id: "b", studentId: "b", student: { workspaceId: "bm", data: { firstName: "Bruno" } }, classRating: "GOOD", classFeedbackAt: new Date() }), attendance({ id: "foreign", classRating: "IMPROVE", classFeedbackAt: new Date(), occurrence: { ...occurrence, workspaceId: "other" } })];
  const filter = feedbackReportFilter(new URLSearchParams("from=2026-11-01&to=2026-11-03&class=funcional"));
  const result = await classOpinions(database(rows), "bm", filter);
  assert.equal(result.total, 2); assert.equal(result.classes[0].count, 2);
  assert.deepEqual(result.classes[0].distribution, { EXCELLENT: 1, GOOD: 1, IMPROVE: 0 });
  assert.deepEqual(result.classes[0].opinions.map(item => item.studentName), ["Bruno", "Ana Pérez"]);
  assert.equal((await classOpinions(database(rows), "bm", { ...filter, q: "GAP" })).total, 0);
  const many = database(Array.from({ length: 35 }, (_, index) => attendance({ id: String(index), classRating: "GOOD", classFeedbackAt: new Date() })));
  const page = await classOpinions(many, "bm", { ...filter, page: 2 }); assert.equal(page.classes[0].count, 35); assert.equal(page.classes[0].opinions.length, 5);
});

test("validaciones de opinión y filtros rechazan valores no permitidos", () => {
  for (const value of [null, {}, { occurrenceId: "class-a", rating: "OTHER" }, { occurrenceId: "class-a", rating: "GOOD", comment: "x".repeat(1001) }, { occurrenceId: "class-a", rating: "GOOD", comment: {} }]) assert.throws(() => feedbackInput(value));
  for (const value of ["from=2026-02-30", "from=2026-11-04&to=2026-11-03", "page=0", "class=" + "x".repeat(121)]) assert.throws(() => feedbackReportFilter(new URLSearchParams(value)));
});

function reactionDatabase() {
  const notices = new Map(); const writes = [];
  const row = { id: "notice", workspaceId: "bm", type: "CLASS_RESPONSE", studentId: "a", student: { workspaceId: "bm" }, occurrenceId: "class-a", occurrence, response: "NOT_GOING" };
  return { row, notices, writes,
    trainerNotification: { findFirst: async ({ where }) => matches(row, where) ? row : null, update: async ({ data }) => { writes.push(data); Object.assign(row, data); return row; } },
    studentNotification: { upsert: async ({ where, create, update }) => { const found = notices.get(where.eventKey); if (found) Object.assign(found, update); else notices.set(where.eventKey, { ...create, readAt: null }); } },
  };
}
test("reacción por confirmación visible para el alumno correcto; cambiarla actualiza una única notificación sin tocar asistencia", async () => {
  const db = reactionDatabase();
  for (const item of CLASS_REACTIONS) assert.equal((await reactToConfirmation(db, "bm", "notice", item.value)).reaction, item.value);
  assert.equal(db.notices.size, 1); const notice = [...db.notices.values()][0];
  assert.equal(notice.studentId, "a"); assert.equal(notice.type, "FEEDBACK"); assert.equal(notice.url, "/portal/clases");
  assert.match(notice.message, /💪 Nos vemos/); assert.match(notice.message, /inasistencia/);
  assert.equal(db.row.response, "NOT_GOING"); assert.ok(db.writes.every(write => Object.keys(write).sort().join(",") === "reactedAt,reaction"));
  assert.equal(await reactToConfirmation(db, "foreign", "notice", "THANKS"), null);
  db.row.type = "WORKOUT_COMPLETED"; assert.equal(await reactToConfirmation(db, "bm", "notice", "THANKS"), null);
});

test("el centro existente del alumno muestra sólo su reacción actualizada, no la de otro alumno", async () => {
  const db = reactionDatabase(); await reactToConfirmation(db, "bm", "notice", "RECEIVED"); await reactToConfirmation(db, "bm", "notice", "THANKS");
  let studentId = "a";
  const GET = loader({
    "@/lib/prisma": { prisma: { studentNotification: { findMany: async ({ where }) => [...db.notices.values()].filter(row => row.studentId === where.studentId), count: async ({ where }) => [...db.notices.values()].filter(row => row.studentId === where.studentId).length } } },
    "@/lib/portal-auth": { getPortalSession: async () => ({ studentId }) },
  })("app/api/portal/notifications/route.ts").GET;
  const own = await (await GET()).json(); assert.equal(own.notifications.length, 1); assert.match(own.notifications[0].message, /Gracias por avisar/); assert.equal(own.notifications[0].destination, "/portal/clases");
  studentId = "other"; assert.equal((await (await GET()).json()).notifications.length, 0);
});

test("API portal usa identidad de sesión, rechaza origen externo y no confía en studentId/workspace del cuerpo", async () => {
  let session = null; let origin = true; const row = attendance(); const db = database([row]);
  const api = loader({ "@/lib/class-occurrences": occurrenceTools, "@/lib/prisma": { prisma: db }, "@/lib/portal-auth": { getPortalSession: async () => session, validRequestOrigin: () => origin } })("app/api/portal/clases/opiniones/route.ts");
  const request = body => new Request("https://bm.test/api/portal/clases/opiniones", { method: "POST", body: JSON.stringify(body) });
  assert.equal((await api.GET()).status, 401); assert.equal((await api.POST(request({}))).status, 401);
  session = { studentId: "a", credential: { student: { workspaceId: "bm" } } }; origin = false;
  assert.equal((await api.POST(request({}))).status, 403); origin = true;
  assert.equal((await api.POST(request({ occurrenceId: "other", rating: "GOOD", studentId: "other", workspaceId: "foreign" }))).status, 409);
  assert.equal((await api.POST(request({ occurrenceId: "class-a", rating: "GOOD", studentId: "other" }))).status, 200);
  assert.equal(row.classRating, "GOOD"); assert.equal((await api.GET()).headers.get("cache-control"), "private, no-store");
  assert.equal((await (await api.GET()).json()).invitation, null);
});

test("APIs de entrenador requieren autenticación, workspace y origen para reaccionar", async () => {
  let authorized = false; let origin = true; let workspaceId = "bm"; const db = reactionDatabase();
  const overrides = { "@/lib/class-occurrences": occurrenceTools, "@/lib/prisma": { prisma: { ...database([attendance()]), $transaction: async callback => callback(db) } }, "@/lib/admin-api-auth": { requireAdminApiResponse: async () => authorized ? null : Response.json({}, { status: 401 }) }, "@/lib/trainer-workspace": { requireTrainerWorkspace: async () => ({ workspaceId }) }, "@/lib/portal-auth": { validRequestOrigin: () => origin } };
  const local = loader(overrides); const reaction = local("app/api/admin/notifications/[id]/reaction/route.ts"); const report = local("app/api/clases/opiniones/route.ts");
  const request = value => new Request("https://bm.test/api/admin/notifications/notice/reaction", { method: "PUT", body: JSON.stringify({ reaction: value }) }); const context = { params: Promise.resolve({ id: "notice" }) };
  assert.equal((await reaction.PUT(request("THANKS"), context)).status, 401); assert.equal((await report.GET(new Request("https://bm.test/api/clases/opiniones"))).status, 401);
  authorized = true; origin = false; assert.equal((await reaction.PUT(request("THANKS"), context)).status, 403); origin = true;
  assert.equal((await reaction.PUT(request("OTHER"), context)).status, 400);
  workspaceId = "foreign"; assert.equal((await reaction.PUT(request("THANKS"), context)).status, 404);
  workspaceId = "bm"; assert.equal((await reaction.PUT(request("THANKS"), context)).status, 200);
  assert.equal((await report.GET(new Request("https://bm.test/api/clases/opiniones?from=bad"))).status, 400);
});

test("migración aditiva en PostgreSQL en memoria: conserva asistencia y valida rating/reacción y unicidad existente", async () => {
  const { PGlite } = await import("@electric-sql/pglite"); const db = new PGlite();
  try {
    await db.exec('CREATE TABLE trainer_notifications (id TEXT PRIMARY KEY); CREATE TABLE class_occurrence_attendances (id TEXT PRIMARY KEY, "occurrenceId" TEXT NOT NULL, "studentId" TEXT NOT NULL, "actualAttendance" TEXT NOT NULL, UNIQUE("occurrenceId", "studentId")); INSERT INTO trainer_notifications VALUES (\'n\'); INSERT INTO class_occurrence_attendances VALUES (\'a\', \'c\', \'s\', \'PRESENT\');');
    await db.exec(readFileSync("prisma/migrations/20261103190000_class_communication/migration.sql", "utf8"));
    const result = await db.query('SELECT "actualAttendance", "classRating", "classFeedbackAt" FROM class_occurrence_attendances');
    assert.deepEqual(result.rows[0], { actualAttendance: "PRESENT", classRating: null, classFeedbackAt: null });
    await assert.rejects(() => db.exec('UPDATE trainer_notifications SET reaction = \'INVALID\''));
    await assert.rejects(() => db.exec('UPDATE class_occurrence_attendances SET "classRating" = \'INVALID\''));
    await assert.rejects(() => db.exec('INSERT INTO class_occurrence_attendances (id,"occurrenceId","studentId","actualAttendance") VALUES (\'b\',\'c\',\'s\',\'PRESENT\')'));
    await db.exec('UPDATE class_occurrence_attendances SET "classRating" = \'GOOD\', "classFeedbackAt" = NOW()');
    assert.equal((await db.query('SELECT "actualAttendance" FROM class_occurrence_attendances')).rows[0].actualAttendance, "PRESENT");
  } finally { await db.close(); }
});

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://bm.test/portal/clases", pretendToBeVisual: true });
for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "HTMLInputElement", "Event", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"]) Object.defineProperty(globalThis, key, { configurable: true, value: ["getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"].includes(key) ? dom.window[key].bind(dom.window) : dom.window[key] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = require("react"); const h = React.createElement;
const { render, screen, fireEvent, cleanup, waitFor } = require("@testing-library/react");
const originalFetch = globalThis.fetch; afterEach(() => { cleanup(); globalThis.fetch = originalFetch; });
const ui = loader({ "@/componentes/module-shell": { inputClass: "input" } });
const Reactions = ui("componentes/class-confirmation-reactions.tsx").ClassConfirmationReactions;
const Invitation = ui("componentes/class-feedback-invitation.tsx").ClassFeedbackInvitation;
const Panel = ui("componentes/class-opinions-panel.tsx").ClassOpinionsPanel;

test("reacciones UI editables mediante botones accesibles sin abrir otra notificación", async () => {
  const calls = []; globalThis.fetch = async (url, options) => { calls.push({ url, body: JSON.parse(options.body) }); return { ok: true, json: async () => JSON.parse(options.body) }; };
  function View() { const [reaction, setReaction] = React.useState(null); return h(Reactions, { notificationId: "notice", reaction, onChange: setReaction }); }
  render(h(View)); fireEvent.click(screen.getByRole("button", { name: "👍 Recibido" }));
  await waitFor(() => assert.equal(screen.getByRole("button", { name: "👍 Recibido" }).getAttribute("aria-pressed"), "true"));
  fireEvent.click(screen.getByRole("button", { name: "🙌 Gracias por avisar" }));
  await waitFor(() => assert.equal(screen.getByRole("button", { name: "🙌 Gracias por avisar" }).getAttribute("aria-pressed"), "true"));
  assert.equal(calls.length, 2); assert.ok(calls.every(call => call.url === "/api/admin/notifications/notice/reaction"));
});

for (const width of [390, 1280]) test(`${width}px opinión opcional privada, comentario y envío; no vuelve a solicitar la respuesta`, async () => {
  window.innerWidth = width; const row = attendance(); const db = database([row]);
  globalThis.fetch = async (_url, options = {}) => {
    if (options.method === "POST") { const ok = await submitClassFeedback(db, "a", "bm", feedbackInput(JSON.parse(options.body))); return { ok, json: async () => ({ ok }) }; }
    return { ok: true, json: async () => ({ invitation: await pendingClassFeedback(db, "a", "bm") }) };
  };
  const view = render(h(Invitation)); await screen.findByRole("region", { name: "Opinión de tu clase" });
  assert.ok(screen.getByText(/sólo tu entrenador puede verla e identificar/));
  fireEvent.click(screen.getByRole("button", { name: "🔥 Excelente" })); fireEvent.change(screen.getByLabelText("Comentario (opcional)"), { target: { value: "Muy clara la explicación" } }); fireEvent.click(screen.getByRole("button", { name: "Enviar opinión" }));
  await screen.findByText("Gracias por compartir tu opinión."); assert.equal(row.classRating, "EXCELLENT"); assert.equal(row.classComment, "Muy clara la explicación");
  view.unmount(); render(h(Invitation)); await waitFor(() => assert.ok(screen.queryByRole("region", { name: "Opinión de tu clase" }) === null));
});

test("Omitir en el portal no exige seleccionar valoración ni cambia la asistencia", async () => {
  const row = attendance(); const db = database([row]); globalThis.fetch = async (_url, options = {}) => {
    if (options.method === "POST") return { ok: await submitClassFeedback(db, "a", "bm", feedbackInput(JSON.parse(options.body))), json: async () => ({ ok: true }) };
    return { ok: true, json: async () => ({ invitation: await pendingClassFeedback(db, "a", "bm") }) };
  };
  render(h(Invitation)); await screen.findByRole("button", { name: "Omitir" }); fireEvent.click(screen.getByRole("button", { name: "Omitir" }));
  await waitFor(() => assert.ok(row.classFeedbackSkippedAt)); assert.equal(row.classRating, null); assert.equal(row.actualAttendance, "PRESENT");
});

test("una invitación respondida en otro dispositivo se retira si el envío devuelve 409", async () => {
  let answered = false;
  globalThis.fetch = async (_url, options = {}) => options.method === "POST" ? (answered = true, { status: 409, ok: false, json: async () => ({ error: "Ya respondiste" }) }) : { ok: true, json: async () => ({ invitation: answered ? null : { occurrenceId: occurrence.id, date: "2026-11-03", className: "Funcional", startTime: "09:00", endTime: "10:00" } }) };
  render(h(Invitation)); await screen.findByRole("button", { name: "💪 Buena" }); fireEvent.click(screen.getByRole("button", { name: "💪 Buena" })); fireEvent.click(screen.getByRole("button", { name: "Enviar opinión" }));
  await waitFor(() => assert.ok(screen.queryByRole("region", { name: "Opinión de tu clase" }) === null));
});

for (const width of [390, 1280]) test(`${width}px panel de Clases muestra distribución/comentarios y filtra por fecha/clase`, async () => {
  window.innerWidth = width;
  const db = database([attendance({ classRating: "EXCELLENT", classFeedbackAt: new Date(), classComment: "Excelente ambiente" })]);
  const requests = []; globalThis.fetch = async url => { requests.push(url); return { ok: true, json: async () => classOpinions(db, "bm", feedbackReportFilter(new URL(url, window.location.origin).searchParams)) }; };
  render(h(Panel)); fireEvent.click(screen.getByText("Opiniones"));
  await screen.findByText("Excelente ambiente"); assert.ok(screen.getByText(/Ana Pérez/)); assert.ok(screen.getByText("🔥 Excelente: 1"));
  fireEvent.change(screen.getByLabelText("Clase"), { target: { value: "GAP" } }); fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-11-01" } }); fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-11-03" } });
  fireEvent.submit(screen.getByRole("button", { name: "Aplicar filtros" }).closest("form")); await screen.findByText("Todavía no hay opiniones para estos filtros.");
  assert.ok(requests.at(-1).includes("class=GAP"));
});


test("filtros rápidos mantienen resumen completo y priorizan A mejorar antes de paginar", async () => {
 const rows = Array.from({length: 32}, (_, i) => attendance({id: String(i), classRating: i === 31 ? "IMPROVE" : "EXCELLENT", classComment: i === 31 ? "Cambiar ritmo" : "", classFeedbackAt: new Date("2026-11-03T15:00:00Z")}));
 const filter = feedbackReportFilter(new URLSearchParams());
 const all = await classOpinions(database(rows), "bm", filter);
 assert.equal(all.total, 32); assert.equal(all.classes[0].opinions[0].rating, "IMPROVE");
 for (const quick of ["improve", "comments"]) {
  const report = await classOpinions(database(rows), "bm", {...filter, quick});
  assert.equal(report.total, 1); assert.equal(report.classes[0].count, 32); assert.equal(report.classes[0].opinions[0].id, "31");
 }
 assert.throws(() => feedbackReportFilter(new URLSearchParams("quick=invalid")));
});

test("recepción hoy usa límites argentinos y aísla workspaces, incluso para clases anteriores", async () => {
 const row = (id, at, patch={}) => attendance({id, classRating: "IMPROVE", classFeedbackAt: new Date(at), occurrence: {...occurrence, date: new Date("2026-10-01T00:00:00Z")}, ...patch});
 const db = database([row("before", "2026-11-03T02:59:59Z"), row("first", "2026-11-03T03:00:00Z"), row("last", "2026-11-04T02:59:59Z", {classRating:"GOOD"}), row("after", "2026-11-04T03:00:00Z"), row("foreign", "2026-11-03T15:00:00Z", {student: {workspaceId:"other",data:{}}})]);
 assert.deepEqual(await classOpinionsReceivedToday(db, "bm"), {total:2, improve:1});
 const report = await classOpinions(db, "bm", feedbackReportFilter(new URLSearchParams("receivedOn=2026-11-03")));
 assert.equal(report.total,2); assert.equal(report.classes[0].date,"2026-10-01");
});


test("filtros rápidos son accesibles y el enlace del dashboard abre Opiniones recibidas hoy", async () => {
 const requests=[];
 window.history.replaceState({}, "", "/clases?opiniones=hoy#opiniones");
 globalThis.fetch = async url => {requests.push(url);return {ok:true,json:async()=>({total:0,page:1,pages:1,classes:[]})};};
 render(h(Panel));
 await screen.findByRole("button", {name:"Con comentarios"});
 await waitFor(()=>assert.ok(requests.length));
 assert.ok(requests[0].includes("receivedOn="));
 fireEvent.click(screen.getByRole("button", {name:"A mejorar",exact:true}));
 await waitFor(()=>assert.ok(requests.at(-1).includes("quick=improve")));
 assert.equal(screen.getByRole("button", {name:"A mejorar",exact:true}).getAttribute("aria-pressed"),"true");
 fireEvent.click(screen.getByRole("button", {name:"Con comentarios"}));
 await waitFor(()=>assert.ok(requests.at(-1).includes("quick=comments")));
 fireEvent.click(screen.getByRole("button", {name:"Todas"}));
 await waitFor(()=>assert.ok(requests.at(-1).includes("quick=all")));
 window.history.replaceState({}, "", "/");
});


for (const skip of [false, true]) test(`persistencia al recargar después de ${skip ? "Omitir" : "enviar"}, incluso con actualización simultánea de asistencia`, async () => {
 const row = attendance(); const other = attendance({id:"other-attendance",occurrenceId:"other-class",occurrence:{...occurrence,id:"other-class",date:new Date("2026-11-02T00:00:00Z")}});
 const db = database([row, other]); const update = db.classOccurrenceAttendance.updateMany;
 let conflict = true;
 db.classOccurrenceAttendance.updateMany = async args => {if (conflict) {conflict=false; row.updatedAt=new Date("2026-11-03T11:00:00Z"); return {count:0};} return update(args);};
 const api = loader({"@/lib/class-occurrences":occurrenceTools,"@/lib/prisma":{prisma:db},"@/lib/portal-auth":{getPortalSession:async()=>({studentId:"a",credential:{student:{workspaceId:"bm"}}}),validRequestOrigin:()=>true}})("app/api/portal/clases/opiniones/route.ts");
 let reads=0;
 globalThis.fetch=async (_url, options={})=> {if(options.method==="POST") return api.POST(new Request("https://bm.test/api/portal/clases/opiniones",options)); const response=await api.GET();reads++;return response;};
 const view=render(h(Invitation)); await screen.findByRole("button",{name:"Omitir"});
 if (!skip) fireEvent.click(screen.getByRole("button",{name:"💪 Buena"}));
 fireEvent.click(screen.getByRole("button",{name:skip?"Omitir":"Enviar opinión"}));
 await waitFor(()=>assert.ok(skip?row.classFeedbackSkippedAt:row.classFeedbackAt));
 await waitFor(()=>assert.ok(screen.queryByRole("region",{name:"Opinión de tu clase"}) === null));
 assert.equal(row.updatedAt.toISOString(),"2026-11-03T11:00:00.000Z");
 view.unmount(); const before=reads; render(h(Invitation));
 await waitFor(()=>assert.ok(reads>before));
 await screen.findByRole("region",{name:"Opinión de tu clase"});
 assert.equal((await (await api.GET()).json()).invitation.occurrenceId,"other-class");
 assert.ok(screen.getByText(/2\/11\/2026/));
});


test("un 409 sin decisión persistida no oculta falsamente la invitación", async () => {
 globalThis.fetch=async (_url, options={})=>options.method==="POST"?{status:409,ok:false,json:async()=>({})}:{ok:true,json:async()=>({invitation:{occurrenceId:occurrence.id,date:"2026-11-03",className:"Funcional",startTime:"09:00",endTime:"10:00"}})};
 render(h(Invitation)); await screen.findByRole("button",{name:"Omitir"}); fireEvent.click(screen.getByRole("button",{name:"Omitir"}));
 await screen.findByText("Tu respuesta no se guardó. Volvé a intentar.");
 assert.ok(screen.getByRole("region",{name:"Opinión de tu clase"}));
});
