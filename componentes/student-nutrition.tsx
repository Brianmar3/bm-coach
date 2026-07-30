"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { NUTRITION_HABITS } from "@/lib/nutrition";
import type {
  NutritionHabitKey,
  NutritionPortalData,
} from "@/types/nutrition";

const emptyHabits: Record<NutritionHabitKey, boolean> = {
  hydration: false,
  protein: false,
  fruitsVegetables: false,
  mealOrganization: false,
  energy: false,
};

const generalGuide = [
  "Organizá comidas completas que puedas sostener en tu rutina.",
  "Incluí una fuente de proteína en las comidas principales.",
  "Sumá frutas y verduras variadas a lo largo del día.",
  "Priorizá agua y mantené una hidratación regular.",
  "Evitá enfoques extremos y observá cómo responde tu energía.",
];

function objectiveGuide(objective: string) {
  const normalized = objective.toLocaleLowerCase("es");
  if (/masa|músc|muscu|aument|ganar/.test(normalized)) {
    return {
      title: "Aumentar masa muscular",
      items: [
        "Incluí una fuente de proteína en las comidas principales.",
        "Evitá pasar demasiadas horas sin comer.",
        "Incorporá carbohidratos alrededor del entrenamiento.",
        "Sumá una colación si te cuesta sostener una ingesta suficiente.",
        "Mantené una hidratación regular durante el día.",
      ],
    };
  }
  if (/grasa|bajar|descenso|adelgaz/.test(normalized)) {
    return {
      title: "Bajar grasa",
      items: [
        "Priorizá comidas completas y saciantes.",
        "Incluí proteína y verduras en las comidas principales.",
        "Organizá porciones sin recurrir a restricciones extremas.",
        "Evitá picoteos frecuentes por falta de organización.",
        "Sostené el entrenamiento y la actividad diaria.",
      ],
    };
  }
  if (/rend|deport|compet|fuerza/.test(normalized)) {
    return {
      title: "Rendimiento",
      items: [
        "Llegá al entrenamiento con buena hidratación.",
        "Evitá entrenar después de demasiadas horas sin comer.",
        "Incluí carbohidratos y proteínas alrededor del entrenamiento.",
        "Organizá una comida de recuperación después de las sesiones.",
        "Registrá cómo cambia tu energía durante el día.",
      ],
    };
  }
  if (/mantener|mantenimiento/.test(normalized)) {
    return {
      title: "Mantener",
      items: [
        "Mantené horarios de comida que puedas sostener.",
        "Incluí proteínas, frutas y verduras de forma variada.",
        "Priorizá agua durante el día.",
        "Organizá tus comidas alrededor del entrenamiento.",
        "Evitá enfoques extremos y observá tu energía.",
      ],
    };
  }
  if (/hábito|habito|salud|bienestar/.test(normalized)) {
    return {
      title: "Mejorar hábitos",
      items: generalGuide,
    };
  }
  return {
    title: objective.trim() || "Mantener y mejorar hábitos",
    items: generalGuide,
  };
}

function showDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("es-AR");
}

export function StudentNutrition() {
  const [data, setData] = useState<NutritionPortalData | null>(null);
  const [habits, setHabits] = useState(emptyHabits);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const guide = useMemo(
    () => objectiveGuide(data?.objective ?? ""),
    [data?.objective],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/portal/nutrition", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as NutritionPortalData & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(body.error ?? "No se pudo cargar la guía.");
        }
        setData(body);
        const today = body.todayCheckin;
        setHabits(
          today
            ? {
                hydration: today.hydration,
                protein: today.protein,
                fruitsVegetables: today.fruitsVegetables,
                mealOrganization: today.mealOrganization,
                energy: today.energy,
              }
            : emptyHabits,
        );
        setComment(today?.comment ?? "");
      })
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name === "AbortError") return;
        setError(
          reason instanceof Error ? reason.message : "No se pudo cargar la guía.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  async function save() {
    if (saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/portal/nutrition", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...habits, comment }),
      });
      const body = (await response.json()) as {
        message?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? "No se pudo guardar.");
      setMessage(body.message ?? "Hábitos guardados correctamente.");
      const refreshed = await fetch("/api/portal/nutrition", {
        cache: "no-store",
      });
      if (refreshed.ok) {
        const refreshedData = (await refreshed.json()) as NutritionPortalData;
        setData(refreshedData);
      }
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "No se pudo guardar.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-36 rounded-3xl bg-zinc-900" />
        <div className="h-64 rounded-2xl bg-zinc-900" />
        <div className="h-72 rounded-2xl bg-zinc-900" />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      <header className="overflow-hidden rounded-3xl border border-yellow-400/15 bg-gradient-to-br from-zinc-900 via-[#101010] to-black p-5 shadow-[0_18px_48px_rgba(0,0,0,.3)] sm:p-6">
        <p className="text-[10px] font-bold uppercase tracking-[.2em] text-yellow-400">
          Bienestar y entrenamiento
        </p>
        <h1 className="mt-2 text-2xl font-black">Nutrición</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
          Esta guía es orientativa y acompaña tu entrenamiento y tus evaluaciones.
          No reemplaza la atención de un nutricionista.
        </p>
        {data?.evaluation ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
            <span className="text-zinc-400">
              Guía basada en tu última evaluación del{" "}
              <strong className="text-zinc-200">
                {showDate(data.evaluation.date)}
              </strong>
              .
            </span>
            <Link
              href="/portal/evaluaciones"
              className="font-bold text-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-300"
            >
              Ver mi evaluación →
            </Link>
            <div className="flex basis-full flex-wrap gap-2 pt-1">
              {data.evaluation.weight !== null && (
                <span className="rounded-full border border-zinc-700 bg-black/30 px-2.5 py-1 text-zinc-400">
                  Peso {data.evaluation.weight.toLocaleString("es-AR")} kg
                </span>
              )}
              {data.evaluation.height !== null && (
                <span className="rounded-full border border-zinc-700 bg-black/30 px-2.5 py-1 text-zinc-400">
                  Altura {data.evaluation.height.toLocaleString("es-AR")} cm
                </span>
              )}
              {data.age !== null && (
                <span className="rounded-full border border-zinc-700 bg-black/30 px-2.5 py-1 text-zinc-400">
                  Edad {data.age} años
                </span>
              )}
              {data.evaluation.bodyFatPercentage !== null && (
                <span className="rounded-full border border-zinc-700 bg-black/30 px-2.5 py-1 text-zinc-400">
                  Grasa {data.evaluation.bodyFatPercentage.toLocaleString("es-AR")}%
                </span>
              )}
              {data.evaluation.muscleMass !== null && (
                <span className="rounded-full border border-zinc-700 bg-black/30 px-2.5 py-1 text-zinc-400">
                  Masa muscular {data.evaluation.muscleMass.toLocaleString("es-AR")} kg
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-yellow-400/10 bg-yellow-400/[.04] p-3 text-sm text-zinc-400">
            Aún no hay una evaluación registrada. Mientras tanto, podés seguir
            esta guía general de hábitos.{" "}
            <Link
              href="/portal/evaluaciones"
              className="font-bold text-yellow-300"
            >
              Ver evaluaciones
            </Link>
          </div>
        )}
      </header>

      {error && (
        <p role="alert" className="rounded-xl bg-red-400/10 p-3 text-sm text-red-300">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-300">
          {message}
        </p>
      )}

      <section className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5">
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-yellow-400">
            Recomendaciones según tu objetivo
          </p>
          <h2 className="mt-2 text-lg font-bold">{guide.title}</h2>
          <ul className="mt-4 space-y-3">
            {guide.items.map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-5 text-zinc-300">
                <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-yellow-400/10 text-[10px] text-yellow-300">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5">
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-yellow-400">
            Guía diaria
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {[
              ["Agua", "Tomá agua de forma regular y ajustá según clima y entrenamiento."],
              ["Proteína", "Incluí fuentes variadas en tus comidas principales."],
              ["Frutas y verduras", "Buscá variedad de colores durante el día."],
              ["Organización", "Planificá opciones simples para evitar saltear comidas."],
              ["Energía", "Observá cómo llegás al entrenamiento y cómo te recuperás."],
              [
                "Antes y después de entrenar",
                "Evitá llegar después de demasiadas horas sin comer y organizá una comida de recuperación.",
              ],
            ].map(([title, text]) => (
              <div key={title} className="rounded-xl bg-black/40 p-3">
                <p className="text-sm font-bold text-yellow-200">{title}</p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">{text}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <article className="rounded-2xl border border-yellow-400/15 bg-gradient-to-br from-zinc-900 to-[#0b0b0b] p-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-yellow-400">
              Hábitos diarios
            </p>
            <h2 className="mt-2 text-lg font-bold">
              ¿Cómo estuvo tu alimentación hoy?
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Podés actualizar este registro durante todo el día.
            </p>
          </div>
          <div className="mt-4 space-y-2">
            {NUTRITION_HABITS.map(({ key, label }) => (
              <label
                key={key}
                className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-zinc-800 bg-black/35 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={habits[key]}
                  onChange={(event) =>
                    setHabits((current) => ({
                      ...current,
                      [key]: event.target.checked,
                    }))
                  }
                  className="h-5 w-5 accent-yellow-400"
                />
                {label}
              </label>
            ))}
          </div>
          <label className="mt-4 block text-sm text-zinc-300">
            Comentario opcional
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder="¿Cómo estuvo tu alimentación hoy?"
              className="mt-2 w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white outline-none focus:border-yellow-400"
            />
            <span className="mt-2 block text-xs leading-5 text-zinc-500">
              Este espacio es para registrar cómo estuvo tu alimentación. No
              requiere una respuesta diaria del entrenador.
            </span>
          </label>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="mt-4 min-h-12 w-full rounded-xl bg-yellow-400 px-4 font-black text-zinc-950 disabled:opacity-50"
          >
            {saving ? "Guardando…" : data?.todayCheckin ? "Actualizar hábitos de hoy" : "Guardar hábitos de hoy"}
          </button>
        </article>

        <div className="space-y-4">
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-yellow-400">
              Resumen semanal
            </p>
            {data?.summary.daysRegistered ? (
              <div className="mt-4">
                <div className="grid grid-cols-2 gap-2">
                  <Metric label="Días registrados" value={String(data.summary.daysRegistered)} />
                  <Metric label="Cumplimiento" value={`${data.summary.compliancePercentage}%`} />
                  <Metric label="Más sostenido" value={data.summary.strongestHabit ?? "—"} />
                  <Metric label="A mejorar" value={data.summary.habitToImprove ?? "—"} />
                </div>
                <p className="mt-3 rounded-xl border border-yellow-400/10 bg-yellow-400/[.035] p-3 text-sm leading-5 text-zinc-300">
                  {data.summary.automaticMessage}
                </p>
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-zinc-700 p-4 text-sm text-zinc-500">
                Todavía no registraste tus hábitos esta semana.
              </p>
            )}
          </article>

          <article className="rounded-2xl border border-yellow-400/15 bg-yellow-400/[.035] p-5">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-yellow-400">
              Recomendación de tu entrenador
            </p>
            {data?.trainerNote ? (
              <>
                <p className="mt-3 text-sm leading-6 text-zinc-200">
                  “{data.trainerNote.text}”
                </p>
                <p className="mt-3 text-xs text-zinc-500">
                  Tu entrenador ·{" "}
                  {new Date(data.trainerNote.createdAt).toLocaleDateString("es-AR")}
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm leading-6 text-zinc-500">
                Seguí tu guía y tus hábitos semanales. Tu entrenador puede
                agregar una recomendación cuando lo considere necesario.
              </p>
            )}
          </article>
        </div>
      </section>

      <p className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs leading-5 text-zinc-500">
        Si tenés restricciones, una condición médica o necesitás un plan
        específico, consultá con un nutricionista o profesional de salud.
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-black/45 p-3">
      <p className="text-[9px] uppercase tracking-wider text-zinc-600">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-yellow-200">{value}</p>
    </div>
  );
}
