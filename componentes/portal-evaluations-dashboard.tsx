"use client";

import { useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { EvaluationBodyMap, EvaluationLineChart, EvaluationStatusSummary, EvaluationTests } from "@/componentes/evaluation-insights";
import { BmBarbellIcon, BmChevronRightIcon, BmEvaluationIcon, BmEyeIcon, BmHealthIcon, BmProgressIcon, BmSlidersIcon } from "@/componentes/icons";
import { comparablePortalMetrics, portalEvaluationAreas, portalEvaluationHistory, portalEvaluationMetrics } from "@/lib/portal-evaluation-presentation";
import type { EvaluationMetricKey, StudentEvaluation } from "@/types/evaluation-read-model";

const showDate = (date: string) => date ? new Date(`${date}T12:00:00Z`).toLocaleDateString("es-AR", { timeZone: "UTC" }) : "Sin fecha";
const value = (number: number | null, unit = "") => number === null ? "—" : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(number)}${unit ? ` ${unit}` : ""}`;
const statusLabel = (status: StudentEvaluation["status"]) => status === "REASSESSMENT_RECOMMENDED" ? "Reevaluación recomendada" : status === "IN_PROGRESS" ? "En curso" : "Completada";
const evaluationName = (evaluation: StudentEvaluation) => evaluation.version === 1 ? "Evaluación inicial" : "Reevaluación";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="evaluation-section"><h2>{title}</h2><div className="evaluation-section-content">{children}</div></section>;
}
function Metrics({ current }: { current: StudentEvaluation }) {
  const items = [{ label: "Peso", number: current.weight, unit: "kg" }, { label: "IMC", number: current.bmi, unit: "" }, { label: "Grasa corporal", number: current.bodyFatPercentage, unit: "%" }].filter(item => item.number !== null);
  return items.length ? <dl className="evaluation-metrics">{items.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{value(item.number, item.unit)}</dd></div>)}</dl> : null;
}
function Evolution({ evaluations }: { evaluations: StudentEvaluation[] }) {
  const options = comparablePortalMetrics(evaluations);
  const [selected, setSelected] = useState<EvaluationMetricKey>("weight");
  const picker = useRef<HTMLDetailsElement>(null);
  const selectedOption = options.find(item => item.key === selected) ?? options[0];
  if (!selectedOption) return <div className="evaluation-empty"><BmProgressIcon size={24}/><div><p>Aún se necesita una segunda evaluación para mostrar evolución.</p><small>Cuando tengas una nueva evaluación vas a poder comparar tus cambios acá.</small></div></div>;
  const points = [...evaluations].reverse().filter(item => typeof item[selectedOption.key] === "number");
  return <div>
    <details className="evaluation-picker" ref={picker} onKeyDown={event => { if (event.key === "Escape" && picker.current) { picker.current.open = false; picker.current.querySelector("summary")?.focus(); } }}>
      <summary aria-label="Métrica de evolución"><span><small>Métrica</small>{selectedOption.label}</span><BmChevronRightIcon size={20}/></summary>
      <div className="evaluation-options" role="group" aria-label="Métricas disponibles">{options.map(item => <button key={item.key} type="button" aria-pressed={selectedOption.key === item.key} onClick={() => { setSelected(item.key); if (picker.current) { picker.current.open = false; picker.current.querySelector("summary")?.focus(); } }}>{item.label}</button>)}</div>
    </details>
    <p className="evaluation-before-after">{value(points[0][selectedOption.key], selectedOption.unit)} → <strong>{value(points.at(-1)![selectedOption.key], selectedOption.unit)}</strong></p>
    <EvaluationLineChart evaluations={evaluations} portalStyle selectedMetric={selectedOption.key}/>
  </div>;
}
const areas = [
  { key: "comparison", title: "Antes / Ahora", empty: "Sin medidas comparables", icon: BmEyeIcon },
  { key: "body", title: "Mapa corporal", empty: "Sin molestias registradas", icon: BmHealthIcon },
  { key: "mobility", title: "Movilidad y control", empty: "Sin datos registrados", icon: BmSlidersIcon },
  { key: "physical", title: "Tests físicos", empty: "Sin tests cargados", icon: BmBarbellIcon },
  { key: "summary", title: "Resumen de resultados", empty: "Todavía no hay resultados suficientes", icon: BmEvaluationIcon },
] as const;
function Results({ current }: { current: StudentEvaluation }) {
  return <>{current.testResults.length > 0 && <EvaluationStatusSummary tests={current.testResults}/>} {current.notes?.trim() && <p className="evaluation-notes">{current.notes}</p>}</>;
}
function AreaContent({ area, current, previous }: { area: typeof areas[number]["key"]; current: StudentEvaluation; previous?: StudentEvaluation }) {
  if (area === "comparison") return <Evolution evaluations={previous ? [current, previous] : [current]}/>;
  if (area === "body") return <EvaluationBodyMap key={current.id} issues={current.bodyIssues}/>;
  if (area === "summary") return <Results current={current}/>;
  return <EvaluationTests tests={current.testResults} previousTests={previous?.testResults} category={area === "mobility" ? "MOBILITY" : "PHYSICAL"} recordedOnly/>;
}
function Areas({ current, previous, detail = false }: { current: StudentEvaluation; previous?: StudentEvaluation; detail?: boolean }) {
  const availability = portalEvaluationAreas(current, previous);
  return <div className="evaluation-areas">{areas.filter(area => !detail || availability[area.key]).map(({ key, title, empty, icon: Icon }) => availability[key] ? <details key={key} className="evaluation-area"><summary><Icon size={20}/><span><strong>{title}</strong><small>{key === "comparison" ? "Comparar medidas" : "Disponible"}</small></span><BmChevronRightIcon size={20}/></summary><div className="evaluation-area-content"><AreaContent area={key} current={current} previous={previous}/></div></details> : <div key={key} className="evaluation-area-unavailable"><Icon size={20}/><span><strong>{title}</strong><small>{empty}</small></span></div>)}</div>;
}
function EmptyEvaluations() {
  return <div className="evaluation-section evaluation-empty-page"><BmEvaluationIcon size={24}/><p>Tu primera evaluación</p><h2>Todavía no registramos una evaluación física</h2><p>Cuando completes una evaluación vas a poder seguir tu evolución y comparar tus resultados en el tiempo.</p><ul><li>Medidas corporales</li><li>Fuerza y resistencia</li><li>Evolución física</li><li>Molestias y observaciones</li></ul><small>Tu entrenador cargará tu evaluación cuando corresponda.</small></div>;
}

export function PortalEvaluationsDashboard({ evaluations }: { evaluations: StudentEvaluation[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const history = portalEvaluationHistory(evaluations);
  const current = history[0];
  const selected = history.find(item => item.id === selectedId);
  if (!current) return <div className="portal-evaluation"><EmptyEvaluations/></div>;
  if (selected) {
    const previous = history[history.indexOf(selected) + 1];
    const measurements = portalEvaluationMetrics.filter(item => !["weight", "bodyFatPercentage"].includes(item.key) && selected[item.key] !== null);
    const photos = [{ label: "Frente", url: selected.frontPhotoUrl }, { label: "Perfil", url: selected.sidePhotoUrl }, { label: "Espalda", url: selected.backPhotoUrl }].filter(item => item.url);
    return <div className="portal-evaluation" data-evaluation-id={selected.id}>
      <header className="evaluation-detail-header"><button type="button" aria-label="Volver al historial" onClick={() => { setSelectedId(null); requestAnimationFrame(() => { const button = document.getElementById(`evaluation-history-${selected.id}`); button?.focus(); button?.scrollIntoView({ block: "center" }); }); }}><BmChevronRightIcon size={20} className="rotate-180"/><span className="hidden sm:inline">Volver al historial</span></button><div><p>{evaluationName(selected)} · Versión {selected.version}</p><h2 ref={heading} tabIndex={-1}>Evaluación del {showDate(selected.date)}</h2><small>{statusLabel(selected.status)}</small></div></header>
      <Metrics current={selected}/>
      {measurements.length > 0 && <Section title="Medidas corporales"><dl className="evaluation-measurements">{measurements.map(item => <div key={item.key}><dt>{item.label}</dt><dd>{value(selected[item.key], item.unit)}</dd></div>)}</dl></Section>}
      {photos.length > 0 && <Section title="Fotos de esta evaluación"><div className="evaluation-photos">{photos.map(photo => <figure key={photo.label}><Image src={photo.url!} alt={`${photo.label} · ${showDate(selected.date)}`} width={320} height={400} unoptimized/><figcaption>{photo.label}</figcaption></figure>)}</div></Section>}
      <Areas key={selected.id} current={selected} previous={previous} detail/>
    </div>;
  }
  return <div className="portal-evaluation">
    <section className="evaluation-hero"><p className="evaluation-eyebrow">Tu última evaluación</p><h2>{showDate(current.date)}</h2><p>{evaluationName(current)} <span className="evaluation-status">{statusLabel(current.status)}</span></p><p className="evaluation-next">Próxima evaluación: <strong>{current.reassessmentDate ? showDate(current.reassessmentDate) : "Sin fecha programada"}</strong></p></section>
    <Metrics current={current}/>
    <Section title="Tu evolución"><Evolution evaluations={history}/></Section>
    <Section title="Áreas evaluadas"><Areas current={current} previous={history[1]}/></Section>
    <Section title="Historial de evaluaciones"><ol className="evaluation-history">{history.map(item => <li key={item.id}><button id={`evaluation-history-${item.id}`} type="button" aria-label={`Ver evaluación versión ${item.version}`} onClick={() => { setSelectedId(item.id); requestAnimationFrame(() => { heading.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: "instant" }); }); }}><span><time dateTime={item.date}>{showDate(item.date)}</time><strong>{evaluationName(item)}</strong><small>Versión {item.version}{item.weight !== null && ` · ${value(item.weight, "kg")}`}{item.bodyFatPercentage !== null && ` · Grasa corporal ${value(item.bodyFatPercentage, "%")}`}</small></span><span className="evaluation-history-action">Ver <BmChevronRightIcon size={20}/></span></button></li>)}</ol></Section>
  </div>;
}
