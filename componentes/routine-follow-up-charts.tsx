import type { AdminBodyEvaluationPoint, AdminExerciseProgress } from "@/types/follow-up";

function points(values: number[], width = 320, height = 120) {
  const min = Math.min(...values); const max = Math.max(...values); const range = max - min || 1;
  return values.map((value, index) => `${values.length === 1 ? width / 2 : (index / (values.length - 1)) * width},${height - 12 - ((value - min) / range) * (height - 24)}`).join(" ");
}

export function SessionDurationChart({ sessions }: { sessions: Array<{ date: string; durationMinutes: number | null }> }) {
  const values = sessions.filter((item) => item.durationMinutes !== null).slice(0, 8).reverse();
  if (!values.length) return <ChartEmpty />;
  const max = Math.max(...values.map((item) => item.durationMinutes!), 1);
  return <div className="flex h-36 items-end gap-2" role="img" aria-label="Duración de las últimas sesiones">
    {values.map((item) => <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"><span className="text-[10px] text-zinc-400">{item.durationMinutes}m</span><span className="w-full max-w-8 rounded-t bg-gradient-to-t from-yellow-700 to-yellow-300" style={{ height: `${Math.max(10, (item.durationMinutes! / max) * 88)}px` }} /><span className="text-[9px] text-zinc-600">{new Date(`${item.date}T12:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}</span></div>)}
  </div>;
}

export function BodyEvolutionChart({ evaluations }: { evaluations: AdminBodyEvaluationPoint[] }) {
  const metrics = [
    { key: "weight" as const, label: "Peso", unit: "kg", color: "#facc15" },
    { key: "bodyFatPercentage" as const, label: "Grasa", unit: "%", color: "#fb7185" },
    { key: "muscleMass" as const, label: "Músculo", unit: "kg", color: "#34d399" },
  ];
  const available = metrics.filter((metric) => evaluations.filter((item) => item[metric.key] !== null).length > 1);
  if (!available.length) return <ChartEmpty text="Sin evaluaciones comparables." />;
  return <div className="space-y-4">{available.map((metric) => {
    const data = evaluations.filter((item) => item[metric.key] !== null); const values = data.map((item) => item[metric.key]!);
    const delta = Number((values.at(-1)! - values[0]).toFixed(1));
    return <div key={metric.key}><div className="mb-1 flex items-center justify-between text-xs"><span className="text-zinc-400">{metric.label}</span><span style={{ color: metric.color }}>{delta > 0 ? "+" : ""}{delta} {metric.unit}</span></div><svg viewBox="0 0 320 120" className="h-20 w-full" role="img" aria-label={`Evolución de ${metric.label.toLowerCase()}`}><polyline fill="none" stroke={metric.color} strokeWidth="3" strokeLinejoin="round" points={points(values)} /></svg></div>;
  })}</div>;
}

export function ExerciseProgressChart({ exercise }: { exercise: AdminExerciseProgress | null }) {
  if (!exercise) return <ChartEmpty text="Sin historial de carga comparable." />;
  const weighted = exercise.points.filter((item) => item.weight !== null);
  const values = weighted.length > 1 ? weighted.map((item) => item.weight!) : exercise.points.map((item) => item.repetitions);
  if (values.length < 2) return <ChartEmpty text="Se necesitan al menos dos registros para comparar." />;
  return <div><svg viewBox="0 0 320 120" className="h-36 w-full" role="img" aria-label={`Progreso de ${exercise.name}`}><polyline fill="none" stroke="#facc15" strokeWidth="3" strokeLinejoin="round" points={points(values)} /></svg><div className="flex justify-between text-[10px] text-zinc-500"><span>{exercise.points[0]?.date}</span><span>{weighted.length > 1 ? "Carga máxima (kg)" : "Repeticiones totales"}</span><span>{exercise.points.at(-1)?.date}</span></div></div>;
}

export function TrainingDistributionChart({ items }: { items: Array<{ label: string; count: number }> }) {
  if (!items.length) return <ChartEmpty text="Sin bloques finalizados para distribuir." />;
  const total = items.reduce((sum, item) => sum + item.count, 0);
  return <div className="space-y-3">{items.map((item) => <div key={item.label}><div className="flex justify-between text-xs"><span>{item.label}</span><span className="text-zinc-500">{item.count} · {Math.round((item.count / total) * 100)}%</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-yellow-400" style={{ width: `${(item.count / total) * 100}%` }} /></div></div>)}</div>;
}

function ChartEmpty({ text = "Sin datos suficientes." }: { text?: string }) { return <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-zinc-800 text-sm text-zinc-500">{text}</div>; }
