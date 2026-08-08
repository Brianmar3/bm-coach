"use client";

import { useEffect, useState } from "react";
import { EvaluationBodyMap, EvaluationTests } from "@/componentes/evaluation-insights";
import type { EvaluationInterpretation } from "@/types/evaluation-interpretation";
import type { EvaluationWorkflow } from "@/types/evaluation-workflow";
import type { Student } from "@/types/gestion";

export type LatestEvaluationContext = { studentId: string; evaluation: EvaluationWorkflow | null; interpretation: EvaluationInterpretation };

export function useRoutineEvaluation(student: Student | undefined) {
  const [context, setContext] = useState<LatestEvaluationContext | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!student || student.serviceType === "CLASSES") return;
    const controller = new AbortController();
    Promise.resolve().then(() => setLoading(true));
    fetch(`/api/admin/alumnos/${student.id}/evaluaciones/latest`, { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<LatestEvaluationContext> : Promise.reject(new Error("No se pudo cargar la evaluación.")))
      .then(setContext).catch((error: Error) => { if (error.name !== "AbortError") setContext(null); }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [student]);
  return { context: student?.serviceType === "CLASSES" || context?.studentId !== student?.id ? null : context, loading };
}

const date = (value: string) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("es-AR") : "—";
const validity = { CURRENT: "Vigente", DUE_SOON: "Próxima a reevaluación", REASSESSMENT_RECOMMENDED: "Reevaluación recomendada", NO_EVALUATION: "Sin evaluación" } as const;

export function RoutineEvaluationPanel({ student, context, loading }: { student: Student | undefined; context: LatestEvaluationContext | null; loading: boolean }) {
  const [detailsOpen, setDetailsOpen] = useState(false); const [dismissed, setDismissed] = useState<string[]>([]);
  if (!student || student.serviceType === "CLASSES") return null;
  if (loading) return <section className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-500">Cargando evaluación del alumno…</section>;
  if (!context?.evaluation) return <section className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"><p className="text-xs font-bold uppercase tracking-wider text-yellow-400">Evaluación del alumno</p><p className="mt-2 text-sm text-zinc-400">Sin evaluación completada. Esto no bloquea la creación de la rutina.</p></section>;
  const { evaluation, interpretation } = context; const visibleAlerts = interpretation.alerts.filter((item) => !dismissed.includes(item.id)).slice(0, 3);
  return <><section className="mt-5 rounded-xl border border-yellow-400/20 bg-yellow-400/[.03] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-yellow-400">Evaluación del alumno</p><p className="mt-2 font-bold">{evaluation.primaryGoal || "Objetivo no informado"}</p><p className="mt-1 text-xs text-zinc-500">Última: {date(evaluation.date)} · {validity[interpretation.validity]}</p></div><button type="button" onClick={() => setDetailsOpen(true)} className="min-h-10 rounded-lg border border-yellow-400/30 px-3 text-xs font-bold text-yellow-300">Ver evaluación completa</button></div>{interpretation.priorities.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{interpretation.priorities.slice(0, 3).map((item) => <span key={item.id} className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">{item.message}</span>)}</div>}{visibleAlerts.map((alert) => <div key={alert.id} className="mt-2 flex items-start justify-between gap-3 rounded-lg bg-orange-400/10 p-2 text-xs text-orange-200"><span>{alert.message}</span><button type="button" onClick={() => setDismissed((items) => [...items, alert.id])} className="shrink-0 text-zinc-400">Ignorar</button></div>)}{evaluation.reassessmentDate && <p className="mt-3 text-xs text-zinc-500">Reevaluación sugerida: {date(evaluation.reassessmentDate)}</p>}</section>{detailsOpen && <EvaluationPlanningDetails context={context} close={() => setDetailsOpen(false)}/>}</>;
}

function EvaluationPlanningDetails({ context, close }: { context: LatestEvaluationContext; close: () => void }) {
  const { evaluation, interpretation } = context;
  if (!evaluation) return null;
  return <div role="presentation" className="fixed inset-0 z-[80] overflow-y-auto bg-black/80 p-0 sm:p-4"><section role="dialog" aria-modal="true" aria-labelledby="evaluation-planning-title" className="mx-auto min-h-dvh max-w-4xl bg-zinc-900 p-4 text-white sm:my-6 sm:min-h-0 sm:rounded-2xl sm:border sm:border-zinc-700 sm:p-6"><header className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-yellow-400">Información para planificar</p><h2 id="evaluation-planning-title" className="mt-1 text-xl font-black">{evaluation.studentName}</h2><p className="mt-1 text-sm text-zinc-400">{evaluation.primaryGoal || "Objetivo no informado"} · {date(evaluation.date)}</p></div><button type="button" onClick={close} aria-label="Cerrar evaluación" className="min-h-10 rounded-lg bg-zinc-800 px-3 text-sm">Cerrar</button></header><div className="mt-5 space-y-5">{interpretation.priorities.length > 0 && <section><h3 className="font-bold">Prioridades y recomendaciones</h3><div className="mt-2 space-y-2">{interpretation.priorities.map((item) => <article key={item.id} className="rounded-xl bg-black/35 p-3"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-yellow-400/10 px-2 py-1 text-[10px] font-bold text-yellow-300">{item.level}</span><span className="text-xs text-zinc-500">{item.category} · {item.origin}</span></div><p className="mt-2 font-semibold">{item.message}</p><p className="mt-1 text-xs text-zinc-500">Dato: {item.evidence}</p><p className="mt-2 text-sm text-zinc-300">Sugerencia: {item.recommendation}</p></article>)}</div></section>}{interpretation.alerts.length > 0 && <section><h3 className="font-bold">Alertas</h3><ul className="mt-2 space-y-2">{interpretation.alerts.map((item) => <li key={item.id} className="rounded-lg bg-orange-400/10 p-3 text-sm text-orange-200">{item.message}</li>)}</ul></section>}<section><h3 className="mb-2 font-bold">Mapa corporal</h3><EvaluationBodyMap issues={evaluation.bodyIssues} privateDetails/></section><section><h3 className="mb-2 font-bold">Movilidad</h3><EvaluationTests tests={evaluation.testResults} category="MOBILITY" privateDetails/></section><section><h3 className="mb-2 font-bold">Tests físicos</h3><EvaluationTests tests={evaluation.testResults} category="PHYSICAL" privateDetails/></section></div></section></div>;
}

export function ContextualSuggestion({ messages }: { messages: string[] }) {
  const [ignored, setIgnored] = useState<string[]>([]); const visible = messages.filter((message) => !ignored.includes(message));
  if (!visible.length) return null;
  return <div className="mt-3 space-y-2">{visible.map((message) => <div key={message} className="flex items-start justify-between gap-3 rounded-lg border border-yellow-400/20 bg-yellow-400/[.05] p-2 text-xs text-yellow-100"><span>{message}</span><button type="button" onClick={() => setIgnored((items) => [...items, message])} className="shrink-0 text-zinc-400">Ignorar</button></div>)}</div>;
}
