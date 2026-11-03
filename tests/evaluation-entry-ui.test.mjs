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
const { missingEssentialFields, EVALUATION_ESSENTIAL_TARGETS: targets, EVALUATION_FLOW_VERSION } = load("lib/evaluation-workflow.ts");
function evaluation(patch = {}) {
  return { id: "eval", studentId: "a", studentName: "Ana Pérez", version: 1, status: "IN_PROGRESS", date: "2026-11-03", currentStep: 1, completionPercentage: 20, trainerName: "Entrenador", primaryGoal: "", secondaryGoals: [], experienceLevel: "", weeklyAvailability: "", generalData: { evaluationFlowVersion: EVALUATION_FLOW_VERSION }, habits: {}, trainingObservations: {}, trainerNotes: "", finalStrengths: "", finalPriorities: "", finalLimitations: "", planningNotes: "", finalComment: "", reassessmentDate: "", completedAt: null, createdAt: "2026-11-03T12:00:00Z", updatedAt: "2026-11-03T12:00:00Z", measurements: [], bodyIssues: [], testResults: [], ...patch };
}
const student = { id: "a", workspaceId: "bm", serviceType: "MIXED", data: { firstName: "Ana", lastName: "Pérez", birthDate: "1990-01-01", weight: 80, height: 172 } };
function stored(patch = {}) {
  const value = evaluation();
  return { ...value, student, date: new Date(value.date + "T12:00:00Z"), createdAt: new Date(value.createdAt), updatedAt: new Date(value.updatedAt), reassessmentDate: null, ...Object.fromEntries(["weight", "height", "bodyFatPercentage", "muscleMass", "visceralFat", "waist", "hip", "chest", "rightArm", "leftArm", "rightThigh", "leftThigh", "rightCalf", "leftCalf"].map(key => [key, null])), ...patch };
}

function creationFixture({ profile = student, physical = [], legacy = [], prior = null, progress = null, authorized = true } = {}) {
  let created = null; let measureReads = 0; let studentWrites = 0;
  const transaction = {
    studentRecord: { findUnique: async ({ where }) => { assert.equal(where.workspaceId, "bm"); return profile; }, update: async () => { studentWrites++; throw Error("Profile writes forbidden"); } },
    physicalEvaluation: {
      findUnique: async () => prior,
      findFirst: async ({ where }) => where.status === "IN_PROGRESS" ? progress : physical.find(row => row.id === where.id && row.studentId === where.studentId) ?? null,
      aggregate: async () => ({ _max: { version: 1 } }),
      findMany: async ({ where }) => { measureReads++; assert.equal(where.studentId, "a"); assert.equal(where.student.workspaceId, "bm"); return physical.filter(row => row.studentId === "a" && row.student.workspaceId === "bm"); },
      create: async ({ data }) => { created = stored({ ...data, measurements: data.measurements?.create ?? [], student: profile }); return created; },
    },
    evaluationRecord: { findMany: async ({ where }) => { measureReads++; assert.equal(where.workspaceId, "bm"); assert.ok(where.OR.some(item => item.data.equals === "a")); return legacy.filter(row => row.workspaceId === "bm"); } },
  };
  const local = loader({ "@/lib/prisma": { prisma: { $transaction: async callback => callback(transaction) } }, "@/lib/admin-api-auth": { requireAdminApiResponse: async () => authorized ? null : Response.json({ error: "No autorizado" }, { status: 401 }) }, "@/lib/trainer-workspace": { requireTrainerWorkspace: async () => ({ workspaceId: "bm" }), assertStudentInWorkspace: async (id, workspace) => { assert.equal(id, "a"); assert.equal(workspace, "bm"); } } });
  const POST = local("app/api/admin/alumnos/[id]/evaluaciones/route.ts").POST;
  return { create: async (body = {}) => POST(new Request("https://bm.test/api/admin/alumnos/a/evaluaciones", { method: "POST", body: JSON.stringify({ creationKey: "new", ...body }) }), { params: Promise.resolve({ id: "a" }) }), get created() { return created; }, get measureReads() { return measureReads; }, get studentWrites() { return studentWrites; } };
}

test("crear: última medición válida, no el peso del perfil ni una evaluación nueva sin peso; altura del perfil en cm", async () => {
  const f = creationFixture({ physical: [stored({ id: "old", status: "COMPLETED", date: new Date("2026-10-01"), measurements: [{ measurementType: "WEIGHT", side: null, value: 72.5, unit: "kg", notes: "" }] }), stored({ id: "newer-empty", status: "COMPLETED", date: new Date("2026-11-01") })] });
  const response = await f.create(); assert.equal(response.status, 201); const body = await response.json();
  assert.equal(body.measurements[0].value, 72.5); assert.equal(body.measurements[0].unit, "kg"); assert.equal(body.generalData.height, 1.72); assert.equal(body.generalData.ageSnapshot, 36);
  assert.equal(f.created.measurements[0].value, 72.5); assert.equal(f.studentWrites, 0);
});

test("crear reutiliza registros legacy y respeta alumno/workspace", async () => {
  const f = creationFixture({ legacy: [
    { id: "legacy", workspaceId: "bm", createdAt: new Date("2026-10-30"), data: { studentId: "a", date: "2026-10-30", weight: 69 } },
    { id: "other-student", workspaceId: "bm", createdAt: new Date("2026-11-02"), data: { studentId: "other", date: "2026-11-02", weight: 120 } },
    { id: "foreign", workspaceId: "foreign", createdAt: new Date("2026-11-02"), data: { studentId: "a", date: "2026-11-02", weight: 130 } },
  ], physical: [stored({ studentId: "other", weight: 150 })] });
  assert.equal((await (await f.create()).json()).measurements[0].value, 69);
  assert.equal(f.studentWrites, 0);
});

test("sin mediciones usa peso de perfil; sin datos deja peso y altura vacíos", async () => {
  const fallback = creationFixture(); const body = await (await fallback.create()).json();
  assert.equal(body.measurements[0].value, 80);
  const empty = creationFixture({ profile: { ...student, data: { ...student.data, weight: 0, height: 0 } } });
  const blank = await (await empty.create()).json(); assert.deepEqual(blank.measurements, []); assert.equal(blank.generalData.height, undefined);
  const meters = creationFixture({ profile: { ...student, data: { ...student.data, height: 1.65 } } });
  assert.equal((await (await meters.create()).json()).generalData.height, 1.65);
  const legacyProfile = creationFixture({ profile: { ...student, data: { ...student.data, weight: "68.5" } } });
  assert.equal((await (await legacyProfile.create()).json()).measurements[0].value, 68.5);
});

test("reintento o borrador existente no se autocompleta; sin sesión no consulta medidas", async () => {
  const original = stored({ creationKey: "new", measurements: [{ measurementType: "WEIGHT", side: null, value: 61, unit: "kg", notes: "Manual" }], generalData: { evaluationFlowVersion: EVALUATION_FLOW_VERSION, height: 1.6 } });
  for (const options of [{ prior: original }, { progress: original }]) {
    const f = creationFixture(options); const body = await (await f.create()).json();
    assert.equal(body.measurements[0].value, 61); assert.equal(body.generalData.height, 1.6); assert.equal(f.created, null); assert.equal(f.measureReads, 0);
  }
  const denied = creationFixture({ authorized: false }); assert.equal((await denied.create()).status, 401); assert.equal(denied.measureReads, 0);
});

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://bm.test/evaluaciones", pretendToBeVisual: true });
for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "HTMLInputElement", "Event", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"]) Object.defineProperty(globalThis, key, { configurable: true, value: ["getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"].includes(key) ? dom.window[key].bind(dom.window) : dom.window[key] });
window.matchMedia = () => ({ matches: false });
const scrolls = []; HTMLElement.prototype.scrollIntoView = function (options) { scrolls.push({ id: this.id, options }); };
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = require("react"); const h = React.createElement;
const { render, screen, fireEvent, cleanup, waitFor } = require("@testing-library/react");
const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; scrolls.length = 0; });
const local = loader({ "@/componentes/keyboard-dialog": { KeyboardDialog: ({ children, ...props }) => { for (const key of ["as", "onClose", "priority", "dismissible"]) delete props[key]; return h("div", props, children); } }, "@/componentes/module-shell": { inputClass: "input" } });
const { EvaluationWizard } = local("componentes/student-evaluations.tsx");
const props = { baseUrl: "/api/admin/alumnos/a/evaluaciones", profileHeight: 172, birthDate: "1990-01-01", onClose() {} };

for (const width of [390, 1280]) for (const label of missingEssentialFields(evaluation({ date: "" }))) test(`${width}px pendiente «${label}»: abre sección, desplaza y enfoca`, async () => {
  window.innerWidth = width;
  render(h(EvaluationWizard, { ...props, initial: evaluation({ currentStep: 5, date: "", habits: { jobType: "Mixto" } }) }));
  fireEvent.click(screen.getByRole("button", { name: label, exact: true }));
  await waitFor(() => assert.equal(document.activeElement.id, targets[label].fieldId));
  assert.equal(scrolls.at(-1).id, targets[label].fieldId); assert.equal(scrolls.at(-1).options.block, "center");
  assert.ok(document.activeElement.closest("main"));
});

test("peso/altura editables se conservan entre pasos y se guardan sólo en la evaluación", async () => {
  const initial = evaluation({ generalData: { evaluationFlowVersion: EVALUATION_FLOW_VERSION, height: 1.72 }, measurements: [{ measurementType: "WEIGHT", side: null, value: 72.5, unit: "kg", notes: "" }] });
  const requests = [];
  globalThis.fetch = async (url, options) => { requests.push({ url, method: options.method, body: JSON.parse(options.body) }); return { ok: true, json: async () => ({ ...initial, ...JSON.parse(options.body) }) }; };
  render(h(EvaluationWizard, { ...props, initial }));
  assert.equal(screen.getByLabelText("Altura (cm, opcional)").value, "172");
  fireEvent.change(screen.getByLabelText("Altura (cm, opcional)"), { target: { value: "168" } });
  fireEvent.click(screen.getByRole("button", { name: /3Medidas corporales/ }));
  assert.equal(screen.getByLabelText("Peso (kg)").value, "72.5"); fireEvent.change(screen.getByLabelText("Peso (kg)"), { target: { value: "73.2" } });
  fireEvent.click(screen.getByRole("button", { name: /1Perfil y objetivo/ })); assert.equal(screen.getByLabelText("Altura (cm, opcional)").value, "168");
  fireEvent.click(screen.getByRole("button", { name: /3Medidas corporales/ })); assert.equal(screen.getByLabelText("Peso (kg)").value, "73.2");
  fireEvent.click(screen.getByRole("button", { name: "Guardar y salir" }));
  await waitFor(() => assert.equal(requests.length, 1));
  assert.equal(requests[0].url, props.baseUrl + "/eval"); assert.equal(requests[0].method, "PUT");
  assert.equal(requests[0].body.generalData.height, 1.68); assert.equal(requests[0].body.measurements[0].value, 73.2);
});

test("editar una evaluación anterior conserva sus medidas incluso si cambia el perfil recibido", () => {
  const initial = evaluation({ status: "COMPLETED", generalData: { height: 1.8 }, measurements: [{ measurementType: "WEIGHT", side: null, value: 90, unit: "kg", notes: "Histórico" }] });
  const view = render(h(EvaluationWizard, { ...props, allowCompletedEditing: true, initial }));
  assert.equal(screen.getByLabelText("Altura (cm, opcional)").value, "180");
  view.rerender(h(EvaluationWizard, { ...props, profileHeight: 195, allowCompletedEditing: true, initial }));
  assert.equal(screen.getByLabelText("Altura (cm, opcional)").value, "180");
  fireEvent.click(screen.getByRole("button", { name: /3Medidas corporales/ })); assert.equal(screen.getByLabelText("Peso (kg)").value, "90");
});

test("completar el campo desde el aviso actualiza pendientes sin cambiar las reglas", async () => {
  const initial = evaluation({ currentStep: 5, primaryGoal: "Salud general", experienceLevel: "Principiante", weeklyAvailability: "2 días", measurements: [{ measurementType: "WEIGHT", side: null, value: 70, unit: "kg", notes: "" }] });
  render(h(EvaluationWizard, { ...props, initial }));
  fireEvent.click(screen.getByRole("button", { name: "Prioridad u observación para la planificación" }));
  await waitFor(() => assert.equal(document.activeElement.id, "evaluation-priorities"));
  fireEvent.change(screen.getByLabelText("Prioridades para trabajar"), { target: { value: "Mejorar fuerza" } });
  assert.equal(screen.queryByText("Falta información esencial"), null);
  assert.deepEqual(Object.keys(targets), missingEssentialFields(evaluation({ date: "" })));
});
