"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ModuleShell, inputClass } from "@/componentes/module-shell";
import { TrainerFloatingActions } from "@/componentes/trainer-floating-actions";
import { EvaluationBodyMap, EvaluationLineChart, EvaluationStatusSummary, EvaluationTests } from "@/componentes/evaluation-insights";
import { BMProgressCard, EvaluationComparisonPanel, EvaluationSymmetryPanel } from "@/componentes/evaluation-progress-panels";
import { EvaluationWizard } from "@/componentes/student-evaluations";
import { calculateAgeAtDate } from "@/lib/evaluation-workflow";
import { interpretEvaluation } from "@/lib/evaluation-interpretation";
import { compareEvaluations } from "@/lib/evaluation-progress";
import { filterEvaluationStudents, type EvaluationServiceFilter, type EvaluationStatusFilter } from "@/lib/evaluation-student-filter";
import { buildEvaluationWorkspaceStudents, evaluationSequenceLabel, type EvaluationListItem, type EvaluationWorkspaceStudent } from "@/lib/evaluation-workspace";
import type { NormalizedEvaluation } from "@/types/evaluation-read-model";
import type { EvaluationStudentSummary } from "@/types/evaluation-progress";
import type { EvaluationWorkflow } from "@/types/evaluation-workflow";

type WorkspaceTab = "summary" | "evaluations" | "progress" | "record";
type SummaryPayload = { students: EvaluationStudentSummary[]; evaluations: EvaluationListItem[] };
type DetailPayload = { evaluations: NormalizedEvaluation[] };

const serviceLabel = { CLASSES: "Clases", PERSONALIZED: "Personalizado", MIXED: "Mixto" } as const;
const statusLabel = { "": "Sin evaluación", IN_PROGRESS: "En curso", COMPLETED: "Completada", REASSESSMENT_RECOMMENDED: "Reevaluación pendiente" } as const;
const tabLabel: Record<WorkspaceTab, string> = { summary: "Resumen", evaluations: "Evaluaciones", progress: "Progreso", record: "Ficha" };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
const showDate = (date: string) => date ? new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)) : "Sin programar";
const number = (value: number | null, unit = "") => value === null ? "—" : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value)}${unit ? ` ${unit}` : ""}`;
const signed = (value: number | null, unit = "") => value === null ? "—" : `${value > 0 ? "+" : ""}${number(value, unit)}`;
const daysBetween = (from: string, to: string) => Math.max(0, Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000));

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "La solicitud no pudo completarse.");
  return body;
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-white/[.08] bg-[linear-gradient(145deg,rgba(24,24,27,.96),rgba(8,8,10,.98))] shadow-[0_18px_45px_rgba(0,0,0,.22)] ${className}`}>{children}</section>;
}

function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "gold" | "green" | "amber" }) {
  const tones = { neutral: "border-zinc-700 text-zinc-300", gold: "border-yellow-400/30 bg-yellow-400/[.06] text-yellow-300", green: "border-emerald-400/25 bg-emerald-400/[.05] text-emerald-300", amber: "border-amber-400/25 bg-amber-400/[.05] text-amber-300" };
  return <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-[10px] font-bold uppercase tracking-[.08em] ${tones[tone]}`}>{children}</span>;
}

function StatusBadge({ status, pending = false }: { status: EvaluationListItem["status"] | ""; pending?: boolean }) {
  const tone = pending || status === "REASSESSMENT_RECOMMENDED" ? "amber" : status === "COMPLETED" ? "green" : status === "IN_PROGRESS" ? "gold" : "neutral";
  return <Badge tone={tone}>{pending ? "Reevaluación pendiente" : statusLabel[status]}</Badge>;
}

function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return <div className="min-w-0 rounded-xl border border-white/[.06] bg-black/25 p-3"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-zinc-500">{label}</p><div className="mt-1.5 break-words text-lg font-black text-zinc-100">{value}</div>{note && <p className="mt-1 text-[11px] text-zinc-500">{note}</p>}</div>;
}

function Accordion({ title, subtitle, children, open = false }: { title: string; subtitle?: string; children: ReactNode; open?: boolean }) {
  return <details open={open} className="group rounded-xl border border-white/[.07] bg-black/25"><summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"><span><span className="block text-sm font-bold text-zinc-100">{title}</span>{subtitle && <span className="mt-0.5 block text-xs text-zinc-500">{subtitle}</span>}</span><span aria-hidden="true" className="text-lg text-yellow-400 transition group-open:rotate-90">›</span></summary><div className="border-t border-white/[.07] p-4">{children}</div></details>;
}

function ActionButton({ children, onClick, disabled = false, primary = false }: { children: ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`min-h-11 rounded-xl px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${primary ? "bg-yellow-400 text-zinc-950 hover:bg-yellow-300" : "border border-zinc-700 bg-zinc-900/80 text-zinc-200 hover:border-yellow-400/35 hover:text-yellow-200"}`}>{children}</button>;
}

function Overlay({ title, close, children, wide = false }: { title: string; close: () => void; children: ReactNode; wide?: boolean }) {
  return <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/85 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-labelledby="evaluation-overlay-title"><section className={`mx-auto my-2 w-full ${wide ? "max-w-4xl" : "max-w-lg"} rounded-2xl border border-zinc-700/80 bg-zinc-950 p-4 text-white shadow-2xl sm:my-8 sm:p-6`}><header className="flex items-start justify-between gap-4"><h2 id="evaluation-overlay-title" className="text-lg font-black">{title}</h2><button type="button" onClick={close} aria-label="Cerrar" className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-zinc-700 text-xl text-zinc-300">×</button></header>{children}</section></div>;
}

export function ProfessionalEvaluationsDashboard() {
  const [summary, setSummary] = useState<SummaryPayload>({ students: [], evaluations: [] });
  const [history, setHistory] = useState<NormalizedEvaluation[]>([]);
  const [studentId, setStudentId] = useState("");
  const [tab, setTab] = useState<WorkspaceTab>("summary");
  const [query, setQuery] = useState("");
  const [service, setService] = useState<EvaluationServiceFilter>("ALL");
  const [status, setStatus] = useState<EvaluationStatusFilter>("ALL");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<EvaluationWorkflow | null>(null);
  const [selectedEvaluationId, setSelectedEvaluationId] = useState("");
  const [menuId, setMenuId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<NormalizedEvaluation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadSummary = useCallback(async () => {
    const payload = await apiJson<SummaryPayload>("/api/admin/evaluaciones/progreso?view=summary");
    setSummary(payload);
    return payload;
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    if (!id) { setHistory([]); return; }
    setDetailLoading(true);
    try {
      const payload = await apiJson<DetailPayload>(`/api/admin/evaluaciones/progreso?studentId=${encodeURIComponent(id)}`);
      setHistory([...payload.evaluations].sort((left, right) => right.date.localeCompare(left.date) || right.version - left.version));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar la ficha del alumno.");
    } finally { setDetailLoading(false); }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("studentId") ?? "";
    const requestedAction = params.get("accion");
    const timer = window.setTimeout(() => {
      loadSummary().then((payload) => {
        if (requested && payload.students.some((student) => student.id === requested)) {
          setStudentId(requested);
          if (requestedAction === "nueva") window.setTimeout(() => void createEvaluation("", requested), 0);
        }
        setError("");
      }).catch((cause: Error) => setError(cause.message)).finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  // La creación usa el flujo actual después de resolver el alumno inicial desde la URL.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadSummary]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadDetail(studentId); }, 0);
    return () => window.clearTimeout(timer);
  }, [studentId, loadDetail]);

  const students = useMemo(() => buildEvaluationWorkspaceStudents(summary.students, summary.evaluations, today()), [summary]);
  const matches = useMemo(() => filterEvaluationStudents(students, { query, service, status, validity: "ALL" }), [students, query, service, status]);
  const student = students.find((item) => item.id === studentId);
  const latest = history[0];
  const initial = history.at(-1);
  const currentInterpretation = latest ? interpretEvaluation(latest, today()) : null;
  const latestComparison = latest && history[1] ? compareEvaluations(history[1], latest, today()) : null;
  const fullComparison = latest && initial && latest.id !== initial.id ? compareEvaluations(initial, latest, today()) : null;
  const selectedEvaluation = history.find((item) => item.id === selectedEvaluationId) ?? null;

  function chooseStudent(id: string) {
    setStudentId(id); setTab("summary"); setSelectedEvaluationId(""); setNotice(""); setMenuId("");
    const url = new URL(window.location.href); url.searchParams.set("studentId", id); window.history.replaceState({}, "", url);
  }

  function closeStudent() {
    setStudentId(""); setHistory([]); setSelectedEvaluationId("");
    const url = new URL(window.location.href); url.searchParams.delete("studentId"); window.history.replaceState({}, "", url);
  }

  async function openEditor(evaluationId: string) {
    if (!studentId) return;
    try {
      setEditor(await apiJson<EvaluationWorkflow>(`/api/admin/alumnos/${studentId}/evaluaciones/${evaluationId}`));
      setError(""); setMenuId("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo abrir la evaluación."); }
  }

  async function createEvaluation(baseEvaluationId = "", targetStudentId = studentId) {
    if (!targetStudentId || creating) return;
    setCreating(true); setNotice("");
    try {
      const creationKey = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
      const created = await apiJson<EvaluationWorkflow>(`/api/admin/alumnos/${targetStudentId}/evaluaciones`, { method: "POST", body: JSON.stringify({ creationKey, ...(baseEvaluationId ? { baseEvaluationId } : {}) }) });
      setEditor(created); setMenuId("");
      if (baseEvaluationId) setNotice("Se creó un borrador nuevo con la estructura y los protocolos, sin copiar resultados medidos.");
      await Promise.all([loadSummary(), loadDetail(targetStudentId)]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo crear la evaluación."); }
    finally { setCreating(false); }
  }

  async function deleteEvaluation() {
    if (!studentId || !deleteTarget || deleting) return;
    setDeleting(true); setError("");
    try {
      await apiJson(`/api/admin/alumnos/${studentId}/evaluaciones/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null); setSelectedEvaluationId(""); setNotice("La evaluación se eliminó y la ficha fue recalculada.");
      await Promise.all([loadSummary(), loadDetail(studentId)]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo eliminar la evaluación. Intentá nuevamente."); }
    finally { setDeleting(false); }
  }

  async function closeEditor() {
    setEditor(null);
    await Promise.all([loadSummary(), loadDetail(studentId)]).catch(() => undefined);
  }

  function startNewEvaluation() {
    if (studentId) {
      void createEvaluation();
      return;
    }
    requestAnimationFrame(() => {
      const search = document.getElementById("evaluation-student-search");
      search?.scrollIntoView({ block: "center", behavior: "smooth" });
      search?.focus();
    });
  }

  if (loading) return <ModuleShell title="Evaluaciones" subtitle="Alumnos personalizados y mixtos"><Card className="p-5"><p className="text-sm text-zinc-400">Cargando fichas de alumnos…</p></Card></ModuleShell>;

  return <ModuleShell title="Evaluaciones" subtitle="Alumnos personalizados y mixtos">
    {error && <p role="alert" className="mb-4 rounded-xl border border-red-400/25 bg-red-400/[.08] p-3 text-sm text-red-200">{error}</p>}
    {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-400/[.06] p-3 text-sm text-emerald-200">{notice}</p>}
    {!studentId ? <StudentDirectory students={matches} query={query} service={service} status={status} onQuery={setQuery} onService={setService} onStatus={setStatus} onChoose={chooseStudent} onCreate={(id) => { chooseStudent(id); window.setTimeout(() => void createEvaluation("", id), 0); }} /> : student ? <StudentWorkspace student={student} history={history} loading={detailLoading} tab={tab} setTab={setTab} latest={latest} initial={initial} latestComparison={latestComparison} fullComparison={fullComparison} interpretation={currentInterpretation} menuId={menuId} setMenuId={setMenuId} creating={creating} onBack={closeStudent} onCreate={() => void createEvaluation()} onView={(id) => { setSelectedEvaluationId(id); setMenuId(""); }} onEdit={(id) => void openEditor(id)} onDuplicate={(id) => void createEvaluation(id)} onDelete={(item) => { setDeleteTarget(item); setMenuId(""); }} /> : <Card className="p-5"><p className="text-sm text-zinc-400">El alumno seleccionado ya no está disponible.</p><div className="mt-4"><ActionButton onClick={closeStudent}>Volver al listado</ActionButton></div></Card>}

    {selectedEvaluation && <EvaluationDetail evaluation={selectedEvaluation} history={history} onClose={() => setSelectedEvaluationId("")} onEdit={() => void openEditor(selectedEvaluation.id)} />}
    {deleteTarget && <Overlay title="Eliminar evaluación" close={() => !deleting && setDeleteTarget(null)}><p className="mt-5 text-sm leading-6 text-zinc-300">¿Querés eliminar la evaluación del <strong className="text-white">{showDate(deleteTarget.date)}</strong>?</p><p className="mt-3 rounded-xl border border-red-400/15 bg-red-400/[.05] p-3 text-sm text-zinc-400">Se eliminarán los datos asociados exclusivamente a esta evaluación. Esta acción no se puede deshacer.</p><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><ActionButton onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancelar</ActionButton><button type="button" disabled={deleting} onClick={() => void deleteEvaluation()} className="min-h-11 rounded-xl border border-red-400/35 bg-red-400/10 px-4 text-sm font-bold text-red-200 disabled:opacity-50">{deleting ? "Eliminando…" : "Eliminar evaluación"}</button></div></Overlay>}
    {editor && <EvaluationWizard initial={editor} baseUrl={`/api/admin/alumnos/${editor.studentId}/evaluaciones`} profileWeight={0} profileHeight={0} birthDate={student?.birthDate ?? ""} onClose={() => void closeEditor()} />}
    <TrainerFloatingActions mode="direct" enabled={!editor && !selectedEvaluation && !deleteTarget && !creating} actions={[{ label: "Nueva evaluación", symbol: "+", onSelect: startNewEvaluation }]} />
  </ModuleShell>;
}

function StudentDirectory({ students, query, service, status, onQuery, onService, onStatus, onChoose, onCreate }: { students: EvaluationWorkspaceStudent[]; query: string; service: EvaluationServiceFilter; status: EvaluationStatusFilter; onQuery: (value: string) => void; onService: (value: EvaluationServiceFilter) => void; onStatus: (value: EvaluationStatusFilter) => void; onChoose: (id: string) => void; onCreate: (id: string) => void }) {
  const serviceFilters: Array<[EvaluationServiceFilter, string]> = [["ALL", "Todos"], ["PERSONALIZED", "Personalizados"], ["MIXED", "Mixtos"]];
  const statusFilters: Array<[EvaluationStatusFilter, string]> = [["ALL", "Todos"], ["NONE", "Sin evaluación"], ["IN_PROGRESS", "En curso"], ["COMPLETED", "Completadas"], ["REASSESSMENT_RECOMMENDED", "Reevaluación pendiente"]];
  return <div className="space-y-4">
    <Card className="p-3 sm:p-4"><label htmlFor="evaluation-student-search" className="sr-only">Buscar alumno</label><div className="relative"><span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">⌕</span><input id="evaluation-student-search" type="search" value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Buscar alumno..." className={`${inputClass} pl-9`} /></div><FilterRow label="Servicio" values={serviceFilters} selected={service} choose={(value) => onService(value as EvaluationServiceFilter)} /><FilterRow label="Estado" values={statusFilters} selected={status} choose={(value) => onStatus(value as EvaluationStatusFilter)} /></Card>
    <div aria-label="Resultados de alumnos" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{students.length ? students.map((student) => <StudentCard key={student.id} student={student} onChoose={() => onChoose(student.id)} onCreate={() => onCreate(student.id)} />) : <Card className="p-8 text-center md:col-span-2 xl:col-span-3"><p className="text-sm text-zinc-400">No hay alumnos que coincidan con la búsqueda y los filtros.</p></Card>}</div>
  </div>;
}

function FilterRow({ label, values, selected, choose }: { label: string; values: Array<[string, string]>; selected: string; choose: (value: string) => void }) {
  return <div className="mt-3"><p className="mb-2 text-[10px] font-bold uppercase tracking-[.14em] text-zinc-600">{label}</p><div className="flex flex-wrap gap-2" role="group" aria-label={`Filtrar por ${label.toLowerCase()}`}>{values.map(([value, text]) => <button type="button" key={value} aria-pressed={selected === value} onClick={() => choose(value)} className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition ${selected === value ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-200" : "border-zinc-800 bg-black/25 text-zinc-400 hover:border-zinc-600"}`}>{text}</button>)}</div></div>;
}

function StudentCard({ student, onChoose, onCreate }: { student: EvaluationWorkspaceStudent; onChoose: () => void; onCreate: () => void }) {
  const pending = student.validity === "REASSESSMENT_RECOMMENDED";
  return <Card className="flex min-h-56 flex-col p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-base font-black">{student.firstName} {student.lastName}</h2><div className="mt-2"><Badge>{serviceLabel[student.serviceType]}</Badge></div></div><StatusBadge status={student.latestStatus} pending={pending} /></div><div className="mt-4 flex-1 space-y-2 text-sm"><p><span className="text-zinc-500">Objetivo:</span> <span className="text-zinc-300">{student.latestGoal || "Sin registro"}</span></p>{student.evaluationCount ? <><p><span className="text-zinc-500">Última evaluación:</span> <span className="text-zinc-300">{showDate(student.latestDate)}</span></p><p className="text-xs text-zinc-500">{student.evaluationCount} {student.evaluationCount === 1 ? "evaluación" : "evaluaciones"} · {pending ? "Reevaluación pendiente" : statusLabel[student.latestStatus]}</p></> : <p className="text-sm text-zinc-500">Sin evaluación</p>}</div><button type="button" onClick={student.evaluationCount ? onChoose : onCreate} className="mt-4 min-h-11 w-full rounded-xl border border-yellow-400/25 bg-yellow-400/[.05] px-4 text-sm font-bold text-yellow-200 transition hover:border-yellow-400/50">{student.evaluationCount ? "Abrir ficha" : "Iniciar evaluación"}</button></Card>;
}

function StudentWorkspace({ student, history, loading, tab, setTab, latest, initial, latestComparison, fullComparison, interpretation, menuId, setMenuId, creating, onBack, onCreate, onView, onEdit, onDuplicate, onDelete }: { student: EvaluationWorkspaceStudent; history: NormalizedEvaluation[]; loading: boolean; tab: WorkspaceTab; setTab: (tab: WorkspaceTab) => void; latest?: NormalizedEvaluation; initial?: NormalizedEvaluation; latestComparison: ReturnType<typeof compareEvaluations> | null; fullComparison: ReturnType<typeof compareEvaluations> | null; interpretation: ReturnType<typeof interpretEvaluation> | null; menuId: string; setMenuId: (id: string) => void; creating: boolean; onBack: () => void; onCreate: () => void; onView: (id: string) => void; onEdit: (id: string) => void; onDuplicate: (id: string) => void; onDelete: (item: NormalizedEvaluation) => void }) {
  const age = calculateAgeAtDate(student.birthDate, latest?.date ?? today());
  return <div className="space-y-4"><button type="button" onClick={onBack} className="min-h-11 rounded-xl px-1 text-sm font-bold text-zinc-400 hover:text-white">← Volver a alumnos</button><Card className="overflow-hidden"><header className="p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-black sm:text-2xl">{student.firstName} {student.lastName}</h2><Badge>{serviceLabel[student.serviceType]}</Badge></div><p className="mt-2 text-sm text-zinc-400">{age === null ? "Edad sin informar" : `${age} años`} · <span className="text-zinc-500">Objetivo:</span> {latest?.primaryGoal || student.goal || "Sin registro"}</p></div><ActionButton onClick={onCreate} disabled={creating || student.serviceType === "CLASSES"} primary>{creating ? "Creando…" : "+ Nueva evaluación"}</ActionButton></div></header><nav aria-label="Secciones de la ficha" className="overflow-x-auto border-t border-white/[.07]"><div className="flex min-w-max px-2 sm:px-4">{(Object.keys(tabLabel) as WorkspaceTab[]).map((item) => <button type="button" key={item} onClick={() => setTab(item)} aria-current={tab === item ? "page" : undefined} className={`min-h-12 min-w-24 border-b-2 px-3 text-xs font-bold transition sm:min-w-32 sm:text-sm ${tab === item ? "border-yellow-400 text-yellow-300" : "border-transparent text-zinc-500 hover:text-zinc-200"}`}>{tabLabel[item]}</button>)}</div></nav></Card>{loading ? <Card className="p-5"><p className="text-sm text-zinc-400">Cargando ficha…</p></Card> : tab === "summary" ? <SummaryTab history={history} latest={latest} initial={initial} comparison={latestComparison} interpretation={interpretation} onCreate={onCreate} creating={creating} /> : tab === "evaluations" ? <EvaluationsTab history={history} menuId={menuId} setMenuId={setMenuId} onCreate={onCreate} onView={onView} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete} creating={creating} /> : tab === "progress" ? <ProgressTab history={history} latestComparison={latestComparison} fullComparison={fullComparison} /> : <ProfessionalRecord latest={latest} previous={history[1]} comparison={latestComparison} interpretation={interpretation} />}</div>;
}

function SummaryTab({ history, latest, initial, comparison, interpretation, onCreate, creating }: { history: NormalizedEvaluation[]; latest?: NormalizedEvaluation; initial?: NormalizedEvaluation; comparison: ReturnType<typeof compareEvaluations> | null; interpretation: ReturnType<typeof interpretEvaluation> | null; onCreate: () => void; creating: boolean }) {
  if (!latest) return <Card className="p-8 text-center"><p className="text-sm text-zinc-400">Todavía no tiene evaluaciones.</p><div className="mt-4"><ActionButton onClick={onCreate} disabled={creating} primary>{creating ? "Creando…" : "Iniciar evaluación"}</ActionButton></div></Card>;
  const next = latest.reassessmentDate;
  const overdue = Boolean(next && next < today()) || latest.status === "REASSESSMENT_RECOMMENDED";
  return <div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]"><Card className="p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-yellow-400">Resumen rápido</p><p className="mt-2 text-sm text-zinc-400">Seguimiento esencial, sin mezclar el detalle clínico ni los gráficos.</p></div><ActionButton onClick={onCreate} disabled={creating} primary>+ Nueva evaluación</ActionButton></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3"><Stat label="Evaluaciones" value={history.length} /><Stat label="Última" value={`Hace ${daysBetween(latest.date, today())} días`} note={showDate(latest.date)} /><Stat label="Prioridades" value={interpretation?.priorities.length ?? 0} /><Stat label="Alertas" value={interpretation?.alerts.length ?? 0} /><Stat label="Próxima reevaluación" value={next ? showDate(next) : "Sin programar"} note={overdue ? "Vencida / pendiente" : undefined} /><Stat label="Estado" value={<span className="text-sm">{statusLabel[latest.status]}</span>} /></div></Card><Card className="p-4 sm:p-5"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-zinc-500">Estado actual</p><div className="mt-4 grid grid-cols-2 gap-2"><Stat label="Peso actual" value={number(latest.weight, "kg")} /><Stat label="Cambio desde inicial" value={signed(initial && latest.id !== initial.id && initial.weight !== null && latest.weight !== null ? Math.round((latest.weight - initial.weight) * 10) / 10 : null, "kg")} /><Stat label="Grasa corporal" value={number(latest.bodyFatPercentage, "%")} /><Stat label="Índice BM" value={comparison?.progress.available ? `${comparison.progress.score}/100` : "—"} /></div></Card></div>;
}

function EvaluationsTab({ history, menuId, setMenuId, onCreate, onView, onEdit, onDuplicate, onDelete, creating }: { history: NormalizedEvaluation[]; menuId: string; setMenuId: (id: string) => void; onCreate: () => void; onView: (id: string) => void; onEdit: (id: string) => void; onDuplicate: (id: string) => void; onDelete: (item: NormalizedEvaluation) => void; creating: boolean }) {
  return <Card className="p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-yellow-400">Evaluaciones</p><h3 className="mt-1 text-lg font-black">Historial cronológico</h3></div><ActionButton onClick={onCreate} disabled={creating} primary>+ Nueva evaluación</ActionButton></div>{history.length ? <div className="mt-4 space-y-3">{history.map((item) => { const sourcePhysical = item.source === "PHYSICAL"; return <article key={item.id} className="relative rounded-xl border border-white/[.07] bg-black/25 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-yellow-400">{showDate(item.date)}</p><div className="mt-1 flex flex-wrap items-center gap-2"><h4 className="font-black">{evaluationSequenceLabel(history.map((entry) => ({ ...entry, source: entry.source })), item.id)}</h4><StatusBadge status={item.status} /></div></div><button type="button" aria-label={`Acciones de ${evaluationSequenceLabel(history.map((entry) => ({ ...entry, source: entry.source })), item.id)}`} aria-haspopup="menu" aria-expanded={menuId === item.id} onClick={() => setMenuId(menuId === item.id ? "" : item.id)} className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-zinc-700 text-xl text-zinc-300">•••</button></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3"><p><span className="block text-zinc-600">Peso</span><strong className="mt-1 block text-zinc-300">{number(item.weight, "kg")}</strong></p><p><span className="block text-zinc-600">Objetivo</span><strong className="mt-1 block truncate text-zinc-300">{item.primaryGoal || "—"}</strong></p><p><span className="block text-zinc-600">Completitud</span><strong className="mt-1 block text-zinc-300">{item.completionPercentage}%</strong></p></div><button type="button" onClick={() => onView(item.id)} className="mt-4 min-h-11 rounded-xl border border-zinc-700 px-4 text-sm font-bold text-yellow-200">Ver evaluación</button>{menuId === item.id && <div role="menu" className="absolute right-4 top-16 z-20 w-56 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 p-1 shadow-2xl"><MenuItem onClick={() => onView(item.id)}>Ver evaluación</MenuItem><MenuItem onClick={() => onEdit(item.id)} disabled={!sourcePhysical || item.status !== "IN_PROGRESS"}>Editar{item.status !== "IN_PROGRESS" ? " (protegida)" : ""}</MenuItem><MenuItem onClick={() => onDuplicate(item.id)} disabled={!sourcePhysical}>Duplicar / usar como base</MenuItem><MenuItem onClick={() => onDelete(item)} disabled={!sourcePhysical} danger>Eliminar evaluación</MenuItem>{!sourcePhysical && <p className="px-3 py-2 text-[10px] leading-4 text-zinc-600">Registro legacy conservado en modo lectura.</p>}</div>}</article>; })}</div> : <div className="mt-5 rounded-xl border border-dashed border-zinc-700 p-8 text-center"><p className="text-sm text-zinc-400">Todavía no tiene evaluaciones.</p><div className="mt-4"><ActionButton onClick={onCreate} disabled={creating}>Iniciar evaluación</ActionButton></div></div>}</Card>;
}

function MenuItem({ children, onClick, disabled = false, danger = false }: { children: ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return <button type="button" role="menuitem" disabled={disabled} onClick={onClick} className={`min-h-11 w-full rounded-lg px-3 text-left text-sm disabled:cursor-not-allowed disabled:text-zinc-700 ${danger ? "text-red-300 hover:bg-red-400/10" : "text-zinc-300 hover:bg-zinc-800"}`}>{children}</button>;
}

function ProgressTab({ history, latestComparison, fullComparison }: { history: NormalizedEvaluation[]; latestComparison: ReturnType<typeof compareEvaluations> | null; fullComparison: ReturnType<typeof compareEvaluations> | null }) {
  if (history.length < 2 || !latestComparison) return <Card className="p-8 text-center"><p className="text-sm text-zinc-400">Se necesitan al menos dos evaluaciones comparables.</p></Card>;
  return <div className="space-y-4"><BMProgressCard progress={latestComparison.progress} /><Card className="p-4 sm:p-5"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-yellow-400">Evolución corporal</p><div className="mt-4"><EvaluationLineChart evaluations={history} /></div></Card><Accordion title="Desde la evaluación anterior" subtitle={`${showDate(latestComparison.previous.date)} → ${showDate(latestComparison.current.date)}`} open><EvaluationComparisonPanel comparison={latestComparison} /></Accordion>{fullComparison && <Accordion title="Desde la primera evaluación" subtitle={`${showDate(fullComparison.previous.date)} → ${showDate(fullComparison.current.date)}`}><EvaluationComparisonPanel comparison={fullComparison} /></Accordion>}</div>;
}

function ProfessionalRecord({ latest, previous, comparison, interpretation }: { latest?: NormalizedEvaluation; previous?: NormalizedEvaluation; comparison: ReturnType<typeof compareEvaluations> | null; interpretation: ReturnType<typeof interpretEvaluation> | null }) {
  if (!latest) return <Card className="p-8 text-center"><p className="text-sm text-zinc-400">La ficha profesional estará disponible después de la primera evaluación.</p></Card>;
  return <Card className="p-4 sm:p-5"><div className="mb-4"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-yellow-400">Ficha profesional</p><p className="mt-1 text-xs text-zinc-500">Información privada, sólo para el entrenador.</p></div><div className="space-y-2"><Accordion title="Simetría actual" subtitle="Medidas y tests con ambos lados"><EvaluationSymmetryPanel items={comparison?.symmetry ?? []} /></Accordion><Accordion title="Mapa corporal actual" subtitle="Molestias informadas y observación profesional"><EvaluationBodyMap issues={latest.bodyIssues} privateDetails /></Accordion><Accordion title="Movilidad y control" subtitle="Estados y resultados comparables"><EvaluationTests tests={latest.testResults} previousTests={previous?.testResults} category="MOBILITY" privateDetails /></Accordion><Accordion title="Rendimiento físico" subtitle="Tests y capacidades evaluadas"><EvaluationTests tests={latest.testResults} previousTests={previous?.testResults} category="PHYSICAL" privateDetails /></Accordion><Accordion title="Prioridades y estado general"><EvaluationStatusSummary tests={latest.testResults} />{interpretation && <div className="mt-4 space-y-2">{interpretation.priorities.map((item) => <div key={item.id} className="rounded-lg bg-black/35 p-3 text-sm"><strong>{item.message}</strong><p className="mt-1 text-xs text-zinc-500">{item.recommendation}</p></div>)}</div>}</Accordion><Accordion title="Resumen profesional" subtitle="Información privada, sólo para el entrenador"><ProfessionalNotes evaluation={latest} /></Accordion></div></Card>;
}

function ProfessionalNotes({ evaluation }: { evaluation: NormalizedEvaluation }) {
  return <div className="grid gap-2 sm:grid-cols-2">{[["Fortalezas", evaluation.finalStrengths], ["Prioridades", evaluation.finalPriorities], ["Limitaciones", evaluation.finalLimitations], ["Planificación", evaluation.planningNotes], ["Comentario final", evaluation.finalComment]].map(([label, content]) => <div key={label} className="rounded-xl bg-black/30 p-3"><p className="text-xs font-bold text-yellow-300">{label}</p><p className="mt-2 whitespace-pre-wrap text-sm text-zinc-400">{content || "—"}</p></div>)}</div>;
}

function EvaluationDetail({ evaluation, history, onClose, onEdit }: { evaluation: NormalizedEvaluation; history: NormalizedEvaluation[]; onClose: () => void; onEdit: () => void }) {
  const physical = evaluation.source === "PHYSICAL";
  return <Overlay title={evaluationSequenceLabel(history.map((item) => ({ ...item, source: item.source })), evaluation.id)} close={onClose} wide><div className="mt-1 flex flex-wrap items-center gap-2"><span className="text-sm text-zinc-400">{showDate(evaluation.date)}</span><StatusBadge status={evaluation.status} /></div>{physical && evaluation.status === "IN_PROGRESS" && <div className="mt-4"><ActionButton onClick={onEdit} primary>Editar evaluación</ActionButton></div>}<div className="mt-5 space-y-2"><Accordion title="Información general" open><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Stat label="Objetivo" value={<span className="text-sm">{evaluation.primaryGoal || "—"}</span>} /><Stat label="Experiencia" value={<span className="text-sm">{evaluation.experienceLevel || "—"}</span>} /><Stat label="Disponibilidad" value={<span className="text-sm">{evaluation.weeklyAvailability || "—"}</span>} /><Stat label="Entrenador" value={<span className="text-sm">{evaluation.trainerName || "—"}</span>} /></div></Accordion><Accordion title="Medidas corporales"><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Stat label="Peso" value={number(evaluation.weight, "kg")} /><Stat label="Cintura" value={number(evaluation.waist, "cm")} /><Stat label="Cadera" value={number(evaluation.hip, "cm")} /><Stat label="Pecho" value={number(evaluation.chest, "cm")} /><Stat label="Brazo derecho" value={number(evaluation.rightArm, "cm")} /><Stat label="Brazo izquierdo" value={number(evaluation.leftArm, "cm")} /><Stat label="Muslo derecho" value={number(evaluation.rightThigh, "cm")} /><Stat label="Muslo izquierdo" value={number(evaluation.leftThigh, "cm")} /></div></Accordion><Accordion title="Composición corporal"><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Stat label="Grasa corporal" value={number(evaluation.bodyFatPercentage, "%")} /><Stat label="Masa muscular" value={number(evaluation.muscleMass, "kg")} /><Stat label="Grasa visceral" value={number(evaluation.visceralFat)} /><Stat label="IMC" value={number(evaluation.bmi)} /></div></Accordion><Accordion title="Tests físicos"><EvaluationTests tests={evaluation.testResults} category="PHYSICAL" privateDetails /></Accordion><Accordion title="Movilidad y control"><EvaluationTests tests={evaluation.testResults} category="MOBILITY" privateDetails /></Accordion><Accordion title="Mapa corporal"><EvaluationBodyMap issues={evaluation.bodyIssues} privateDetails /></Accordion><Accordion title="Observaciones del entrenador" subtitle="Información privada"><ProfessionalNotes evaluation={evaluation} /></Accordion></div></Overlay>;
}
