"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { inputClass } from "@/componentes/module-shell";
import { bmiFromCentimeters, storedHeightToCentimeters } from "@/lib/height";
import {
  EVALUATION_STEPS, EXPERIENCE_LEVELS, MEASUREMENT_DEFINITIONS, PRIMARY_GOALS,
  TEST_DEFINITIONS, calculateAgeAtDate, emptyTest, missingEssentialFields,
} from "@/lib/evaluation-workflow";
import { studentServiceLabel } from "@/lib/student-service";
import type { Student } from "@/types/gestion";
import type {
  EvaluationDraftInput, EvaluationMeasurementValue, EvaluationSummary,
  EvaluationTestCategory, EvaluationTestValue, EvaluationWorkflow,
} from "@/types/evaluation-workflow";

type SaveState = "idle" | "saving" | "saved" | "error";

const statusLabel = { IN_PROGRESS: "En curso", COMPLETED: "Completada", REASSESSMENT_RECOMMENDED: "Reevaluación recomendada" } as const;
const testStatusOptions = [
  ["NOT_PERFORMED", "No realizado"], ["CORRECT", "Correcto"], ["IMPROVABLE", "Mejorable"], ["PRIORITY", "Prioritario"],
] as const;
const testGroups = ["Movilidad", "Control motor", "Fuerza", "Resistencia", "Otros"] as const;
type TestGroup = (typeof testGroups)[number];

function testGroup(key: string): TestGroup {
  if (["KNEE_TO_WALL", "ARM_RAISE", "THORACIC_ROTATION"].includes(key)) return "Movilidad";
  if (["DEEP_SQUAT", "HIP_HINGE", "FRONT_PLANK_CONTROL", "SIDE_PLANK_CONTROL", "BIRD_DOG", "SINGLE_LEG_BALANCE"].includes(key)) return "Control motor";
  if (["CONTROLLED_SQUATS", "ADAPTED_PUSHUPS", "ADAPTED_ROW", "FRONT_PLANK", "SIDE_PLANK"].includes(key)) return "Fuerza";
  if (key === "STEP_TEST") return "Resistencia";
  return "Otros";
}

function formatDate(value: string) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function draftPayload(item: EvaluationWorkflow): EvaluationDraftInput {
  return {
    studentId: item.studentId, date: item.date, currentStep: item.currentStep, trainerName: item.trainerName,
    primaryGoal: item.primaryGoal, secondaryGoals: item.secondaryGoals, experienceLevel: item.experienceLevel,
    weeklyAvailability: item.weeklyAvailability, generalData: item.generalData, habits: item.habits,
    trainingObservations: item.trainingObservations, trainerNotes: item.trainerNotes,
    finalStrengths: item.finalStrengths, finalPriorities: item.finalPriorities, finalLimitations: item.finalLimitations,
    planningNotes: item.planningNotes, finalComment: item.finalComment, reassessmentDate: item.reassessmentDate,
    measurements: item.measurements, bodyIssues: item.bodyIssues, testResults: item.testResults,
  };
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw Object.assign(new Error(body.error || "La solicitud no pudo completarse."), { body });
  return body;
}

export function StudentEvaluations({ student }: { student: Student }) {
  const baseUrl = `/api/admin/alumnos/${student.id}/evaluaciones`;
  const [items, setItems] = useState<EvaluationSummary[]>([]);
  const [editor, setEditor] = useState<EvaluationWorkflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [latestDetail, setLatestDetail] = useState<EvaluationWorkflow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await apiJson<EvaluationSummary[]>(baseUrl)); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo cargar el historial."); }
    finally { setLoading(false); }
  }, [baseUrl]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const inProgress = items.find((item) => item.status === "IN_PROGRESS");
  const latest = items[0];
  const latestCompleted = items.find((item) => item.status !== "IN_PROGRESS");
  const latestCompletedId = latestCompleted?.id;

  useEffect(() => {
    if (!panelOpen || !latestCompletedId) return;
    const controller = new AbortController();
    apiJson<EvaluationWorkflow>(`${baseUrl}/${latestCompletedId}`, { signal: controller.signal })
      .then(setLatestDetail)
      .catch((cause) => { if (cause instanceof Error && cause.name !== "AbortError") setError(cause.message); });
    return () => controller.abort();
  }, [baseUrl, latestCompletedId, panelOpen]);

  async function open(id: string) {
    try { setEditor(await apiJson<EvaluationWorkflow>(`${baseUrl}/${id}`)); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo abrir la evaluación."); }
  }

  async function create() {
    if (creating) return;
    setCreating(true);
    try {
      const creationKey = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
      const created = await apiJson<EvaluationWorkflow>(baseUrl, { method: "POST", body: JSON.stringify({ creationKey }) });
      setEditor(created);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo crear la evaluación."); }
    finally { setCreating(false); }
  }

  async function recommend(id: string) {
    try { await apiJson(`${baseUrl}/${id}`, { method: "PATCH", body: JSON.stringify({ action: "recommendReassessment" }) }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo actualizar el estado."); }
  }

  return <section className="mt-5 rounded-xl border border-yellow-400/20 bg-zinc-950 p-3 sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-yellow-400">Evaluaciones</p>{loading ? <p className="mt-1 text-sm text-zinc-500">Cargando…</p> : latest ? <><p className="mt-1 truncate text-sm font-semibold">Versión {latest.version} · {statusLabel[latest.status]}</p><p className="mt-1 text-xs text-zinc-500">{formatDate(latest.date)} · {latest.completionPercentage}%{latest.reassessmentDate ? ` · Próxima ${formatDate(latest.reassessmentDate)}` : ""}</p><div className="mt-2 h-1.5 w-44 max-w-full overflow-hidden rounded-full bg-zinc-800"><div className={`h-full ${latest.status === "IN_PROGRESS" ? "bg-yellow-400" : "bg-emerald-400"}`} style={{ width: `${latest.completionPercentage}%` }} /></div></> : <p className="mt-1 text-sm text-zinc-500">Sin evaluaciones registradas.</p>}</div>
      <div className="flex flex-wrap gap-2">{inProgress && <button type="button" onClick={() => open(inProgress.id)} className="min-h-11 rounded-lg bg-yellow-400 px-3 py-2 text-sm font-bold text-zinc-950">Continuar evaluación</button>}<button type="button" disabled={creating || Boolean(inProgress)} onClick={create} className="min-h-11 rounded-lg border border-yellow-400/35 px-3 py-2 text-sm font-bold text-yellow-300 disabled:opacity-40">{creating ? "Creando…" : "Nueva evaluación"}</button><button type="button" onClick={() => setPanelOpen(true)} className="min-h-11 rounded-lg border border-zinc-700 px-3 py-2 text-sm font-bold text-zinc-200">Ver evaluaciones</button></div>
    </div>
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-400/10 p-2 text-xs text-red-200">{error}</p>}
    {panelOpen && <EvaluationPanel student={student} items={items} latestDetail={latestDetail} loading={loading} creating={creating} onClose={() => { setPanelOpen(false); setLatestDetail(null); }} onCreate={create} onOpen={open} onRecommend={recommend} />}
    {editor && <EvaluationWizard initial={editor} baseUrl={baseUrl} profileHeight={student.height} birthDate={student.birthDate} onClose={() => { setEditor(null); void load(); }} />}
  </section>;
}

function numeric(value: unknown) { const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN; return Number.isFinite(parsed) && parsed > 0 ? parsed : null; }
function metricNumber(value: number | null, unit = "") { const displayValue = unit === "m" && value !== null ? value * 100 : value; const displayUnit = unit === "m" ? "cm" : unit; return displayValue === null ? "—" : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(displayValue)}${displayUnit ? ` ${displayUnit}` : ""}`; }

function EvaluationPanel({ student, items, latestDetail, loading, creating, onClose, onCreate, onOpen, onRecommend }: { student: Student; items: EvaluationSummary[]; latestDetail: EvaluationWorkflow | null; loading: boolean; creating: boolean; onClose: () => void; onCreate: () => void; onOpen: (id: string) => void; onRecommend: (id: string) => void }) {
  const latest = items[0];
  const inProgress = items.find((item) => item.status === "IN_PROGRESS");
  const performed = items.filter((item) => item.status !== "IN_PROGRESS").length;
  const profileAge = calculateAgeAtDate(student.birthDate, latest?.date ?? "");
  const weight = latestDetail?.measurements.find((item) => item.measurementType === "WEIGHT")?.value ?? numeric(latestDetail?.generalData.weight);
  const storedHeight = numeric(latestDetail?.generalData.height);
  const height = storedHeight !== null ? storedHeightToCentimeters(storedHeight) : (student.height > 0 ? student.height : null);
  const age = numeric(latestDetail?.generalData.ageSnapshot);
  const bodyFat = latestDetail?.measurements.find((item) => item.measurementType === "BODY_FAT")?.value ?? numeric(latestDetail?.generalData.bodyFatPercentage);
  const bmi = weight !== null && height !== null ? Number(bmiFromCentimeters(weight, height)) : null;
  const reassessment = latestDetail?.reassessmentDate || items.find((item) => item.reassessmentDate)?.reassessmentDate || "";
  const statusClass = latest?.status === "IN_PROGRESS" ? "text-yellow-300" : latest?.status === "REASSESSMENT_RECOMMENDED" ? "text-amber-300" : "text-emerald-300";
  return <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/90 p-2 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="evaluations-panel-title"><section className="mx-auto my-2 w-full max-w-5xl rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-white sm:my-6 sm:p-6"><header className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-yellow-400">Panel de evaluaciones</p><h2 id="evaluations-panel-title" className="mt-1 text-xl font-black">{student.firstName} {student.lastName}</h2><p className="mt-1 text-xs text-zinc-500">{studentServiceLabel(student.serviceType)} · {profileAge === null ? "Edad —" : `${profileAge} años`} · {student.height > 0 ? `${student.height} cm` : "Altura —"} · {student.weight > 0 ? `${student.weight} kg` : "Peso —"}</p></div><button type="button" onClick={onClose} aria-label="Cerrar panel de evaluaciones" className="grid min-h-11 min-w-11 place-items-center rounded-lg border border-zinc-700 text-xl">×</button></header>
    <div className="mt-5 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 lg:grid-cols-5"><Stat label="Evaluaciones realizadas" value={String(performed)} /><Stat label="Progreso de la última" value={latest ? `${latest.completionPercentage}%` : "—"} /><Stat label="Última evaluación" value={latest ? formatDate(latest.date) : "—"} /><Stat label="Próxima reevaluación" value={reassessment ? formatDate(reassessment) : "—"} /><Stat label="Estado" value={latest ? statusLabel[latest.status] : "Sin evaluación"} valueClass={statusClass} /></div>
    <section className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-yellow-400">Resumen rápido</p><h3 className="mt-1 font-bold">Última evaluación completada</h3></div>{latestDetail && <button type="button" onClick={() => onOpen(latestDetail.id)} className="min-h-11 rounded-lg border border-zinc-700 px-3 text-sm font-bold text-yellow-300">Ver resumen completo</button>}</div>{latestDetail ? <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><Stat label="Peso" value={metricNumber(weight, "kg")} /><Stat label="Altura" value={metricNumber(height, "m")} /><Stat label="Edad registrada" value={age === null ? "—" : `${age} años`} /><Stat label="IMC" value={metricNumber(bmi)} /><Stat label="Grasa corporal" value={metricNumber(bodyFat, "%")} /><Stat label="Disponibilidad" value={latestDetail.weeklyAvailability || "—"} /><Stat label="Objetivo principal" value={latestDetail.primaryGoal || "—"} /><Stat label="Reevaluación" value={latestDetail.reassessmentDate ? formatDate(latestDetail.reassessmentDate) : "—"} /></div> : <p className="mt-3 text-sm text-zinc-500">{loading ? "Cargando resumen…" : "No hay una evaluación completada."}</p>}</section>
    <section className="mt-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">Historial</h3><div className="flex gap-2">{inProgress && <button type="button" onClick={() => onOpen(inProgress.id)} className="min-h-11 rounded-lg bg-yellow-400 px-3 text-sm font-bold text-zinc-950">Continuar evaluación</button>}<button type="button" disabled={creating || Boolean(inProgress)} onClick={onCreate} className="min-h-11 rounded-lg border border-yellow-400/35 px-3 text-sm font-bold text-yellow-300 disabled:opacity-40">Nueva evaluación</button></div></div><div className="mt-3 grid gap-2">{items.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-800 p-5 text-center text-sm text-zinc-500">Sin evaluaciones registradas.</p> : items.map((item) => <article key={item.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${item.status === "IN_PROGRESS" ? "border-yellow-400/30 bg-yellow-400/[.05]" : item.status === "REASSESSMENT_RECOMMENDED" ? "border-amber-400/25 bg-amber-400/[.04]" : "border-zinc-800 bg-zinc-900"}`}><div><p className="text-sm font-bold">Versión {item.version} · {formatDate(item.date)}</p><p className="mt-1 text-xs text-zinc-500">{statusLabel[item.status]} · {item.completionPercentage}% · {item.primaryGoal || "Objetivo —"} · {item.trainerName}</p></div><div className="flex gap-2">{item.status === "COMPLETED" && <button type="button" onClick={() => onRecommend(item.id)} className="min-h-11 rounded-lg border border-zinc-700 px-2 text-xs text-zinc-300">Reevaluar</button>}<button type="button" onClick={() => onOpen(item.id)} className="min-h-11 rounded-lg bg-zinc-800 px-3 text-sm font-bold text-yellow-300">{item.status === "IN_PROGRESS" ? "Continuar" : "Ver"}</button></div></article>)}</div></section></section></div>;
}

function Stat({ label, value, valueClass = "text-white" }: { label: string; value: string; valueClass?: string }) { return <div className="min-w-0 rounded-lg border border-zinc-800 bg-black/35 p-3"><p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p><p className={`mt-1 break-words text-lg font-black ${valueClass}`}>{value}</p></div>; }

export function EvaluationWizard({ initial, baseUrl, profileHeight, birthDate, allowCompletedEditing = false, onClose }: { initial: EvaluationWorkflow; baseUrl: string; profileHeight: number; birthDate: string; allowCompletedEditing?: boolean; onClose: () => void }) {
  const [value, setValue] = useState(initial);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const skipFirstSave = useRef(true);
  const requestNumber = useRef(0);
  const editRevision = useRef(0);
  const editingCompleted = allowCompletedEditing && value.status !== "IN_PROGRESS";
  const readonly = value.status !== "IN_PROGRESS" && !editingCompleted;

  const saveNow = useCallback(async (candidate: EvaluationWorkflow) => {
    if (candidate.status !== "IN_PROGRESS" && !allowCompletedEditing) return candidate;
    const requestId = ++requestNumber.current;
    const revisionAtStart = editRevision.current;
    setSaveState("saving");
    try {
      const saved = await apiJson<EvaluationWorkflow>(`${baseUrl}/${candidate.id}`, { method: "PUT", body: JSON.stringify(draftPayload(candidate)) });
      if (requestId === requestNumber.current && revisionAtStart === editRevision.current) { skipFirstSave.current = true; setValue(saved); setSaveState("saved"); setError(""); }
      return saved;
    } catch (cause) {
      if (requestId === requestNumber.current) { setSaveState("error"); setError(cause instanceof Error ? cause.message : "No se pudo guardar."); }
      throw cause;
    }
  }, [allowCompletedEditing, baseUrl]);

  useEffect(() => {
    if (readonly) return;
    if (skipFirstSave.current) { skipFirstSave.current = false; return; }
    setSaveState("idle");
    const timer = window.setTimeout(() => { void saveNow(value).catch(() => undefined); }, 900);
    return () => window.clearTimeout(timer);
  }, [value, readonly, saveNow]);

  function update(patch: Partial<EvaluationWorkflow>) { editRevision.current += 1; setMissing([]); setValue((current) => ({ ...current, ...patch })); }
  function setObject(section: "generalData" | "habits" | "trainingObservations", key: string, fieldValue: unknown) { const storedValue = section === "generalData" && key === "height" && fieldValue !== "" ? Number(fieldValue) / 100 : fieldValue; update({ [section]: { ...value[section], [key]: storedValue } }); }
  function objectString(section: "generalData" | "habits" | "trainingObservations", key: string) { const current = value[section][key]; if (section === "generalData" && key === "height") return String(storedHeightToCentimeters(current) || ""); return typeof current === "string" || typeof current === "number" ? String(current) : ""; }
  function changeStep(step: number) { update({ currentStep: Math.max(1, Math.min(EVALUATION_STEPS.length, step)) }); }

  async function saveAndExit() {
    try { await saveNow(value); onClose(); } catch { /* El error visible permite reintentar. */ }
  }

  async function complete() {
    try {
      const saved = await saveNow(value);
      const fields = missingEssentialFields(saved);
      setMissing(fields);
      if (fields.length || !window.confirm("¿Completar la evaluación?")) return;
      const completed = await apiJson<EvaluationWorkflow>(`${baseUrl}/${value.id}/complete`, { method: "POST", body: "{}" });
      skipFirstSave.current = true; setValue(completed); setSaveState("saved"); setError("");
    } catch (cause) {
      const apiMissing = (cause as { body?: { missing?: string[] } })?.body?.missing;
      if (apiMissing) setMissing(apiMissing);
    }
  }

  return <div className="fixed inset-0 z-[70] bg-black/90 p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="evaluation-title">
    <section className="mx-auto flex h-[100dvh] w-full max-w-5xl flex-col overflow-hidden bg-zinc-950 text-white sm:h-[calc(100dvh-2rem)] sm:rounded-2xl sm:border sm:border-zinc-800">
      <header className="shrink-0 border-b border-zinc-800 px-4 py-3 sm:px-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-yellow-400">Evaluación — Versión {value.version}</p><h2 id="evaluation-title" className="mt-1 text-lg font-bold">{value.studentName}</h2><p className="mt-1 text-xs text-zinc-400">{statusLabel[value.status]} · {value.completionPercentage}% · {saveState === "saving" ? "Guardando…" : saveState === "saved" ? "Guardado" : saveState === "error" ? "Error al guardar" : "Cambios pendientes"}</p></div><button type="button" aria-label="Cerrar evaluación" onClick={readonly ? onClose : saveAndExit} className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-lg border border-zinc-700 text-xl">×</button></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full bg-yellow-400 transition-all" style={{ width: `${value.currentStep / EVALUATION_STEPS.length * 100}%` }} /></div><div className="mt-2 hidden grid-cols-5 gap-1 md:grid">{EVALUATION_STEPS.map((step, index) => <button type="button" key={step} onClick={() => changeStep(index + 1)} className={`min-h-11 rounded-md px-1 text-[11px] leading-tight ${value.currentStep === index + 1 ? "bg-yellow-400/15 font-bold text-yellow-300" : "text-zinc-500 hover:bg-zinc-900"}`}><span className="block">{index + 1}</span>{step}</button>)}</div><p className="mt-2 text-xs text-zinc-400 md:hidden">Paso {value.currentStep} de {EVALUATION_STEPS.length} — {EVALUATION_STEPS[value.currentStep - 1]}</p></header>
      <main className="flex-1 overflow-y-auto px-4 py-5 pb-28 sm:px-6"><fieldset disabled={readonly} className="disabled:opacity-80">
        {value.currentStep === 1 && <GeneralStep value={value} update={update} setObject={setObject} objectString={objectString} profileHeight={profileHeight} birthDate={birthDate} />}
        {value.currentStep === 2 && <HabitsStep value={value} setObject={setObject} objectString={objectString} />}
        {value.currentStep === 3 && <MeasurementsStep value={value} update={update} />}
        {value.currentStep === 4 && <TestsStep value={value} update={update} />}
        {value.currentStep === 5 && <SummaryStep value={value} update={update} missing={missing} />}
      </fieldset>{readonly && <p className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">Esta evaluación está en modo consulta y no puede modificarse.</p>}{error && <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}</main>
      <footer className="absolute inset-x-0 bottom-0 z-10 mx-auto flex w-full max-w-5xl items-center justify-between gap-2 border-t border-zinc-800 bg-zinc-950/95 p-3 pb-[calc(env(safe-area-inset-bottom)+.75rem)] backdrop-blur sm:static sm:pb-3"><button type="button" disabled={value.currentStep === 1} onClick={() => changeStep(value.currentStep - 1)} className="min-h-11 rounded-xl border border-zinc-700 px-4 text-sm font-bold disabled:opacity-30">Anterior</button>{!readonly && <button type="button" disabled={saveState === "saving"} onClick={saveAndExit} className="min-h-11 rounded-xl px-3 text-sm font-bold text-zinc-300 disabled:opacity-50">Guardar y salir</button>}{value.currentStep < EVALUATION_STEPS.length ? <button type="button" onClick={() => changeStep(value.currentStep + 1)} className="min-h-11 rounded-xl bg-yellow-400 px-5 text-sm font-bold text-zinc-950">Siguiente</button> : readonly ? <button type="button" onClick={onClose} className="min-h-11 rounded-xl bg-yellow-400 px-5 text-sm font-bold text-zinc-950">Cerrar</button> : editingCompleted ? <button type="button" disabled={saveState === "saving"} onClick={saveAndExit} className="min-h-11 rounded-xl bg-yellow-400 px-4 text-sm font-bold text-zinc-950 disabled:opacity-50">Guardar cambios</button> : <button type="button" disabled={saveState === "saving"} onClick={complete} className="min-h-11 rounded-xl bg-emerald-400 px-4 text-sm font-bold text-zinc-950 disabled:opacity-50">Completar</button>}</footer>
    </section>
  </div>;
}

type Update = (patch: Partial<EvaluationWorkflow>) => void;
type SetObject = (section: "generalData" | "habits" | "trainingObservations", key: string, value: unknown) => void;
type ObjectString = (section: "generalData" | "habits" | "trainingObservations", key: string) => string;
const field = `${inputClass} mt-1 min-h-11`;

function GeneralStep({ value, update, setObject, objectString, profileHeight, birthDate }: { value: EvaluationWorkflow; update: Update; setObject: SetObject; objectString: ObjectString; profileHeight: number; birthDate: string }) {
  const calculatedAge = calculateAgeAtDate(birthDate, value.date);
  function changeDate(date: string) { update({ date, generalData: { ...value.generalData, ageSnapshot: calculateAgeAtDate(birthDate, date) } }); }
  return <Step title="Perfil y objetivo" note="Datos esenciales para planificar. La edad se calcula desde el perfil y queda guardada en esta evaluación."><div className="grid gap-4 sm:grid-cols-2"><Label text="Fecha de evaluación *"><input type="date" required value={value.date} onChange={(event) => changeDate(event.target.value)} className={field} /></Label><Label text="Edad">{calculatedAge !== null ? <div className={`${field} flex items-center bg-zinc-900 text-zinc-200`} aria-label={`Edad calculada: ${calculatedAge} años`}>{calculatedAge} años <span className="ml-2 text-xs text-zinc-500">calculada desde el perfil</span></div> : <div className={`${field} flex flex-col justify-center bg-zinc-900 text-zinc-300`} aria-label="Sin fecha de nacimiento"><span>Sin fecha de nacimiento</span><span className="text-xs text-zinc-500">Completala desde el perfil del alumno</span></div>}</Label><Label text="Disponibilidad semanal *"><input value={value.weeklyAvailability} onChange={(event) => update({ weeklyAvailability: event.target.value })} placeholder="Ej. 3 días" className={field} /></Label><Label text="Altura (cm, opcional)"><input type="number" min="50" max="300" step="1" value={objectString("generalData", "height")} onChange={(event) => setObject("generalData", "height", event.target.value)} className={field} placeholder="Ej. 166" />{profileHeight > 0 && <button type="button" onClick={() => setObject("generalData", "height", profileHeight)} className="mt-1 min-h-11 text-xs font-bold text-yellow-300">Usar {profileHeight} cm del perfil</button>}</Label></div><div className="mt-5 border-t border-zinc-800 pt-5"><GoalsStep value={value} update={update} setObject={setObject} objectString={objectString} /></div></Step>;
}

function GoalsStep({ value, update, setObject, objectString }: { value: EvaluationWorkflow; update: Update; setObject: SetObject; objectString: ObjectString }) {
  function toggle(goal: string) { update({ secondaryGoals: value.secondaryGoals.includes(goal) ? value.secondaryGoals.filter((item) => item !== goal) : [...value.secondaryGoals, goal] }); }
  return <div className="grid gap-4 sm:grid-cols-2"><Label text="Objetivo principal *"><select value={value.primaryGoal} onChange={(event) => update({ primaryGoal: event.target.value })} className={field}><option value="">Seleccionar</option>{PRIMARY_GOALS.map((item) => <option key={item}>{item}</option>)}</select></Label><Label text="Nivel o experiencia *"><select value={value.experienceLevel} onChange={(event) => update({ experienceLevel: event.target.value })} className={field}><option value="">Seleccionar</option>{EXPERIENCE_LEVELS.map((item) => <option key={item}>{item}</option>)}</select></Label><div className="sm:col-span-2"><p className="text-sm">Objetivos secundarios (opcionales)</p><div className="mt-2 flex flex-wrap gap-2">{PRIMARY_GOALS.map((goal) => <label key={goal} className="flex min-h-11 items-center gap-2 rounded-lg border border-zinc-700 px-3 text-sm"><input type="checkbox" checked={value.secondaryGoals.includes(goal)} onChange={() => toggle(goal)} />{goal}</label>)}</div></div>{(value.primaryGoal === "Otro" || value.secondaryGoals.includes("Otro")) && <Label text="Detalle de “Otro”"><input value={objectString("generalData", "otherGoal")} onChange={(event) => setObject("generalData", "otherGoal", event.target.value)} className={field} /></Label>}<Label text="Experiencia entrenando"><textarea rows={2} value={objectString("generalData", "experienceNotes")} onChange={(event) => setObject("generalData", "experienceNotes", event.target.value)} className={field} /></Label><Label text="Actividades o deportes actuales (opcional)" wide><input value={objectString("generalData", "activities")} onChange={(event) => setObject("generalData", "activities", event.target.value)} className={field} /></Label></div>;
}

function HabitsStep({ value, setObject, objectString }: { value: EvaluationWorkflow; setObject: SetObject; objectString: ObjectString }) {
  const select = (key: string, label: string, options: string[]) => <Label text={label}><select value={objectString("habits", key)} onChange={(event) => setObject("habits", key, event.target.value)} className={field}><option value="">Opcional</option>{options.map((item) => <option key={item}>{item}</option>)}</select></Label>;
  return <Step title="Contexto" note="Información para planificar el entrenamiento; no genera diagnósticos."><div className="grid gap-4 sm:grid-cols-2">{select("dailyActivity", "Actividad diaria", ["Muy baja", "Baja", "Moderada", "Alta", "Muy alta"])}{select("jobType", "Tipo de trabajo", ["Sedentario", "Activo", "Mixto"])}<Label text="Horas de sueño"><input type="number" min="0" max="24" step="0.5" value={objectString("habits", "sleepHours")} onChange={(event) => setObject("habits", "sleepHours", event.target.value)} className={field} /></Label>{select("sleepQuality", "Calidad del sueño", ["Muy mala", "Mala", "Regular", "Buena", "Muy buena"])}{select("stress", "Nivel de estrés", ["Muy bajo", "Bajo", "Moderado", "Alto", "Muy alto"])}<Label text="Frecuencia de entrenamiento actual"><input value={objectString("habits", "trainingFrequency")} onChange={(event) => setObject("habits", "trainingFrequency", event.target.value)} className={field} /></Label><Label text="Molestias, lesiones o limitaciones a considerar" wide><textarea rows={3} value={objectString("trainingObservations", "description")} onChange={(event) => setObject("trainingObservations", "description", event.target.value)} className={field} /></Label></div>{value.bodyIssues.length > 0 && <p className="mt-4 text-xs text-zinc-500">Esta evaluación conserva {value.bodyIssues.length} {value.bodyIssues.length === 1 ? "zona corporal histórica" : "zonas corporales históricas"} en su ficha; el mapa anterior ya no se solicita.</p>}</Step>;
}

function MeasurementsStep({ value, update }: { value: EvaluationWorkflow; update: Update }) {
  function current(type: string, side: string | null) { return value.measurements.find((item) => item.measurementType === type && item.side === side); }
  function setMeasurement(type: string, side: string | null, unit: string, raw: string) {
    const rest = value.measurements.filter((item) => !(item.measurementType === type && item.side === side));
    if (!raw) return update({ measurements: rest });
    const measurement: EvaluationMeasurementValue = { measurementType: type, side, unit, value: Number(raw), notes: current(type, side)?.notes ?? "" };
    update({ measurements: [...rest, measurement] });
  }
  return <Step title="Medidas corporales" note="Todas son opcionales. Los valores quedan guardados en esta versión y no reemplazan mediciones anteriores."><div className="grid gap-4 sm:grid-cols-2">{MEASUREMENT_DEFINITIONS.flatMap((definition) => ("sides" in definition && definition.sides ? ["RIGHT", "LEFT"] : [null]).map((side) => { const item = current(definition.key, side); return <Label key={`${definition.key}-${side}`} text={`${definition.label}${side === "RIGHT" ? " derecho" : side === "LEFT" ? " izquierdo" : ""} (${definition.unit})`}><input type="number" min={definition.min} max={definition.max} step="0.1" value={item?.value ?? ""} onChange={(event) => setMeasurement(definition.key, side, definition.unit, event.target.value)} className={field} /></Label>; }) )}</div></Step>;
}

function TestsStep({ value, update }: { value: EvaluationWorkflow; update: Update }) {
  const [group, setGroup] = useState<TestGroup>("Movilidad");
  const definitions = TEST_DEFINITIONS.filter((item) => testGroup(item.key) === group);
  function result(key: string, category: EvaluationTestCategory) {
    return value.testResults.find((item) => item.testKey === key && item.category === category);
  }
  function patch(key: string, category: EvaluationTestCategory, changes: Partial<EvaluationTestValue>) {
    const current = result(key, category) ?? emptyTest(key, category);
    update({ testResults: [...value.testResults.filter((item) => !(item.testKey === key && item.category === category)), { ...current, ...changes }] });
  }
  return <Step title="Tests físicos" note="Elegí una categoría y registrá sólo las pruebas realizadas. Las pruebas anteriores siguen disponibles.">
    <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Categoría de tests">
      {testGroups.filter((item) => TEST_DEFINITIONS.some((definition) => testGroup(definition.key) === item)).map((item) => {
        const done = value.testResults.filter((test) => test.status !== "NOT_PERFORMED" && testGroup(test.testKey) === item).length;
        return <button key={item} type="button" aria-pressed={group === item} onClick={() => setGroup(item)} className={"min-h-11 rounded-lg border px-3 text-sm " + (group === item ? "border-yellow-400 bg-yellow-400/10 font-bold text-yellow-300" : "border-zinc-700 text-zinc-300")}>{item}{done > 0 ? " · " + done : ""}</button>;
      })}
    </div>
    <div className="grid gap-2">{definitions.map((definition) => {
      const item = result(definition.key, definition.category) ?? emptyTest(definition.key, definition.category);
      return <details key={definition.key} className="rounded-xl border border-zinc-700 bg-zinc-900 p-3">
        <summary className="cursor-pointer font-semibold text-yellow-300">{definition.name}<span className="ml-2 text-xs font-normal text-zinc-500">{definition.area} · {testStatusOptions.find(([key]) => key === item.status)?.[1]}</span></summary>
        <div className="mt-3 rounded-lg bg-zinc-950 p-3 text-xs text-zinc-400"><p>{definition.protocol}</p><p className="mt-1">Material: {definition.material}</p></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Label text="Estado"><select value={item.status} onChange={(event) => patch(definition.key, definition.category, { status: event.target.value })} className={field}>{testStatusOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Label>
          <Label text={"Resultado (" + (definition.unit || "categoría") + ")"}><input type="number" step="0.1" value={item.numericValue ?? ""} onChange={(event) => patch(definition.key, definition.category, { numericValue: event.target.value === "" ? null : Number(event.target.value), unit: definition.unit })} className={field} /></Label>
          <Label text="Variante o adaptación"><input value={item.variation} onChange={(event) => patch(definition.key, definition.category, { variation: event.target.value })} className={field} /></Label>
          <Label text={"Derecha (" + (definition.unit || "valor") + ")"}><input type="number" step="0.1" value={item.rightValue ?? ""} onChange={(event) => patch(definition.key, definition.category, { rightValue: event.target.value === "" ? null : Number(event.target.value), rightUnit: definition.unit })} className={field} /></Label>
          <Label text={"Izquierda (" + (definition.unit || "valor") + ")"}><input type="number" step="0.1" value={item.leftValue ?? ""} onChange={(event) => patch(definition.key, definition.category, { leftValue: event.target.value === "" ? null : Number(event.target.value), leftUnit: definition.unit })} className={field} /></Label>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={item.pain} onChange={(event) => patch(definition.key, definition.category, { pain: event.target.checked })} /> Molestia informada</label>
          <Label text="Compensaciones observadas"><textarea rows={2} value={item.compensations} onChange={(event) => patch(definition.key, definition.category, { compensations: event.target.value })} className={field} /></Label>
          <Label text="Observaciones"><textarea rows={2} value={item.observations} onChange={(event) => patch(definition.key, definition.category, { observations: event.target.value })} className={field} /></Label>
          {item.status === "NOT_PERFORMED" && <Label text="Motivo de no realización"><input value={item.notPerformedReason} onChange={(event) => patch(definition.key, definition.category, { notPerformedReason: event.target.value })} className={field} /></Label>}
        </div>
      </details>;
    })}</div>
  </Step>;
}

function SummaryStep({ value, update, missing }: { value: EvaluationWorkflow; update: Update; missing: string[] }) {
  const currentMissing = missing.length ? missing : missingEssentialFields(value);
  const performedTests = value.testResults.filter((item) => item.status !== "NOT_PERFORMED").length;
  const reportedLimitations = String(value.trainingObservations.description ?? "").trim()
    || value.bodyIssues.map((item) => item.bodyZone).join(", ")
    || value.finalLimitations.trim();
  const hasHistoricalNotes = Boolean(value.finalStrengths || value.finalLimitations || value.finalComment || value.reassessmentDate);
  return <Step title="Resumen final" note="Revisá lo registrado y dejá una prioridad o una observación para planificar.">
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <Summary label="Objetivo principal" value={value.primaryGoal || "Pendiente"} />
      <Summary label="Nivel o experiencia" value={value.experienceLevel || "Pendiente"} />
      <Summary label="Disponibilidad semanal" value={value.weeklyAvailability || "Pendiente"} />
      <Summary label="Medidas registradas" value={String(value.measurements.length)} />
      <Summary label="Tests realizados" value={String(performedTests)} />
      <Summary label="Molestias o limitaciones" value={reportedLimitations || "No registradas"} />
    </div>
    {currentMissing.length > 0 && <div role="alert" className="mt-4 rounded-xl border border-yellow-400/30 bg-yellow-400/10 p-3"><p className="font-semibold text-yellow-200">Falta información esencial</p><ul className="mt-2 list-disc pl-5 text-sm text-yellow-100">{currentMissing.map((item) => <li key={item}>{item}</li>)}</ul></div>}
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <Label text="Prioridades para trabajar"><textarea rows={3} value={value.finalPriorities} onChange={(event) => update({ finalPriorities: event.target.value })} className={field} /></Label>
      <Label text="Observaciones para la planificación"><textarea rows={3} value={value.planningNotes} onChange={(event) => update({ planningNotes: event.target.value })} className={field} /></Label>
    </div>
    {hasHistoricalNotes && <details className="mt-5 rounded-xl border border-zinc-800 p-3 text-sm text-zinc-400"><summary className="cursor-pointer">Datos conservados de esta evaluación</summary><div className="mt-3 space-y-2">{value.finalStrengths && <p><strong>Fortalezas:</strong> {value.finalStrengths}</p>}{value.finalLimitations && <p><strong>Limitaciones:</strong> {value.finalLimitations}</p>}{value.finalComment && <p><strong>Comentario final:</strong> {value.finalComment}</p>}{value.reassessmentDate && <p><strong>Reevaluación sugerida:</strong> {formatDate(value.reassessmentDate)}</p>}</div></details>}
  </Step>;
}

function Step({ title, note, children }: { title: string; note: string; children: React.ReactNode }) { return <div><h3 className="text-xl font-bold">{title}</h3><p className="mt-1 text-sm leading-relaxed text-zinc-400">{note}</p><div className="mt-5">{children}</div></div>; }
function Label({ text, wide = false, children }: { text: string; wide?: boolean; children: React.ReactNode }) { return <label className={`block text-sm ${wide ? "sm:col-span-2" : ""}`}>{text}{children}</label>; }
function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>; }
