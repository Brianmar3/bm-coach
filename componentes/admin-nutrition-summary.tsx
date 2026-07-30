"use client";

import { useEffect, useState } from "react";
import type {
  NutritionEvaluationReference,
  NutritionSummary,
  NutritionTrainerNote,
} from "@/types/nutrition";

type AdminNutritionData = {
  objective: string;
  evaluation: NutritionEvaluationReference | null;
  summary: NutritionSummary;
  trainerNote: NutritionTrainerNote | null;
};

const showDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("es-AR");

export function AdminNutritionSummary({ studentId }: { studentId: string }) {
  const [data, setData] = useState<AdminNutritionData | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingRecommendation, setEditingRecommendation] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/alumnos/${encodeURIComponent(studentId)}/nutrition`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as AdminNutritionData & {
          error?: string;
        };
        if (!response.ok) throw new Error(body.error ?? "No se pudo cargar.");
        setData(body);
        setText(body.trainerNote?.text ?? "");
      })
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name === "AbortError") return;
        setError(
          reason instanceof Error
            ? reason.message
            : "No se pudo cargar nutrición y hábitos.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [studentId]);

  async function save() {
    if (saving || !text.trim()) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/admin/alumnos/${encodeURIComponent(studentId)}/nutrition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        },
      );
      const body = (await response.json()) as {
        trainerNote?: NutritionTrainerNote;
        message?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? "No se pudo guardar.");
      setData((current) =>
        current && body.trainerNote
          ? { ...current, trainerNote: body.trainerNote }
          : current,
      );
      setMessage(body.message ?? "Recomendación enviada.");
      setEditingRecommendation(false);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "No se pudo guardar.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-yellow-400/15 bg-gradient-to-br from-zinc-950 to-[#0d0d0d] p-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-yellow-400">
          Nutrición y hábitos
        </p>
        <h3 className="mt-1 font-bold">Seguimiento orientativo</h3>
      </div>
      {loading ? (
        <p className="mt-4 text-sm text-zinc-500">Cargando hábitos…</p>
      ) : data ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Metric label="Objetivo" value={data.objective || "No definido"} />
            <Metric
              label="Última evaluación"
              value={data.evaluation ? showDate(data.evaluation.date) : "Sin evaluación"}
            />
            <Metric label="Días registrados" value={String(data.summary.daysRegistered)} />
            <Metric label="Cumplimiento 7 días" value={`${data.summary.compliancePercentage}%`} />
            <Metric label="Más sostenido" value={data.summary.strongestHabit ?? "Sin datos"} />
            <Metric label="A mejorar" value={data.summary.habitToImprove ?? "Sin datos"} />
          </div>
          {data.trainerNote && (
            <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Recomendación actual
              </p>
              <p className="mt-2 text-sm leading-5 text-zinc-300">
                {data.trainerNote.text}
              </p>
              <p className="mt-2 text-xs text-zinc-600">
                {new Date(data.trainerNote.createdAt).toLocaleDateString("es-AR")}
              </p>
            </div>
          )}
          {!editingRecommendation ? (
            <button
              type="button"
              onClick={() => {
                setMessage("");
                setEditingRecommendation(true);
              }}
              className="mt-4 min-h-11 rounded-xl border border-yellow-400/25 bg-yellow-400/[.06] px-4 text-sm font-bold text-yellow-300"
            >
              {data.trainerNote ? "Actualizar recomendación" : "Dejar una recomendación"}
            </button>
          ) : (
            <div className="mt-4 rounded-xl border border-zinc-800 bg-black/25 p-3">
              <label className="block text-sm text-zinc-300">
                Recomendación opcional
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  maxLength={600}
                  rows={3}
                  placeholder="Ej: Mejorá la hidratación antes de entrenar."
                  className="mt-2 w-full resize-none rounded-xl border border-zinc-700 bg-zinc-900 p-3 outline-none focus:border-yellow-400"
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving || !text.trim()}
                  className="min-h-11 rounded-xl bg-yellow-400 px-4 text-sm font-black text-zinc-950 disabled:opacity-50"
                >
                  {saving ? "Enviando…" : "Guardar recomendación"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setText(data.trainerNote?.text ?? "");
                    setEditingRecommendation(false);
                  }}
                  disabled={saving}
                  className="min-h-11 rounded-xl border border-zinc-700 px-4 text-sm font-bold text-zinc-300"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </>
      ) : null}
      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
      {message && <p role="status" className="mt-3 text-sm text-emerald-300">{message}</p>}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-zinc-900 p-3">
      <p className="text-[9px] uppercase tracking-wider text-zinc-600">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-yellow-200">{value}</p>
    </div>
  );
}
