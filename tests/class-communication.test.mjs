import assert from "node:assert/strict";
import { afterEach, test, mock } from "node:test";
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
const fixedNow = new Date("2026-11-03T15:00:00Z");
mock.timers.enable({ apis: ["Date"], now: fixedNow });
afterEach(() => mock.timers.setTime(fixedNow.getTime()));
const occurrenceTools = { argentinaClock: (date = new Date()) => { const local = new Date(date.getTime() - 3 * 60 * 60 * 1000).toISOString(); return {date: local.slice(0,10), time: local.slice(11,16)}; }, occurrenceClassName: row => row.classNameSnapshot };
const load = loader({ "@/lib/class-occurrences": occurrenceTools });
const { feedbackInput, CLASS_REACTIONS } = load("lib/class-communication.ts");
const { availableClassFeedback, submitClassFeedback, reactToConfirmation, classOpinions, feedbackReportFilter, classOpinionsReceivedToday } = load("lib/class-communication-service.ts");
const pendingClassFeedback = async (...args) => (await availableClassFeedback(...args))[0] ?? null;
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
      if ("notIn" in expected) return !expected.notIn.includes(actual);
      if ("in" in expected) return expected.in.includes(actual);
      if (["gte", "lte", "lt", "gt", "contains"].some(key => key in expected)) return (!Object.hasOwn(expected, "gt") || actual > expected.gt) && (!Object.hasOwn(expected, "gte") || actual >= expected.gte) && (!Object.hasOwn(expected, "lte") || actual <= expected.lte) && (!Object.hasOwn(expected, "lt") || actual < expected.lt) && (!Object.hasOwn(expected, "contains") || String(actual).toLowerCase().includes(expected.contains.toLowerCase()));
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
    findMany: async ({ where, take, skip, orderBy }) => { const rows = scoped(where); if (orderBy?.[0]?.classRating) rows.sort((a,b) => b.classRating.localeCompare(a.classRating)); return take ? rows.slice(skip, skip + take) : rows; },
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

test("validaciones de opinión y filtros rechazan valores no permitidos", () => {
  for (const value of [null, {}, { occurrenceId: "class-a", rating: "OTHER" }, { occurrenceId: "class-a", rating: "GOOD", comment: "x".repeat(1001) }, { occurrenceId: "class-a", rating: "GOOD", comment: {} }]) assert.throws(() => feedbackInput(value));
  for (const value of ["from=2026-02-30", "from=2026-11-04&to=2026-11-03", "page=0", "class=" + "x".repeat(121)]) assert.throws(() => feedbackReportFilter(new URLSearchParams(value)));
});

function reactionDatabase() {
  const notices = new Map(); const writes = [];
  const row = { id: "notice", workspaceId: "bm", type: "CLASS_RESPONSE", studentId: "a", student: { workspaceId: "bm" }, occurrenceId: "class-a", occurrence, response: "NOT_GOING", readAt: null };
  return { row, notices, writes,
    trainerNotification: { count: async ({ where }) => matches(row, where) ? 1 : 0, findFirst: async ({ where }) => matches(row, where) ? row : null, update: async ({ data }) => { writes.push(data); Object.assign(row, data); return row; } },
    studentNotification: { upsert: async ({ where, create, update }) => { const found = notices.get(where.eventKey); if (found) Object.assign(found, update); else notices.set(where.eventKey, { ...create, readAt: null }); } },
  };
}
test("reacción por confirmación visible para el alumno correcto; cambiarla actualiza una única notificación sin tocar asistencia", async () => {
  const db = reactionDatabase();
  for (const item of CLASS_REACTIONS) assert.equal((await reactToConfirmation(db, "bm", "notice", item.value)).reaction, item.value);
  assert.equal(db.notices.size, 1); const notice = [...db.notices.values()][0];
  assert.equal(notice.studentId, "a"); assert.equal(notice.type, "FEEDBACK"); assert.equal(notice.url, "/portal/clases");
  assert.match(notice.message, /💪 Nos vemos/); assert.match(notice.message, /inasistencia/);
  assert.equal(db.row.response, "NOT_GOING"); assert.ok(db.writes.every(write => Object.keys(write).sort().join(",") === "reactedAt,reaction,readAt"));
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
  session = { studentId: "a", credential: { student: { workspaceId: "bm", serviceType: "CLASSES" } } }; origin = false;
  assert.equal((await api.POST(request({}))).status, 403); origin = true;
  session.credential.student.serviceType = "PERSONALIZED";
  assert.equal((await api.GET()).status, 403);
  assert.equal((await api.POST(request({ occurrenceId:"class-a", rating:"GOOD" }))).status,403);
  session.credential.student.serviceType = "MIXED";
  assert.equal((await api.POST(request({ occurrenceId: "other", rating: "GOOD", studentId: "other", workspaceId: "foreign" }))).status, 409);
  assert.equal((await api.POST(request({ occurrenceId: "class-a", rating: "GOOD", studentId: "other" }))).status, 200);
  assert.equal(row.classRating, "GOOD"); assert.equal((await api.GET()).headers.get("cache-control"), "private, no-store");
  assert.deepEqual((await (await api.GET()).json()).classes, []);
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
const { render, screen, fireEvent, cleanup, waitFor, act } = require("@testing-library/react");
const originalFetch = globalThis.fetch; afterEach(() => { cleanup(); globalThis.fetch = originalFetch; });
const ui = loader({ "@/componentes/module-shell": { inputClass: "input" } });
const Reactions = ui("componentes/class-confirmation-reactions.tsx").ClassConfirmationReactions;
const Invitation = ui("componentes/class-feedback-invitation.tsx").ClassFeedbackInvitation;
const Panel = ui("componentes/class-opinions-panel.tsx").ClassOpinionsPanel;

for (const width of [390, 1280]) test(`${width}px reacciones UI editables mediante botones accesibles sin abrir otra notificación`, async () => {
  window.innerWidth = width;
  const calls = []; globalThis.fetch = async (url, options) => { calls.push({ url, body: JSON.parse(options.body) }); return { ok: true, json: async () => ({...JSON.parse(options.body), readAt: new Date().toISOString(), unreadCount: 0}) }; };
  function View() { const [reaction, setReaction] = React.useState(null); return h(Reactions, { notificationId: "notice", reaction, onChange: setReaction }); }
  render(h(View)); fireEvent.click(screen.getByRole("button", { name: "👍 Recibido" }));
  await waitFor(() => assert.equal(screen.getByRole("button", { name: "👍 Recibido" }).getAttribute("aria-pressed"), "true"));
  fireEvent.click(screen.getByRole("button", { name: "🙌 Gracias" }));
  await waitFor(() => assert.equal(screen.getByRole("button", { name: "🙌 Gracias" }).getAttribute("aria-pressed"), "true"));
  assert.equal(calls.length, 2); assert.ok(calls.every(call => call.url === "/api/admin/notifications/notice/reaction"));
});

test("la opinión sólo se abre al tocar Dejar opinión, permite elegir una clase propia y se guarda una vez", async () => {
  const first = attendance();
  const second = attendance({ id:"attendance-b", occurrenceId:"class-b", occurrence:{...occurrence,id:"class-b",startTime:"10:00",endTime:"11:00"} });
  const foreign = attendance({ id:"attendance-c", occurrenceId:"class-c", studentId:"b" });
  const db = database([first, second, foreign]);
  let reads = 0, posts = 0;
  globalThis.fetch = async (_url, options = {}) => {
    if (options.method === "POST") {
      posts++;
      const ok = await submitClassFeedback(db, "a", "bm", feedbackInput(JSON.parse(options.body)));
      return { ok, json: async () => ({ ok }) };
    }
    reads++;
    return { ok:true, json:async () => ({ classes:await availableClassFeedback(db,"a","bm") }) };
  };
  const view = render(h(Invitation));
  window.dispatchEvent(new Event("focus"));
  assert.equal(reads,0);
  assert.equal(screen.queryByRole("region",{name:"Opinión de tu clase"}),null);
  fireEvent.click(screen.getByRole("button",{name:"Dejar opinión"}));
  const selector = await screen.findByRole("combobox",{name:"Clase realizada"});
  assert.equal(selector.options.length,2);
  fireEvent.change(selector,{target:{value:"class-b"}});
  fireEvent.click(screen.getByRole("button",{name:"🔥 Excelente"}));
  fireEvent.change(screen.getByLabelText("Comentario (opcional)"),{target:{value:"Muy buena"}});
  const button=screen.getByRole("button",{name:"Enviar opinión"});
  fireEvent.click(button);
  fireEvent.click(button);
  await screen.findByText("Gracias por compartir tu opinión.");
  assert.equal(posts,1);
  assert.equal(second.classComment,"Muy buena");
  assert.equal(first.classFeedbackAt,null);
  assert.equal(foreign.classFeedbackAt,null);
  view.unmount();
  render(h(Invitation));
  assert.equal(reads,1);
  assert.equal(screen.queryByRole("region",{name:"Opinión de tu clase"}),null);
});

test("Cerrar no guarda ni descarta definitivamente la opinión", async () => {
  const row=attendance(); const db=database([row]);
  globalThis.fetch = async (_url, options = {}) => {
    assert.notEqual(options.method,"POST");
    return {ok:true,json:async()=>({classes:await availableClassFeedback(db,"a","bm")})};
  };
  render(h(Invitation));
  fireEvent.click(screen.getByRole("button",{name:"Dejar opinión"}));
  await screen.findByRole("button",{name:"Enviar opinión"});
  fireEvent.click(screen.getByRole("button",{name:"Cerrar"}));
  assert.equal(screen.queryByRole("region",{name:"Opinión de tu clase"}),null);
  assert.equal(row.classFeedbackSkippedAt,null);
  assert.equal(row.actualAttendance,"PRESENT");
});

test("recepción hoy usa límites argentinos y aísla workspaces, incluso para clases anteriores", async () => {
 const row = (id, at, patch={}) => attendance({id, classRating: "IMPROVE", classFeedbackAt: new Date(at), occurrence: {...occurrence, date: new Date("2026-10-01T00:00:00Z")}, ...patch});
 const db = database([row("before", "2026-11-03T02:59:59Z"), row("first", "2026-11-03T03:00:00Z"), row("last", "2026-11-04T02:59:59Z", {classRating:"GOOD"}), row("after", "2026-11-04T03:00:00Z"), row("foreign", "2026-11-03T15:00:00Z", {student: {workspaceId:"other",data:{}}})]);
 assert.deepEqual(await classOpinionsReceivedToday(db, "bm"), {total:2, improve:1});
 const report = await classOpinions(db, "bm", feedbackReportFilter(new URLSearchParams("receivedOn=2026-11-03")));
 assert.equal(report.total,2); assert.equal(report.comments.length,0);
});


test("si el servidor ya no admite la clase se muestra su mensaje sin confirmar una respuesta", async () => {
  globalThis.fetch=async (_url, options = {}) => options.method === "POST"
    ? {status:409,ok:false,json:async()=>({error:"La clase no está disponible."})}
    : {ok:true,json:async()=>({classes:[{occurrenceId:occurrence.id,date:"2026-11-03",className:"Funcional",startTime:"09:00",endTime:"10:00"}]})};
  render(h(Invitation));
  fireEvent.click(screen.getByRole("button",{name:"Dejar opinión"}));
  fireEvent.click(await screen.findByRole("button",{name:"💪 Buena"}));
  fireEvent.click(screen.getByRole("button",{name:"Enviar opinión"}));
  await screen.findByText("La clase no está disponible.");
  assert.equal(screen.queryByText("Gracias por compartir tu opinión."),null);
});

for (const [label, now, date, startTime, endTime, actualAttendance, status, allowed] of [
 ["futura", "2026-11-03T15:00:00Z", "2026-11-04", "09:00", "10:00", "PRESENT", "SCHEDULED", false],
 ["en curso", "2026-11-03T12:30:00Z", "2026-11-03", "09:00", "10:00", "PRESENT", "SCHEDULED", false],
 ["confirmada sin PRESENT", "2026-11-03T15:00:00Z", "2026-11-03", "09:00", "10:00", "UNKNOWN", "SCHEDULED", false],
 ["finalizada presente", "2026-11-03T15:00:00Z", "2026-11-03", "09:00", "10:00", "PRESENT", "SCHEDULED", true],
 ["instante finalización", "2026-11-03T13:00:00Z", "2026-11-03", "09:00", "10:00", "PRESENT", "SCHEDULED", true],
 ["23h59m59s999", "2026-11-04T12:59:59.999Z", "2026-11-03", "09:00", "10:00", "PRESENT", "SCHEDULED", true],
 ["24h exactas", "2026-11-04T13:00:00Z", "2026-11-03", "09:00", "10:00", "PRESENT", "SCHEDULED", false],
 ["7 días", "2026-11-10T13:00:00Z", "2026-11-03", "09:00", "10:00", "PRESENT", "SCHEDULED", false],
 ["cruce de medianoche UTC", "2026-11-04T02:30:00Z", "2026-11-03", "22:00", "23:00", "PRESENT", "SCHEDULED", true],
 ["medianoche argentina", "2026-11-04T03:01:00Z", "2026-11-03", "22:00", "23:00", "PRESENT", "SCHEDULED", true],
 ["cancelada", "2026-11-03T15:00:00Z", "2026-11-03", "09:00", "10:00", "PRESENT", "CANCELLED", false],
 ["sin fin fiable", "2026-11-03T15:00:00Z", "2026-11-03", "09:00", "", "PRESENT", "SCHEDULED", false],
 ["fin inválido", "2026-11-03T15:00:00Z", "2026-11-03", "09:00", "10:99", "PRESENT", "SCHEDULED", false],
 ["fin anterior al inicio", "2026-11-03T15:00:00Z", "2026-11-03", "09:00", "08:00", "PRESENT", "SCHEDULED", false],
]) test(`plazo 24h: ${label}, misma regla GET y POST para enviar y omitir`, async () => {
 mock.timers.setTime(new Date(now).getTime());
 for (const skip of [false,true]) {
  const row = attendance({actualAttendance, occurrence:{...occurrence,date:new Date(date+"T00:00:00Z"),startTime,endTime,status}}); const db=database([row]);
  const api=loader({"@/lib/class-occurrences":occurrenceTools,"@/lib/prisma":{prisma:db},"@/lib/portal-auth":{getPortalSession:async()=>({studentId:"a",credential:{student:{workspaceId:"bm",serviceType:"CLASSES"}}}),validRequestOrigin:()=>true}})("app/api/portal/clases/opiniones/route.ts");
  const invitation=(await (await api.GET()).json()).classes[0];
  assert.equal(Boolean(invitation),allowed);
  if(invitation) assert.equal(invitation.endTime,endTime);
  const result=await api.POST(new Request("https://bm.test/api/portal/clases/opiniones",{method:"POST",body:JSON.stringify({occurrenceId:"class-a",rating:"GOOD",skip})}));
  assert.equal(result.status,allowed?200:409);
  if(!allowed) assert.equal(db.writes.length,0);
  else assert.deepEqual((await (await api.GET()).json()).classes,[]);
 }
});

test('reaccionar marca únicamente la confirmación como leída y cambiarla conserva el timestamp',async()=>{
 const db=reactionDatabase();const result=await reactToConfirmation(db,'bm','notice','RECEIVED');
 assert.equal(result.unreadCount,0);assert.ok(result.readAt);assert.equal(db.row.readAt.toISOString(),result.readAt);
 const original=db.row.readAt;await reactToConfirmation(db,'bm','notice','THANKS');assert.equal(db.row.readAt,original);assert.equal(db.notices.size,1);
 const old=new Date('2026-11-01T12:00:00Z');db.row.readAt=old;await reactToConfirmation(db,'bm','notice','SEE_YOU');assert.equal(db.row.readAt,old);
 const writes=db.writes.length;assert.equal(await reactToConfirmation(db,'foreign','notice','THANKS'),null);assert.equal(db.writes.length,writes);
});
test('la UI confirma lectura sólo después del servidor y mantiene reacción ante un rechazo',async()=>{
 const receipts=[];globalThis.fetch=async()=>({ok:false,json:async()=>({error:'Operación rechazada'})});
 render(h(Reactions,{notificationId:'notice',reaction:'RECEIVED',onChange:(...args)=>receipts.push(args)}));
 fireEvent.click(screen.getByRole('button',{name:'🙌 Gracias'}));await screen.findByText('Operación rechazada');assert.equal(receipts.length,0);assert.equal(screen.getByRole('button',{name:'👍 Recibido'}).getAttribute('aria-pressed'),'true');
 globalThis.fetch=async()=>({ok:true,json:async()=>({reaction:'THANKS',readAt:'2026-11-04T15:00:00Z',unreadCount:2})});
 fireEvent.click(screen.getByRole('button',{name:'🙌 Gracias'}));await waitFor(()=>assert.equal(receipts.length,1));assert.deepEqual(receipts[0],['THANKS',{readAt:'2026-11-04T15:00:00Z',unreadCount:2}]);
});


test('centro actualiza contador y lectura tras reaccionar; una consulta anterior no revierte el estado',async()=>{
 const Center=loader({'next/navigation':{usePathname:()=>'/dashboard',useRouter:()=>({push:()=>{}})}})('componentes/admin-notification-center.tsx').AdminNotificationCenter;
 const notice={id:'notice',type:'CLASS_RESPONSE',title:'Asistencia confirmada',message:'Ana confirmó',url:'/clases',response:'GOING',studentId:'a',occurrenceId:'class-a',readAt:null,createdAt:'2026-11-03T10:00:00Z',reaction:null};
 const other={...notice,id:'other',type:'OTHER',title:'Otra notificación',studentId:null,occurrenceId:null};let list=[notice,other],count=2;let stale;
 let hold=false;
 globalThis.fetch=async (_url,options={})=>{
  if(options.method==='PUT'){list=[{...notice,reaction:'THANKS',readAt:'2026-11-03T15:00:00Z'},other];count=1;return{ok:true,json:async()=>({reaction:'THANKS',readAt:'2026-11-03T15:00:00Z',unreadCount:1})};}
  if(hold){hold=false;return new Promise(resolve=>stale=()=>resolve({ok:true,json:async()=>({notifications:[notice,other],unreadCount:2})}));}
  return{ok:true,json:async()=>({notifications:list,unreadCount:count})};
 };
 render(h(Center));const trigger=await screen.findByRole('button',{name:'Notificaciones, 2 sin leer'});fireEvent.click(trigger);
 await screen.findByText('🙌 Gracias');
 hold=true;fireEvent.focus(window);await waitFor(()=>assert.ok(stale));
 fireEvent.click(screen.getByText('🙌 Gracias'));
 await screen.findByRole('button',{name:'Notificaciones, 1 sin leer'});
 assert.equal(screen.getByText('🙌 Gracias').getAttribute('aria-pressed'),'true');
 await act(async()=>{stale();await new Promise(resolve=>setTimeout(resolve,30));});assert.ok(screen.getByRole('button',{name:'Notificaciones, 1 sin leer'}));assert.equal(other.readAt,null);
});


for (const size of [30,100,300]) test('resumen global con '+size+' opiniones; sólo comentarios y paginación independiente',async()=>{
 const rows=Array.from({length:size},(_,i)=>attendance({id:'opinion-'+i,classRating:['EXCELLENT','GOOD','IMPROVE'][i%3],classComment:i%2===0?'Comentario '+i:'',classFeedbackAt:new Date()}));
 const foreign=attendance({id:'foreign',student:{workspaceId:'other',data:{}},classRating:'IMPROVE',classComment:'No visible',classFeedbackAt:new Date()});
 const db=database([...rows,foreign]);const filter=feedbackReportFilter(new URLSearchParams('class=funcional'));
 const report=await classOpinions(db,'bm',filter);
 const improve=rows.filter(row=>row.classRating==='IMPROVE'&&row.classComment);
 assert.equal(report.total,size);assert.deepEqual(report.distribution,{EXCELLENT:Math.ceil(size/3),GOOD:Math.floor((size+1)/3),IMPROVE:Math.floor(size/3)});assert.equal(report.commentTotal,improve.length);assert.equal(report.comments.length,Math.min(30,improve.length));assert.ok(report.comments.every(row=>row.rating==='IMPROVE'&&row.comment));assert.equal(JSON.stringify(report).includes('Ana Pérez'),false);
 const second=await classOpinions(db,'bm',{...filter,page:2});assert.equal(second.total,size);assert.deepEqual(second.distribution,report.distribution);assert.ok(second.comments.length<=30);assert.equal(second.page,Math.min(2,report.pages));
 if(report.pages>1)assert.ok(!second.comments.some(row=>report.comments.some(first=>first.id===row.id)));
 const positive=await classOpinions(db,'bm',{...filter,comments:'positive'});assert.equal(positive.total,size);assert.equal(positive.commentTotal,rows.filter(row=>row.classRating!=='IMPROVE'&&row.classComment).length);assert.ok(positive.comments.every(row=>['GOOD','EXCELLENT'].includes(row.rating)&&row.comment));
 assert.equal((await classOpinions(db,'bm',{...filter,q:'GAP'})).total,0);assert.equal((await classOpinions(db,'bm',{...filter,from:'2026-10-01',to:'2026-10-31'})).total,0);
 assert.throws(()=>feedbackReportFilter(new URLSearchParams('comments=invalid')));
});
for(const width of [390,1280])for(const theme of ['light','dark'])test(width+'px '+theme+': opiniones simplificadas sin filtros ni paginación visible',async()=>{
 window.innerWidth=width;document.documentElement.dataset.theme=theme;
 const rows=Array.from({length:100},(_,i)=>attendance({id:'comment-'+i,classRating:i<65?'IMPROVE':i<85?'EXCELLENT':'GOOD',classComment:i<60?'Mejorar '+i:i===65?'Muy buena clase':'',classFeedbackAt:new Date()}));
 const db=database(rows),requests=[];
 globalThis.fetch=async url=>{requests.push(url);return{ok:true,json:async()=>classOpinions(db,'bm',feedbackReportFilter(new URL(url,window.location.origin).searchParams))};};
 render(h(Panel));fireEvent.click(screen.getByText('Opiniones'));
 await screen.findByText('Mejorar 0');assert.ok(screen.queryByText('Ana Pérez')===null);assert.ok(screen.getByLabelText('Resumen de valoraciones').textContent.includes('💬 A mejorar: 65'));
 for(const label of ['Desde','Hasta','Clase','Aplicar filtros','Siguiente','Anterior','Ver otros comentarios'])assert.ok(screen.queryByText(label)===null);
 assert.ok(!document.body.textContent.includes('30 por página'));assert.ok(screen.queryByText('Muy buena clase')===null);
 const list=screen.getByRole('list',{name:'Comentarios A mejorar'});
 fireEvent.scroll(list);await screen.findByText('Mejorar 30');assert.ok(screen.getByText('Mejorar 0'));assert.ok(requests.at(-1).includes('page=2'));
 assert.equal(requests.some(url=>url.includes('comments=positive')),false);
});
test('acceso desde Dashboard abre resumen acumulado y estado vacío claro',async()=>{
 window.history.replaceState({},'', '/clases?opiniones=hoy#opiniones');const requests=[];globalThis.fetch=async url=>{requests.push(url);return{ok:true,json:async()=>({total:0,distribution:{},commentTotal:0,page:1,pages:1,comments:[]})};};
 render(h(Panel));await screen.findByText('No hay comentarios para mejorar por el momento');assert.ok(requests[0].includes('from=1970-01-01'));assert.ok(!requests[0].includes('receivedOn='));window.history.replaceState({},'', '/');
});
test('Atención hoy muestra sólo el total principal de opiniones y conserva acceso',()=>{
 const dashboard=readFileSync(new URL('../app/dashboard/page.tsx',import.meta.url),'utf8');
 assert.ok(dashboard.includes('opinions.total} opiniones recibidas hoy'));assert.ok(!dashboard.includes('opinions.improve} para mejorar'));
 assert.ok(dashboard.includes('Ver opiniones de clases'));assert.ok(dashboard.includes('/clases?opiniones=hoy#opiniones'));
});

test('valoraciones sin comentario se acumulan sin filas vacías ni datos de alumno',async()=>{
 const rows=['IMPROVE','GOOD','EXCELLENT'].map((classRating,i)=>attendance({id:String(i),classRating,classComment:i===0?null:'',classFeedbackAt:new Date()}));const db=database(rows),original=db.classOccurrenceAttendance.findMany;
 db.classOccurrenceAttendance.findMany=async args=>{assert.equal(args.select.student,undefined);assert.equal(args.include,undefined);return original(args);};
 const report=await classOpinions(db,'bm',feedbackReportFilter(new URLSearchParams()));assert.equal(report.total,3);assert.deepEqual(report.distribution,{EXCELLENT:1,GOOD:1,IMPROVE:1});assert.equal(report.commentTotal,0);assert.deepEqual(report.comments,[]);
});

test("guardar una opinión reintenta una actualización simultánea de asistencia", async () => {
  const row = attendance();
  const db = database([row]);
  const update = db.classOccurrenceAttendance.updateMany;
  let changed = false;
  db.classOccurrenceAttendance.updateMany = async args => {
    if (!changed) {
      changed = true;
      row.updatedAt = new Date("2026-11-03T11:00:00Z");
      return { count: 0 };
    }
    return update(args);
  };
  assert.equal(await submitClassFeedback(db, "a", "bm", feedbackInput({ occurrenceId: "class-a", rating: "GOOD" })), true);
  assert.equal(row.updatedAt.toISOString(), "2026-11-03T11:00:00.000Z");
  assert.equal(row.actualAttendance, "PRESENT");
  assert.deepEqual(await availableClassFeedback(db, "a", "bm"), []);
});
