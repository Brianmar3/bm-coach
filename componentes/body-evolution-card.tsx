"use client";

import { useMemo, useState } from "react";
import type { PhysicalEvaluation } from "@/types/gestion";

export type BodyMetricKey = "weight" | "bodyFatPercentage" | "muscleMass" | "waist" | "hip";

export const BODY_METRICS: Array<{ key: BodyMetricKey; label: string; unit: string }> = [
  { key: "weight", label: "Peso", unit: "kg" },
  { key: "bodyFatPercentage", label: "Grasa corporal", unit: "%" },
  { key: "muscleMass", label: "Masa muscular", unit: "kg" },
  { key: "waist", label: "Cintura", unit: "cm" },
  { key: "hip", label: "Cadera", unit: "cm" },
];

const numeric = (value: number, digits = 1) => new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: digits,
}).format(value);

export function formatBodyValue(value: number, unit: string) {
  return `${numeric(value)}${unit ? ` ${unit}` : ""}`;
}

const shortDate = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  timeZone: "UTC",
});

type BodyEvaluation = Pick<PhysicalEvaluation, "date" | "weight" | "bodyFatPercentage" | "muscleMass" | "waist" | "hip">;

export function BodyEvolutionCard({ evaluations, compact = false }: { evaluations: BodyEvaluation[]; compact?: boolean }) {
  const [metricKey, setMetricKey] = useState<BodyMetricKey>("weight");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const metric = BODY_METRICS.find((item) => item.key === metricKey) ?? BODY_METRICS[0];
  const points = useMemo(() => [...evaluations.slice(0, 24)]
    .reverse()
    .flatMap((evaluation) => evaluation[metric.key] === null ? [] : [{ date: evaluation.date, value: evaluation[metric.key] as number }]), [evaluations, metric.key]);
  const current = points.at(-1);
  const previous = points.at(-2);
  const difference = current && previous ? current.value - previous.value : null;
  const percentage = difference !== null && previous && previous.value !== 0 ? difference / previous.value * 100 : null;
  const values = points.map((point) => point.value);
  const rawMin = values.length ? Math.min(...values) : 0;
  const rawMax = values.length ? Math.max(...values) : 0;
  const padding = Math.max((rawMax - rawMin) * 0.15, Math.abs(rawMax || 1) * 0.015);
  const min = rawMin - padding;
  const max = rawMax + padding;
  const range = max - min || 1;
  const coordinates = points.map((point, index) => ({
    ...point,
    x: 18 + index * 284 / Math.max(points.length - 1, 1),
    y: 92 - (point.value - min) / range * 68,
  }));
  const selected = selectedIndex === null ? null : points[selectedIndex];

  if (!evaluations.length) return <section className={`rounded-2xl border border-zinc-800 bg-zinc-900 ${compact ? "p-3" : "p-4"}`}><p className="text-xs font-bold uppercase tracking-wider text-yellow-400">Evolución corporal</p><p className="mt-2 text-sm text-zinc-500">Todavía no hay evaluaciones registradas.</p></section>;

  return <section className={`rounded-2xl border border-zinc-800 bg-zinc-900 ${compact ? "p-3" : "p-4"}`}>
    <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-yellow-400">Evolución corporal</p>{current && <p className="mt-1 text-xl font-bold">{formatBodyValue(current.value, metric.unit)}</p>}</div>{points.length > 0 && <span className="text-xs text-zinc-500">{points.length} {points.length === 1 ? "evaluación" : "evaluaciones"}</span>}</div>
    <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Métrica corporal">{BODY_METRICS.map((item) => <button key={item.key} type="button" role="tab" aria-selected={item.key === metric.key} onClick={() => { setMetricKey(item.key); setSelectedIndex(null); }} className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold ${item.key === metric.key ? "bg-yellow-400 text-zinc-950" : "bg-zinc-950 text-zinc-400"}`}>{item.label}</button>)}</div>
    {!current && <p className="mt-4 rounded-xl bg-zinc-950 p-4 text-sm text-zinc-500">Sin datos registrados para esta métrica.</p>}
    {current && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400"><span>{metric.label}</span>{previous && <span>Anterior: {formatBodyValue(previous.value, metric.unit)}</span>}{difference !== null && <span>{difference > 0 ? "↑ Subió" : difference < 0 ? "↓ Bajó" : "→ Sin cambios"} · {difference > 0 ? "+" : ""}{numeric(difference)} {metric.unit}{percentage === null ? "" : ` · ${percentage > 0 ? "+" : ""}${numeric(percentage)} %`}</span>}</div>}
    {points.length === 1 && <p className="mt-4 text-sm text-zinc-500">Todavía no hay suficientes evaluaciones para mostrar evolución.</p>}
    {points.length >= 2 && <><svg viewBox="0 0 320 108" className="mt-3 h-28 w-full" role="img" aria-label={`Evolución de ${metric.label}`}><line x1="18" y1="92" x2="302" y2="92" stroke="#3f3f46" /><polyline points={coordinates.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#facc15" strokeWidth="2.5" />{coordinates.map((point, index) => <circle key={`${point.date}-${index}`} cx={point.x} cy={point.y} r={selectedIndex === index ? 6 : 4} fill="#facc15" stroke="#09090b" strokeWidth="2" tabIndex={0} role="button" aria-label={`${shortDate(point.date)}: ${formatBodyValue(point.value, metric.unit)}`} onClick={() => setSelectedIndex(index)} onFocus={() => setSelectedIndex(index)}><title>{shortDate(point.date)} · {formatBodyValue(point.value, metric.unit)}</title></circle>)}</svg>{points.length === 2 && <p className="text-xs text-zinc-600">Tendencia basada en dos mediciones.</p>}{selected && <p className="mt-2 rounded-lg bg-zinc-950 px-3 py-2 text-xs text-zinc-300">{shortDate(selected.date)} · {formatBodyValue(selected.value, metric.unit)}</p>}</>}
  </section>;
}
