"use client";

import { useState } from "react";
import { TEST_DEFINITIONS } from "@/lib/evaluation-workflow";
import type { EvaluationMetricKey, NormalizedEvaluation, StudentEvaluation } from "@/types/evaluation-read-model";
import type { EvaluationBodyIssueValue, EvaluationTestValue } from "@/types/evaluation-workflow";

type ReadEvaluation = NormalizedEvaluation | StudentEvaluation;

const metrics: Array<{ key: EvaluationMetricKey; label: string; unit: string }> = [
  { key: "weight", label: "Peso", unit: "kg" }, { key: "waist", label: "Cintura", unit: "cm" },
  { key: "hip", label: "Cadera", unit: "cm" }, { key: "chest", label: "Pecho", unit: "cm" },
  { key: "bodyFatPercentage", label: "Grasa corporal", unit: "%" },
  { key: "rightArm", label: "Brazo D", unit: "cm" }, { key: "leftArm", label: "Brazo I", unit: "cm" },
  { key: "rightThigh", label: "Muslo D", unit: "cm" }, { key: "leftThigh", label: "Muslo I", unit: "cm" },
  { key: "rightCalf", label: "Pantorrilla D", unit: "cm" }, { key: "leftCalf", label: "Pantorrilla I", unit: "cm" },
];

const format = (value: number | null, unit = "") => value === null ? "—" : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value)}${unit ? ` ${unit}` : ""}`;
const showDate = (value: string) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("es-AR") : "—";

export function EvaluationLineChart({ evaluations }: { evaluations: ReadEvaluation[] }) {
  const [metricKey, setMetricKey] = useState<EvaluationMetricKey>("weight");
  const definition = metrics.find((item) => item.key === metricKey)!;
  const points = evaluations.flatMap((item) => typeof item[metricKey] === "number" ? [{ date: item.date, value: item[metricKey] as number }] : []).sort((a, b) => a.date.localeCompare(b.date));
  const min = Math.min(...points.map((item) => item.value)); const max = Math.max(...points.map((item) => item.value));
  const coords = points.map((item, index) => ({ ...item, x: points.length === 1 ? 50 : 8 + index * 84 / (points.length - 1), y: max === min ? 50 : 85 - (item.value - min) * 70 / (max - min) }));
  const firstChange = points.length > 1 ? points.at(-1)!.value - points[0].value : null;
  const previousChange = points.length > 1 ? points.at(-1)!.value - points.at(-2)!.value : null;
  const signed = (change: number | null) => change === null ? "—" : `${change > 0 ? "+" : ""}${format(Math.round(change * 10) / 10, definition.unit)}`;
  return <section>
    <label className="block max-w-xs text-xs font-bold uppercase tracking-wider text-zinc-500">Métrica<select aria-label="Métrica de evolución" value={metricKey} onChange={(event) => setMetricKey(event.target.value as EvaluationMetricKey)} className="mt-1 min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm font-semibold text-white outline-none focus:border-yellow-400">{metrics.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
    {points.length < 2 ? <p className="mt-5 rounded-xl border border-dashed border-zinc-700 p-5 text-sm text-zinc-500">Aún se necesita una segunda evaluación con {definition.label.toLowerCase()} para mostrar evolución.</p> : <><div className="mt-4 grid grid-cols-2 gap-2"><p className="rounded-lg bg-black/35 p-3 text-xs text-zinc-400">Desde la primera <strong className="mt-1 block text-base text-white">{signed(firstChange)}</strong></p><p className="rounded-lg bg-black/35 p-3 text-xs text-zinc-400">Desde la anterior <strong className="mt-1 block text-base text-white">{signed(previousChange)}</strong></p></div><div className="mt-3 overflow-hidden rounded-xl border border-zinc-800 bg-black/35 p-3"><svg viewBox="0 0 100 100" role="img" aria-label={`Evolución de ${definition.label}`} className="h-52 w-full overflow-visible"><path d="M8 85H92M8 15V85" stroke="#3f3f46" strokeWidth=".7"/><polyline points={coords.map((item) => `${item.x},${item.y}`).join(" ")} fill="none" stroke="#facc15" strokeWidth="2" vectorEffect="non-scaling-stroke"/>{coords.map((item) => <g key={`${item.date}-${item.value}`}><title>{`${showDate(item.date)}: ${format(item.value, definition.unit)}`}</title><circle cx={item.x} cy={item.y} r="2.5" fill="#facc15" stroke="#09090b" strokeWidth="1"/><text x={item.x} y={item.y - 5} textAnchor="middle" fill="#fafafa" fontSize="4">{format(item.value, definition.unit)}</text><text x={item.x} y="94" textAnchor="middle" fill="#a1a1aa" fontSize="3.4">{showDate(item.date)}</text></g>)}</svg><p className="mt-1 text-center text-[10px] text-zinc-500">Pasá el cursor o tocá un punto para ver fecha y valor.</p></div></>}
  </section>;
}

const zonePosition = (zone: string) => {
  const value = zone.toLowerCase();
  const x = value.includes("derech") ? 39 : value.includes("izquier") ? 61 : 50;
  const y = value.includes("cuello") ? 20 : value.includes("hombro") ? 27 : value.includes("pecho") || value.includes("espalda alta") ? 35 : value.includes("brazo") || value.includes("codo") ? 44 : value.includes("mano") || value.includes("muñeca") ? 55 : value.includes("abdomen") || value.includes("espalda baja") ? 48 : value.includes("cadera") || value.includes("glúteo") ? 57 : value.includes("muslo") ? 68 : value.includes("rodilla") ? 78 : value.includes("pantorrilla") ? 87 : 94;
  return { x, y };
};
const issueColor = (intensity: number | null) => intensity === null ? "#a1a1aa" : intensity <= 3 ? "#facc15" : intensity <= 6 ? "#fb923c" : "#ef4444";

export function EvaluationBodyMap({ issues, privateDetails = false }: { issues: EvaluationBodyIssueValue[]; privateDetails?: boolean }) {
  const [selected, setSelected] = useState<EvaluationBodyIssueValue | null>(issues[0] ?? null);
  if (!issues.length) return <p className="rounded-xl border border-dashed border-zinc-700 p-5 text-sm text-zinc-500">No hay molestias o zonas corporales registradas.</p>;
  const body = (label: string, back: boolean) => <div><p className="text-center text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</p><svg viewBox="0 0 100 105" className="mx-auto h-64" role="img" aria-label={`Figura corporal ${label.toLowerCase()}`}><circle cx="50" cy="12" r="7" fill="#27272a"/><path d="M42 21Q50 17 58 21L62 51 57 62 60 99H52L50 66 48 99H40L43 62 38 51Z" fill="#27272a" stroke="#52525b"/><path d="M40 25L27 55M60 25L73 55" stroke="#52525b" strokeWidth="7" strokeLinecap="round"/>{issues.flatMap((issue, index) => { const posterior = /espalda|glúteo/i.test(issue.bodyZone); if (posterior !== back) return []; const point = zonePosition(issue.bodyZone); return [<g key={`${issue.bodyZone}-${index}`} onClick={() => setSelected(issue)} role="button" tabIndex={0} aria-label={issue.bodyZone} className="cursor-pointer"><circle cx={point.x} cy={point.y} r="4" fill={issueColor(issue.intensity)} stroke="#fff" strokeWidth={selected === issue ? "1.5" : ".5"}/></g>]; })}</svg></div>;
  return <div className="grid gap-4 lg:grid-cols-[minmax(320px,480px)_1fr]"><div className="rounded-xl border border-zinc-800 bg-black/35 p-3"><div className="grid grid-cols-2">{body("Frente", false)}{body("Posterior", true)}</div><div className="flex justify-center gap-3 text-[10px] text-zinc-500"><span>● Leve</span><span className="text-orange-400">● Media</span><span className="text-red-400">● Alta</span></div></div>{selected && <article className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs font-bold uppercase tracking-wider text-yellow-400">Zona seleccionada</p><h3 className="mt-2 text-lg font-bold">{selected.bodyZone}</h3><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-zinc-500">Lado</dt><dd className="mt-1 font-semibold">{selected.side || "Centro"}</dd></div><div><dt className="text-zinc-500">Intensidad</dt><dd className="mt-1 font-semibold">{selected.intensity ?? "—"}{selected.intensity !== null ? "/10" : ""}</dd></div><div><dt className="text-zinc-500">Estado</dt><dd className="mt-1 font-semibold">{selected.status.replaceAll("_", " ")}</dd></div></dl>{selected.studentDescription && <p className="mt-4 text-sm text-zinc-300">{selected.studentDescription}</p>}{privateDetails && selected.trainerObservation && <p className="mt-3 rounded-lg bg-black/40 p-3 text-sm text-zinc-400"><strong className="text-zinc-200">Observación profesional:</strong> {selected.trainerObservation}</p>}</article>}</div>;
}

const statusLabel: Record<string, string> = { NOT_PERFORMED: "No realizado", NORMAL: "Adecuado", LIMITED: "Limitado", PAIN: "Con dolor", GOOD: "Bueno", REGULAR: "Regular", POOR: "A mejorar", COMPLETED: "Realizado" };
function statusTone(status: string) { if (status === "NOT_PERFORMED") return "bg-zinc-800 text-zinc-400"; if (/NORMAL|GOOD|CORRECT|COMPLETED/.test(status)) return "bg-emerald-400/10 text-emerald-300"; if (/LIMITED|REGULAR|IMPROV/.test(status)) return "bg-yellow-400/10 text-yellow-300"; return "bg-orange-400/10 text-orange-300"; }
export function EvaluationTests({ tests, category, previousTests = [], privateDetails = false }: { tests: EvaluationTestValue[]; category: "MOBILITY" | "PHYSICAL"; previousTests?: EvaluationTestValue[]; privateDetails?: boolean }) {
  const definitions = TEST_DEFINITIONS.filter((item) => item.category === category);
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{definitions.map((definition) => { const test = tests.find((item) => item.testKey === definition.key); const previous = previousTests.find((item) => item.testKey === definition.key); const comparable = test && previous && test.numericValue !== null && previous.numericValue !== null && test.unit === previous.unit && test.variation === previous.variation && test.protocol === previous.protocol; const delta = comparable ? test.numericValue! - previous.numericValue! : null; return <article key={definition.key} className="rounded-xl border border-zinc-800 bg-black/30 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{definition.name}</p><p className="mt-1 text-xs text-zinc-500">{definition.area}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusTone(test?.status ?? "NOT_PERFORMED")}`}>{statusLabel[test?.status ?? "NOT_PERFORMED"] ?? test?.status ?? "No realizado"}</span></div>{test ? <div className="mt-3 text-sm"><p className="text-lg font-black text-yellow-300">{test.numericValue !== null ? format(test.numericValue, test.unit) : test.rightValue !== null || test.leftValue !== null ? `D ${format(test.rightValue, test.rightUnit)} · I ${format(test.leftValue, test.leftUnit)}` : "Sin valor numérico"}</p>{test.variation && <p className="mt-1 text-xs text-zinc-500">Variante: {test.variation}</p>}{delta !== null && <div className="mt-2 text-xs text-zinc-400"><p>Anterior: {format(previous!.numericValue, previous!.unit)} · Actual: {format(test.numericValue, test.unit)}</p><p>Cambio: {delta > 0 ? "+" : ""}{format(delta, test.unit)}</p></div>}{test.pain || test.rightPain || test.leftPain ? <p className="mt-2 text-xs font-bold text-red-300">Dolor informado</p> : null}{privateDetails && test.observations && <p className="mt-2 text-xs text-zinc-400">{test.observations}</p>}</div> : <p className="mt-3 text-sm text-zinc-600">No registrado</p>}</article>; })}</div>;
}

export function EvaluationStatusSummary({ tests }: { tests: EvaluationTestValue[] }) {
  const counts = tests.reduce((result, test) => { const key = test.status === "NOT_PERFORMED" ? "notPerformed" : /NORMAL|GOOD|CORRECT|COMPLETED/.test(test.status) ? "correct" : /LIMITED|REGULAR|IMPROV/.test(test.status) ? "improvable" : "priority"; result[key] += 1; return result; }, { correct: 0, improvable: 0, priority: 0, notPerformed: 0 });
  const total = Math.max(tests.length, 1); const entries = [{ key: "correct", label: "Correctos", color: "bg-emerald-500" }, { key: "improvable", label: "Mejorables", color: "bg-yellow-400" }, { key: "priority", label: "Prioritarios", color: "bg-orange-500" }, { key: "notPerformed", label: "No realizados", color: "bg-zinc-600" }] as const;
  return <div><div className="flex h-3 overflow-hidden rounded-full bg-zinc-800">{entries.map((item) => counts[item.key] > 0 && <div key={item.key} className={item.color} style={{ width: `${counts[item.key] / total * 100}%` }}/>)}</div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{entries.map((item) => <p key={item.key} className="text-xs text-zinc-400"><span className={`mr-2 inline-block h-2 w-2 rounded-full ${item.color}`}/>{item.label}: <strong className="text-white">{counts[item.key]}</strong></p>)}</div></div>;
}
