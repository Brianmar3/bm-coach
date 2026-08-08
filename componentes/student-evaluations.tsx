"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { inputClass } from "@/componentes/module-shell";
import {
  BODY_ZONES, EVALUATION_STEPS, EXPERIENCE_LEVELS, MEASUREMENT_DEFINITIONS, PRIMARY_GOALS,
  TEST_DEFINITIONS, calculateAgeAtDate, emptyBodyIssue, emptyTest, missingEssentialFields,
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
    {editor && <EvaluationWizard initial={editor} baseUrl={baseUrl} profileWeight={student.weight} profileHeight={student.height} birthDate={student.birthDate} onClose={() => { setEditor(null); void load(); }} />}
  </section>;
}

function numeric(value: unknown) { const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN; return Number.isFinite(parsed) && parsed > 0 ? parsed : null; }
function metricNumber(value: number | null, unit = "") { return value === null ? "—" : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value)}${unit ? ` ${unit}` : ""}`; }

function EvaluationPanel({ student, items, latestDetail, loading, creating, onClose, onCreate, onOpen, onRecommend }: { student: Student; items: EvaluationSummary[]; latestDetail: EvaluationWorkflow | null; loading: boolean; creating: boolean; onClose: () => void; onCreate: () => void; onOpen: (id: string) => void; onRecommend: (id: string) => void }) {
  const latest = items[0];
  const inProgress = items.find((item) => item.status === "IN_PROGRESS");
  const performed = items.filter((item) => item.status !== "IN_PROGRESS").length;
  const profileAge = calculateAgeAtDate(student.birthDate, latest?.date ?? "");
  const weight = latestDetail?.measurements.find((item) => item.measurementType === "WEIGHT")?.value ?? numeric(latestDetail?.generalData.weight);
  const height = numeric(latestDetail?.generalData.height) ?? (student.height > 0 ? student.height : null);
  const age = numeric(latestDetail?.generalData.ageSnapshot);
  const bodyFat = latestDetail?.measurements.find((item) => item.measurementType === "BODY_FAT")?.value ?? numeric(latestDetail?.generalData.bodyFatPercentage);
  const bmi = weight !== null && height !== null && height > 0 ? weight / (height * height) : null;
  const reassessment = latestDetail?.reassessmentDate || items.find((item) => item.reassessmentDate)?.reassessmentDate || "";
  const statusClass = latest?.status === "IN_PROGRESS" ? "text-yellow-300" : latest?.status === "REASSESSMENT_RECOMMENDED" ? "text-amber-300" : "text-emerald-300";
  return <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/90 p-2 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="evaluations-panel-title"><section className="mx-auto my-2 w-full max-w-5xl rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-white sm:my-6 sm:p-6"><header className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-yellow-400">Panel de evaluaciones</p><h2 id="evaluations-panel-title" className="mt-1 text-xl font-black">{student.firstName} {student.lastName}</h2><p className="mt-1 text-xs text-zinc-500">{studentServiceLabel(student.serviceType)} · {profileAge === null ? "Edad —" : `${profileAge} años`} · {student.height > 0 ? `${student.height} m` : "Altura —"} · {student.weight > 0 ? `${student.weight} kg` : "Peso —"}</p></div><button type="button" onClick={onClose} aria-label="Cerrar panel de evaluaciones" className="grid min-h-11 min-w-11 place-items-center rounded-lg border border-zinc-700 text-xl">×</button></header>
    <div className="mt-5 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 lg:grid-cols-5"><Stat label="Evaluaciones realizadas" value={String(performed)} /><Stat label="Progreso de la última" value={latest ? `${latest.completionPercentage}%` : "—"} /><Stat label="Última evaluación" value={latest ? formatDate(latest.date) : "—"} /><Stat label="Próxima reevaluación" value={reassessment ? formatDate(reassessment) : "—"} /><Stat label="Estado" value={latest ? statusLabel[latest.status] : "Sin evaluación"} valueClass={statusClass} /></div>
    <section className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-yellow-400">Resumen rápido</p><h3 className="mt-1 font-bold">Última evaluación completada</h3></div>{latestDetail && <button type="button" onClick={() => onOpen(latestDetail.id)} className="min-h-11 rounded-lg border border-zinc-700 px-3 text-sm font-bold text-yellow-300">Ver resumen completo</button>}</div>{latestDetail ? <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><Stat label="Peso" value={metricNumber(weight, "kg")} /><Stat label="Altura" value={metricNumber(height, "m")} /><Stat label="Edad registrada" value={age === null ? "—" : `${age} años`} /><Stat label="IMC" value={metricNumber(bmi)} /><Stat label="Grasa corporal" value={metricNumber(bodyFat, "%")} /><Stat label="Disponibilidad" value={latestDetail.weeklyAvailability || "—"} /><Stat label="Objetivo principal" value={latestDetail.primaryGoal || "—"} /><Stat label="Reevaluación" value={latestDetail.reassessmentDate ? formatDate(latestDetail.reassessmentDate) : "—"} /></div> : <p className="mt-3 text-sm text-zinc-500">{loading ? "Cargando resumen…" : "No hay una evaluación completada."}</p>}</section>
    <section className="mt-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">Historial</h3><div className="flex gap-2">{inProgress && <button type="button" onClick={() => onOpen(inProgress.id)} className="min-h-11 rounded-lg bg-yellow-400 px-3 text-sm font-bold text-zinc-950">Continuar evaluación</button>}<button type="button" disabled={creating || Boolean(inProgress)} onClick={onCreate} className="min-h-11 rounded-lg border border-yellow-400/35 px-3 text-sm font-bold text-yellow-300 disabled:opacity-40">Nueva evaluación</button></div></div><div className="mt-3 grid gap-2">{items.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-800 p-5 text-center text-sm text-zinc-500">Sin evaluaciones registradas.</p> : items.map((item) => <article key={item.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${item.status === "IN_PROGRESS" ? "border-yellow-400/30 bg-yellow-400/[.05]" : item.status === "REASSESSMENT_RECOMMENDED" ? "border-amber-400/25 bg-amber-400/[.04]" : "border-zinc-800 bg-zinc-900"}`}><div><p className="text-sm font-bold">Versión {item.version} · {formatDate(item.date)}</p><p className="mt-1 text-xs text-zinc-500">{statusLabel[item.status]} · {item.completionPercentage}% · {item.primaryGoal || "Objetivo —"} · {item.trainerName}</p></div><div className="flex gap-2">{item.status === "COMPLETED" && <button type="button" onClick={() => onRecommend(item.id)} className="min-h-11 rounded-lg border border-zinc-700 px-2 text-xs text-zinc-300">Reevaluar</button>}<button type="button" onClick={() => onOpen(item.id)} className="min-h-11 rounded-lg bg-zinc-800 px-3 text-sm font-bold text-yellow-300">{item.status === "IN_PROGRESS" ? "Continuar" : "Ver"}</button></div></article>)}</div></section></section></div>;
}

function Stat({ label, value, valueClass = "text-white" }: { label: string; value: string; valueClass?: string }) { return <div className="min-w-0 rounded-lg border border-zinc-800 bg-black/35 p-3"><p className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</p><p className={`mt-1 break-words text-lg font-black ${valueClass}`}>{value}</p></div>; }

function EvaluationWizard({ initial, baseUrl, profileWeight, profileHeight, birthDate, onClose }: { initial: EvaluationWorkflow; baseUrl: string; profileWeight: number; profileHeight: number; birthDate: string; onClose: () => void }) {
  const [value, setValue] = useState(initial);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const skipFirstSave = useRef(true);
  const requestNumber = useRef(0);
  const editRevision = useRef(0);
  const readonly = value.status !== "IN_PROGRESS";

  const saveNow = useCallback(async (candidate: EvaluationWorkflow) => {
    if (candidate.status !== "IN_PROGRESS") return candidate;
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
  }, [baseUrl]);

  useEffect(() => {
    if (readonly) return;
    if (skipFirstSave.current) { skipFirstSave.current = false; return; }
    setSaveState("idle");
    const timer = window.setTimeout(() => { void saveNow(value).catch(() => undefined); }, 900);
    return () => window.clearTimeout(timer);
  }, [value, readonly, saveNow]);

  function update(patch: Partial<EvaluationWorkflow>) { editRevision.current += 1; setValue((current) => ({ ...current, ...patch })); }
  function setObject(section: "generalData" | "habits" | "trainingObservations", key: string, fieldValue: unknown) { update({ [section]: { ...value[section], [key]: fieldValue } }); }
  function objectString(section: "generalData" | "habits" | "trainingObservations", key: string) { const current = value[section][key]; return typeof current === "string" || typeof current === "number" ? String(current) : ""; }
  function changeStep(step: number) { update({ currentStep: Math.max(1, Math.min(8, step)) }); }

  async function saveAndExit() {
    try { await saveNow(value); onClose(); } catch { /* El error visible permite reintentar. */ }
  }

  async function complete() {
    try {
      const saved = await saveNow(value);
      const fields = missingEssentialFields(saved);
      setMissing(fields);
      if (fields.length || !window.confirm("¿Completar la evaluación? Después quedará protegida contra cambios.")) return;
      const completed = await apiJson<EvaluationWorkflow>(`${baseUrl}/${value.id}/complete`, { method: "POST", body: "{}" });
      skipFirstSave.current = true; setValue(completed); setSaveState("saved"); setError("");
    } catch (cause) {
      const apiMissing = (cause as { body?: { missing?: string[] } })?.body?.missing;
      if (apiMissing) setMissing(apiMissing);
    }
  }

  const performedMobility = value.testResults.filter((item) => item.category === "MOBILITY" && item.status !== "NOT_PERFORMED").length;
  const performedPhysical = value.testResults.filter((item) => item.category === "PHYSICAL" && item.status !== "NOT_PERFORMED").length;

  return <div className="fixed inset-0 z-[70] bg-black/90 p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="evaluation-title">
    <section className="mx-auto flex h-[100dvh] w-full max-w-5xl flex-col overflow-hidden bg-zinc-950 text-white sm:h-[calc(100dvh-2rem)] sm:rounded-2xl sm:border sm:border-zinc-800">
      <header className="shrink-0 border-b border-zinc-800 px-4 py-3 sm:px-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-yellow-400">Evaluación — Versión {value.version}</p><h2 id="evaluation-title" className="mt-1 text-lg font-bold">{value.studentName}</h2><p className="mt-1 text-xs text-zinc-400">{statusLabel[value.status]} · {value.completionPercentage}% · {saveState === "saving" ? "Guardando…" : saveState === "saved" ? "Guardado" : saveState === "error" ? "Error al guardar" : "Cambios pendientes"}</p></div><button type="button" aria-label="Cerrar evaluación" onClick={readonly ? onClose : saveAndExit} className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-lg border border-zinc-700 text-xl">×</button></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full bg-yellow-400 transition-all" style={{ width: `${value.currentStep / 8 * 100}%` }} /></div><div className="mt-2 hidden grid-cols-8 gap-1 md:grid">{EVALUATION_STEPS.map((step, index) => <button type="button" key={step} onClick={() => changeStep(index + 1)} className={`min-h-11 rounded-md px-1 text-[10px] leading-tight ${value.currentStep === index + 1 ? "bg-yellow-400/15 font-bold text-yellow-300" : "text-zinc-500 hover:bg-zinc-900"}`}><span className="block">{index + 1}</span>{step}</button>)}</div><p className="mt-2 text-xs text-zinc-400 md:hidden">Paso {value.currentStep} de 8 — {EVALUATION_STEPS[value.currentStep - 1]}</p></header>
      <main className="flex-1 overflow-y-auto px-4 py-5 pb-28 sm:px-6"><fieldset disabled={readonly} className="disabled:opacity-80">
        {value.currentStep === 1 && <GeneralStep value={value} update={update} setObject={setObject} objectString={objectString} profileWeight={profileWeight} profileHeight={profileHeight} birthDate={birthDate} />}
        {value.currentStep === 2 && <GoalsStep value={value} update={update} setObject={setObject} objectString={objectString} />}
        {value.currentStep === 3 && <HabitsStep setObject={setObject} objectString={objectString} />}
        {value.currentStep === 4 && <ObservationsStep value={value} update={update} setObject={setObject} objectString={objectString} />}
        {value.currentStep === 5 && <TestsStep category="MOBILITY" value={value} update={update} />}
        {value.currentStep === 6 && <MeasurementsStep value={value} update={update} />}
        {value.currentStep === 7 && <TestsStep category="PHYSICAL" value={value} update={update} />}
        {value.currentStep === 8 && <SummaryStep value={value} update={update} performedMobility={performedMobility} performedPhysical={performedPhysical} missing={missing} />}
      </fieldset>{readonly && <p className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">Esta evaluación está en modo consulta y no puede modificarse.</p>}{error && <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}</main>
      <footer className="absolute inset-x-0 bottom-0 z-10 mx-auto flex w-full max-w-5xl items-center justify-between gap-2 border-t border-zinc-800 bg-zinc-950/95 p-3 pb-[calc(env(safe-area-inset-bottom)+.75rem)] backdrop-blur sm:static sm:pb-3"><button type="button" disabled={value.currentStep === 1} onClick={() => changeStep(value.currentStep - 1)} className="min-h-11 rounded-xl border border-zinc-700 px-4 text-sm font-bold disabled:opacity-30">Anterior</button>{!readonly && <button type="button" disabled={saveState === "saving"} onClick={saveAndExit} className="min-h-11 rounded-xl px-3 text-sm font-bold text-zinc-300 disabled:opacity-50">Guardar y salir</button>}{value.currentStep < 8 ? <button type="button" onClick={() => changeStep(value.currentStep + 1)} className="min-h-11 rounded-xl bg-yellow-400 px-5 text-sm font-bold text-zinc-950">Siguiente</button> : readonly ? <button type="button" onClick={onClose} className="min-h-11 rounded-xl bg-yellow-400 px-5 text-sm font-bold text-zinc-950">Cerrar</button> : <button type="button" disabled={saveState === "saving"} onClick={complete} className="min-h-11 rounded-xl bg-emerald-400 px-4 text-sm font-bold text-zinc-950 disabled:opacity-50">Completar</button>}</footer>
    </section>
  </div>;
}

type Update = (patch: Partial<EvaluationWorkflow>) => void;
type SetObject = (section: "generalData" | "habits" | "trainingObservations", key: string, value: unknown) => void;
type ObjectString = (section: "generalData" | "habits" | "trainingObservations", key: string) => string;
const field = `${inputClass} mt-1 min-h-11`;

function GeneralStep({ value, update, setObject, objectString, profileWeight, profileHeight, birthDate }: { value: EvaluationWorkflow; update: Update; setObject: SetObject; objectString: ObjectString; profileWeight: number; profileHeight: number; birthDate: string }) {
  const calculatedAge = calculateAgeAtDate(birthDate, value.date);
  const snapshotAge = numeric(value.generalData.ageSnapshot);
  function changeDate(date: string) { const ageSnapshot = birthDate ? calculateAgeAtDate(birthDate, date) : snapshotAge; update({ date, generalData: { ...value.generalData, ageSnapshot } }); }
  return <Step title="Información general" note="La edad queda guardada como snapshot histórico. La fecha de nacimiento del alumno no se modifica."><div className="grid gap-4 sm:grid-cols-2"><Label text="Fecha de evaluación *"><input type="date" required value={value.date} onChange={(event) => changeDate(event.target.value)} className={field} /></Label><Label text="Edad">{calculatedAge !== null ? <div className={`${field} flex items-center bg-zinc-900 text-zinc-200`} aria-label={`Edad calculada: ${calculatedAge} años`}>{calculatedAge} años <span className="ml-2 text-xs text-zinc-500">calculada desde el perfil</span></div> : <input type="number" min="0" max="120" value={snapshotAge ?? ""} onChange={(event) => setObject("generalData", "ageSnapshot", event.target.value === "" ? null : Number(event.target.value))} placeholder="Edad manual" className={field} />}</Label><Label text="Disponibilidad semanal *"><input value={value.weeklyAvailability} onChange={(event) => update({ weeklyAvailability: event.target.value })} placeholder="Ej. 3 días" className={field} /></Label><Label text="Peso actual (kg, opcional)"><input type="number" min="20" max="500" step="0.1" value={objectString("generalData", "weight")} onChange={(event) => setObject("generalData", "weight", event.target.value)} className={field} />{profileWeight > 0 && <button type="button" onClick={() => setObject("generalData", "weight", profileWeight)} className="mt-1 min-h-11 text-xs font-bold text-yellow-300">Usar {profileWeight} kg del perfil</button>}</Label><Label text="Altura (m, opcional)"><input type="number" min="0.8" max="2.5" step="0.01" value={objectString("generalData", "height")} onChange={(event) => setObject("generalData", "height", event.target.value)} className={field} />{profileHeight > 0 && <button type="button" onClick={() => setObject("generalData", "height", profileHeight)} className="mt-1 min-h-11 text-xs font-bold text-yellow-300">Usar {profileHeight} m del perfil</button>}</Label><Label text="Actividades o deportes actuales" wide><textarea rows={3} value={objectString("generalData", "activities")} onChange={(event) => setObject("generalData", "activities", event.target.value)} className={field} /></Label></div></Step>;
}

function GoalsStep({ value, update, setObject, objectString }: { value: EvaluationWorkflow; update: Update; setObject: SetObject; objectString: ObjectString }) {
  function toggle(goal: string) { update({ secondaryGoals: value.secondaryGoals.includes(goal) ? value.secondaryGoals.filter((item) => item !== goal) : [...value.secondaryGoals, goal] }); }
  return <Step title="Objetivo y experiencia" note="Elegí un objetivo principal y todos los secundarios que correspondan."><div className="grid gap-4 sm:grid-cols-2"><Label text="Objetivo principal *"><select value={value.primaryGoal} onChange={(event) => update({ primaryGoal: event.target.value })} className={field}><option value="">Seleccionar</option>{PRIMARY_GOALS.map((item) => <option key={item}>{item}</option>)}</select></Label><Label text="Nivel o experiencia *"><select value={value.experienceLevel} onChange={(event) => update({ experienceLevel: event.target.value })} className={field}><option value="">Seleccionar</option>{EXPERIENCE_LEVELS.map((item) => <option key={item}>{item}</option>)}</select></Label><div className="sm:col-span-2"><p className="text-sm">Objetivos secundarios (opcionales)</p><div className="mt-2 flex flex-wrap gap-2">{PRIMARY_GOALS.map((goal) => <label key={goal} className="flex min-h-11 items-center gap-2 rounded-lg border border-zinc-700 px-3 text-sm"><input type="checkbox" checked={value.secondaryGoals.includes(goal)} onChange={() => toggle(goal)} />{goal}</label>)}</div></div><Label text="Detalle de “Otro”"><input value={objectString("generalData", "otherGoal")} onChange={(event) => setObject("generalData", "otherGoal", event.target.value)} className={field} /></Label><Label text="Experiencia entrenando"><textarea rows={3} value={objectString("generalData", "experienceNotes")} onChange={(event) => setObject("generalData", "experienceNotes", event.target.value)} className={field} /></Label></div></Step>;
}

function HabitsStep({ setObject, objectString }: { setObject: SetObject; objectString: ObjectString }) {
  const select = (key: string, label: string, options: string[]) => <Label text={label}><select value={objectString("habits", key)} onChange={(event) => setObject("habits", key, event.target.value)} className={field}><option value="">Opcional</option>{options.map((item) => <option key={item}>{item}</option>)}</select></Label>;
  return <Step title="Hábitos y contexto" note="Bloque informativo. No genera diagnósticos ni recomendaciones clínicas."><div className="grid gap-4 sm:grid-cols-2">{select("dailyActivity", "Actividad diaria", ["Muy baja", "Baja", "Moderada", "Alta", "Muy alta"])}{select("jobType", "Tipo de trabajo", ["Sedentario", "Activo", "Mixto"])}<Label text="Horas de sueño"><input type="number" min="0" max="24" step="0.5" value={objectString("habits", "sleepHours")} onChange={(event) => setObject("habits", "sleepHours", event.target.value)} className={field} /></Label>{select("sleepQuality", "Calidad del sueño", ["Muy mala", "Mala", "Regular", "Buena", "Muy buena"])}{select("stress", "Nivel de estrés", ["Muy bajo", "Bajo", "Moderado", "Alto", "Muy alto"])}<Label text="Agua aproximada por día"><input value={objectString("habits", "water")} onChange={(event) => setObject("habits", "water", event.target.value)} placeholder="Ej. 2 litros" className={field} /></Label><Label text="Frecuencia de entrenamiento actual"><input value={objectString("habits", "trainingFrequency")} onChange={(event) => setObject("habits", "trainingFrequency", event.target.value)} className={field} /></Label><Label text="Observaciones" wide><textarea rows={4} value={objectString("habits", "notes")} onChange={(event) => setObject("habits", "notes", event.target.value)} className={field} /></Label></div></Step>;
}

function ObservationsStep({ value, update, setObject, objectString }: { value: EvaluationWorkflow; update: Update; setObject: SetObject; objectString: ObjectString }) {
  function add(zone: string) { if (!value.bodyIssues.some((item) => item.bodyZone === zone)) update({ bodyIssues: [...value.bodyIssues, emptyBodyIssue(zone)] }); }
  function patch(index: number, changes: Partial<EvaluationWorkflow["bodyIssues"][number]>) { update({ bodyIssues: value.bodyIssues.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item) }); }
  return <Step title="Observaciones relevantes para entrenar" note="Registrá molestias informadas o situaciones que deban considerarse al planificar. Esta interfaz no emite diagnósticos."><Label text="¿Hay alguna lesión, molestia, condición o situación que el entrenador deba conocer?"><textarea rows={4} value={objectString("trainingObservations", "description")} onChange={(event) => setObject("trainingObservations", "description", event.target.value)} className={field} /></Label><div className="mt-5"><p className="text-sm font-semibold">Mapa corporal simple · vista frontal y posterior</p><p className="mt-1 text-xs text-zinc-500">Tocá una zona para agregarla. Podés registrar varias y quitarlas.</p><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{BODY_ZONES.map((zone) => <button type="button" key={zone} onClick={() => add(zone)} className={`min-h-11 rounded-lg border px-2 text-left text-xs ${value.bodyIssues.some((item) => item.bodyZone === zone) ? "border-yellow-400 bg-yellow-400/10 text-yellow-200" : "border-zinc-700 bg-zinc-900"}`}>{zone}</button>)}</div></div><div className="mt-5 grid gap-3">{value.bodyIssues.map((issue, index) => <article key={`${issue.bodyZone}-${index}`} className="rounded-xl border border-zinc-700 bg-zinc-900 p-3"><div className="flex justify-between gap-3"><p className="font-semibold text-yellow-300">{issue.bodyZone}</p><button type="button" onClick={() => update({ bodyIssues: value.bodyIssues.filter((_, itemIndex) => itemIndex !== index) })} className="min-h-11 px-2 text-sm text-red-300">Quitar</button></div><div className="grid gap-3 sm:grid-cols-3"><Label text="Lado"><select value={issue.side} onChange={(event) => patch(index, { side: event.target.value })} className={field}><option value="RIGHT">Derecho</option><option value="LEFT">Izquierdo</option><option value="BOTH">Ambos</option><option value="CENTER">Central</option></select></Label><Label text="Estado"><select value={issue.status} onChange={(event) => patch(index, { status: event.target.value })} className={field}><option value="NOT_SPECIFIED">No especificado</option><option value="CURRENT">Actual</option><option value="RECURRENT">Recurrente</option><option value="RESOLVED">Resuelto</option></select></Label><Label text="Intensidad percibida (0–10)"><input type="number" min="0" max="10" value={issue.intensity ?? ""} onChange={(event) => patch(index, { intensity: event.target.value === "" ? null : Number(event.target.value) })} className={field} /></Label><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={issue.hasPain} onChange={(event) => patch(index, { hasPain: event.target.checked })} /> Molestia actual informada</label><Label text="Descripción"><input value={issue.studentDescription} onChange={(event) => patch(index, { studentDescription: event.target.value })} className={field} /></Label><Label text="Momento aproximado"><input value={issue.approximateDate} onChange={(event) => patch(index, { approximateDate: event.target.value })} className={field} /></Label><Label text="Observación del entrenador" wide><textarea rows={2} value={issue.trainerObservation} onChange={(event) => patch(index, { trainerObservation: event.target.value })} className={field} /></Label></div></article>)}</div></Step>;
}

function MeasurementsStep({ value, update }: { value: EvaluationWorkflow; update: Update }) {
  function current(type: string, side: string | null) { return value.measurements.find((item) => item.measurementType === type && item.side === side); }
  function setMeasurement(type: string, side: string | null, unit: string, raw: string) {
    const rest = value.measurements.filter((item) => !(item.measurementType === type && item.side === side));
    if (!raw) return update({ measurements: rest });
    const measurement: EvaluationMeasurementValue = { measurementType: type, side, unit, value: Number(raw), notes: current(type, side)?.notes ?? "" };
    update({ measurements: [...rest, measurement] });
  }
  return <Step title="Medidas corporales" note="Todas son opcionales. Los valores quedan guardados en esta versión y no reemplazan mediciones anteriores."><div className="grid gap-4 sm:grid-cols-2">{MEASUREMENT_DEFINITIONS.flatMap((definition) => ("sides" in definition && definition.sides ? ["RIGHT", "LEFT"] : [null]).map((side) => { const item = current(definition.key, side); return <Label key={`${definition.key}-${side}`} text={`${definition.label}${side === "RIGHT" ? " derecho" : side === "LEFT" ? " izquierdo" : ""} (${definition.unit})`}><input type="number" min={definition.min} max={definition.max} step="0.1" value={item?.value ?? ""} onChange={(event) => setMeasurement(definition.key, side, definition.unit, event.target.value)} className={field} /></Label>; }) )}</div><Label text="Observaciones de medidas"><textarea rows={4} value={String(value.generalData.measurementNotes ?? "")} onChange={(event) => update({ generalData: { ...value.generalData, measurementNotes: event.target.value } })} className={field} /></Label></Step>;
}

function TestsStep({ category, value, update }: { category: EvaluationTestCategory; value: EvaluationWorkflow; update: Update }) {
  const definitions = TEST_DEFINITIONS.filter((item) => item.category === category);
  function result(key: string) { return value.testResults.find((item) => item.testKey === key && item.category === category); }
  function patch(key: string, changes: Partial<EvaluationTestValue>) { const current = result(key) ?? emptyTest(key, category); update({ testResults: [...value.testResults.filter((item) => !(item.testKey === key && item.category === category)), { ...current, ...changes }] }); }
  return <Step title={category === "MOBILITY" ? "Movilidad y control motor" : "Tests físicos"} note={category === "MOBILITY" ? "Protocolos compactos para observación del entrenador." : "Pruebas submáximas. No se generan clasificaciones clínicas."}><div className="grid gap-3">{definitions.map((definition) => { const item = result(definition.key) ?? emptyTest(definition.key, category); return <details key={definition.key} className="rounded-xl border border-zinc-700 bg-zinc-900 p-3" open={item.status !== "NOT_PERFORMED"}><summary className="cursor-pointer list-none font-semibold text-yellow-300">{definition.name}<span className="ml-2 text-xs font-normal text-zinc-500">{definition.area} · {testStatusOptions.find(([key]) => key === item.status)?.[1]}</span></summary><div className="mt-3 rounded-lg bg-zinc-950 p-3 text-xs text-zinc-400"><p>{definition.protocol}</p><p className="mt-1">Material: {definition.material}</p></div><div className="mt-3 grid gap-3 sm:grid-cols-3"><Label text="Estado"><select value={item.status} onChange={(event) => patch(definition.key, { status: event.target.value })} className={field}>{testStatusOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Label><Label text={`Resultado (${definition.unit || "categoría"})`}><input type="number" step="0.1" value={item.numericValue ?? ""} onChange={(event) => patch(definition.key, { numericValue: event.target.value === "" ? null : Number(event.target.value), unit: definition.unit })} className={field} /></Label><Label text="Variante o adaptación"><input value={item.variation} onChange={(event) => patch(definition.key, { variation: event.target.value })} className={field} /></Label><Label text={`Derecha (${definition.unit || "valor"})`}><input type="number" step="0.1" value={item.rightValue ?? ""} onChange={(event) => patch(definition.key, { rightValue: event.target.value === "" ? null : Number(event.target.value), rightUnit: definition.unit })} className={field} /></Label><Label text={`Izquierda (${definition.unit || "valor"})`}><input type="number" step="0.1" value={item.leftValue ?? ""} onChange={(event) => patch(definition.key, { leftValue: event.target.value === "" ? null : Number(event.target.value), leftUnit: definition.unit })} className={field} /></Label><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={item.pain} onChange={(event) => patch(definition.key, { pain: event.target.checked })} /> Molestia informada</label><Label text="Compensaciones observadas"><textarea rows={2} value={item.compensations} onChange={(event) => patch(definition.key, { compensations: event.target.value })} className={field} /></Label><Label text="Observaciones"><textarea rows={2} value={item.observations} onChange={(event) => patch(definition.key, { observations: event.target.value })} className={field} /></Label>{item.status === "NOT_PERFORMED" && <Label text="Motivo de no realización"><input value={item.notPerformedReason} onChange={(event) => patch(definition.key, { notPerformedReason: event.target.value })} className={field} /></Label>}</div></details>; })}</div></Step>;
}

function SummaryStep({ value, update, performedMobility, performedPhysical, missing }: { value: EvaluationWorkflow; update: Update; performedMobility: number; performedPhysical: number; missing: string[] }) {
  const currentMissing = missing.length ? missing : missingEssentialFields(value);
  return <Step title="Resumen final" note="Las conclusiones son manuales y sirven para planificar el entrenamiento."><div className="grid gap-2 sm:grid-cols-3"><Summary label="Objetivo" value={value.primaryGoal || "Pendiente"} /><Summary label="Experiencia" value={value.experienceLevel || "Pendiente"} /><Summary label="Molestias registradas" value={String(value.bodyIssues.length)} /><Summary label="Medidas registradas" value={String(value.measurements.length)} /><Summary label="Movilidad" value={`${performedMobility} de 8 realizados`} /><Summary label="Tests físicos" value={`${performedPhysical} de 7 realizados`} /></div>{currentMissing.length > 0 && <div role="alert" className="mt-4 rounded-xl border border-yellow-400/30 bg-yellow-400/10 p-3"><p className="font-semibold text-yellow-200">Falta información esencial</p><ul className="mt-2 list-disc pl-5 text-sm text-yellow-100">{currentMissing.map((item) => <li key={item}>{item}</li>)}</ul></div>}<div className="mt-5 grid gap-4 sm:grid-cols-2"><Label text="Fortalezas observadas"><textarea rows={3} value={value.finalStrengths} onChange={(event) => update({ finalStrengths: event.target.value })} className={field} /></Label><Label text="Prioridades observadas"><textarea rows={3} value={value.finalPriorities} onChange={(event) => update({ finalPriorities: event.target.value })} className={field} /></Label><Label text="Limitaciones observadas"><textarea rows={3} value={value.finalLimitations} onChange={(event) => update({ finalLimitations: event.target.value })} className={field} /></Label><Label text="Observaciones para planificar"><textarea rows={3} value={value.planningNotes} onChange={(event) => update({ planningNotes: event.target.value })} className={field} /></Label><Label text="Fecha sugerida de reevaluación"><input type="date" value={value.reassessmentDate} onChange={(event) => update({ reassessmentDate: event.target.value })} className={field} /></Label><Label text="Observación final del entrenador *"><textarea rows={4} value={value.finalComment} onChange={(event) => update({ finalComment: event.target.value })} className={field} /></Label></div></Step>;
}

function Step({ title, note, children }: { title: string; note: string; children: React.ReactNode }) { return <div><h3 className="text-xl font-bold">{title}</h3><p className="mt-1 text-sm leading-relaxed text-zinc-400">{note}</p><div className="mt-5">{children}</div></div>; }
function Label({ text, wide = false, children }: { text: string; wide?: boolean; children: React.ReactNode }) { return <label className={`block text-sm ${wide ? "sm:col-span-2" : ""}`}>{text}{children}</label>; }
function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>; }
