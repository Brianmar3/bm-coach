"use client";

import { useEffect, useState } from "react";
import type { AttendanceStatus, StudentAttendanceSummary } from "@/types/gestion";

const STATUS: Record<AttendanceStatus, { label: string; className: string }> = {
  presente: { label: "Presente", className: "bg-emerald-400/15 text-emerald-300" },
  ausente: { label: "Ausente", className: "bg-red-400/15 text-red-300" },
  justificado: { label: "Justificado", className: "bg-yellow-400/15 text-yellow-300" },
};

function showDate(value: string | null) { return value ? new Date(`${value}T12:00:00`).toLocaleDateString("es-AR") : "Sin registros"; }

export function StudentAttendanceSummaryCard({ studentId }: { studentId: string }) {
  const [summary, setSummary] = useState<StudentAttendanceSummary | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/asistencias/alumno/${studentId}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) { const body = await response.json() as { error?: string }; throw new Error(body.error ?? "No se pudo cargar la asistencia."); }
        return response.json() as Promise<StudentAttendanceSummary>;
      })
      .then(setSummary)
      .catch((loadError: unknown) => { if (loadError instanceof Error && loadError.name !== "AbortError") setError(loadError.message); })
      .finally(() => setReady(true));
    return () => controller.abort();
  }, [studentId]);

  if (!ready) return <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-500">Cargando historial de asistencias…</section>;
  if (error) return <p className="mt-6 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>;
  if (!summary) return null;

  return <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950 p-5"><div><h3 className="font-semibold">Asistencias</h3><p className="mt-1 text-xs text-zinc-500">Resumen del mes actual e historial completo.</p></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="Presentes" value={summary.attended} /><Metric label="Ausencias" value={summary.absent} danger /><Metric label="Asistencia" value={`${summary.percentage}%`} /><Metric label="Última fecha" value={showDate(summary.lastAttendanceDate)} small /></div><div className="mt-5 max-h-72 overflow-y-auto rounded-xl border border-zinc-800"><table className="w-full min-w-[600px] text-left text-sm"><thead className="sticky top-0 bg-zinc-900 text-zinc-500"><tr><th className="p-3">Fecha</th><th>Horario</th><th>Estado</th><th>Tipo</th></tr></thead><tbody>{summary.history.length ? summary.history.map((entry) => <tr key={entry.id} className="border-t border-zinc-800"><td className="p-3">{showDate(entry.date)}</td><td>{entry.scheduleLabel}</td><td><span className={`rounded-full px-2 py-1 text-xs font-bold ${STATUS[entry.status].className}`}>{STATUS[entry.status].label}</span></td><td className="text-zinc-500">{entry.exceptional ? "Excepcional" : "Habitual"}</td></tr>) : <tr><td colSpan={4} className="p-8 text-center text-zinc-500">Todavía no tiene asistencias registradas.</td></tr>}</tbody></table></div></section>;
}

function Metric({ label, value, danger = false, small = false }: { label: string; value: string | number; danger?: boolean; small?: boolean }) { return <div className="rounded-xl bg-zinc-900 p-3"><p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p><p className={`mt-1 font-bold ${small ? "text-sm" : "text-xl"} ${danger ? "text-red-300" : "text-yellow-400"}`}>{value}</p></div>; }
