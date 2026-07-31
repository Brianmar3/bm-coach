"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NUTRITION_HABITS } from "@/lib/nutrition";
import type { NutritionHabitKey } from "@/types/nutrition";
import type { NutritionDashboardData } from "@/types/nutrition-intelligence";

const emptyHabits: Record<NutritionHabitKey, boolean> = {
  hydration: false,
  protein: false,
  fruitsVegetables: false,
  mealOrganization: false,
  energy: false,
};

const quickLinks = [
  ["Ideas de comidas", "Opciones según tu objetivo y horario.", "/portal/nutricion/ideas", "◌"],
  ["Planificar semana", "Organizá comidas y días.", "/portal/nutricion/plan", "▦"],
  ["Lista de compras", "Consolidá lo que necesitás.", "/portal/nutricion/compras", "✓"],
  ["Cocinar con lo que tengo", "Usá ingredientes disponibles.", "/portal/nutricion/despensa", "◇"],
  ["Recetas", "Consultá tus recetas guardadas.", "/portal/nutricion/recetas", "≡"],
  ["Aprender", "Lecciones breves y prácticas.", "/portal/nutricion/aprender", "○"],
  ["Favoritos", "Volvé a tus contenidos elegidos.", "/portal/nutricion/favoritos", "☆"],
  ["Historial", "Revisá tu actividad nutricional.", "/portal/nutricion/historial", "↺"],
  ["Preguntar al asistente", "Orientación contextual y segura.", "/portal/nutricion/asistente", "✦"],
] as const;

function showDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("es-AR");
}

async function responseBody(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function StudentNutrition() {
  const [data, setData] = useState<NutritionDashboardData | null>(null);
  const [habits, setHabits] = useState(emptyHabits);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [consenting, setConsenting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load(signal?: AbortSignal) {
    const response = await fetch("/api/portal/nutrition", {
      cache: "no-store",
      signal,
    });
    const body = (await responseBody(response)) as unknown as NutritionDashboardData & {
      error?: string;
    };
    if (!response.ok) throw new Error(body.error ?? "No se pudo cargar Nutrición.");
    setData(body);
    setHabits(
      body.todayCheckin
        ? {
            hydration: body.todayCheckin.hydration,
            protein: body.todayCheckin.protein,
            fruitsVegetables: body.todayCheckin.fruitsVegetables,
            mealOrganization: body.todayCheckin.mealOrganization,
            energy: body.todayCheckin.energy,
          }
        : emptyHabits,
    );
    setComment(body.todayCheckin?.comment ?? "");
  }

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void load(controller.signal)
        .catch((reason: unknown) => {
          if (reason instanceof Error && reason.name === "AbortError") return;
          setError(reason instanceof Error ? reason.message : "No se pudo cargar Nutrición.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, []);

  async function saveHabits() {
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
      const body = await responseBody(response);
      if (!response.ok) throw new Error(String(body.error ?? "No se pudo guardar."));
      setMessage(String(body.message ?? "Hábitos guardados."));
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function enablePersonalization() {
    if (consenting) return;
    setConsenting(true);
    setError("");
    try {
      const response = await fetch("/api/portal/nutrition/consent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personalizationEnabled: true }),
      });
      const body = await responseBody(response);
      if (!response.ok) throw new Error(String(body.error ?? "No se pudo activar."));
      setMessage("Personalización activada. Podés cambiarla desde Preferencias.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo activar.");
    } finally {
      setConsenting(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-4 animate-pulse" aria-label="Cargando Nutrición">
        <div className="h-44 rounded-3xl bg-zinc-900" />
        <div className="h-36 rounded-2xl bg-zinc-900" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-28 rounded-2xl bg-zinc-900" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      <header className="overflow-hidden rounded-3xl border border-yellow-400/15 bg-[radial-gradient(circle_at_88%_15%,rgba(250,204,21,.08),transparent_28%),linear-gradient(135deg,#18181b,#090909_70%)] p-5 shadow-[0_18px_48px_rgba(0,0,0,.3)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-yellow-400">
              Tu guía para hoy{data?.studentName ? `, ${data.studentName}` : ""}
            </p>
            <h1 className="mt-2 text-2xl font-black">Nutrición</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Objetivo: <strong className="text-zinc-200">{data?.objective || "Mejorar hábitos"}</strong>
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {data?.evaluation
                ? `Basada en tu evaluación del ${showDate(data.evaluation.date)}.`
                : "Todavía no hay una evaluación registrada. La guía utiliza tu perfil y objetivo actual."}
            </p>
          </div>
          <span className="rounded-full border border-yellow-400/20 bg-yellow-400/[.06] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-yellow-200">
            {data?.contextStatus === "FULL" ? "Personalización completa" : data?.contextStatus === "LIMITED" ? "Personalización limitada" : "Guía base"}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/portal/nutricion/preferencias" className="min-h-11 rounded-xl border border-yellow-400/20 px-4 py-3 text-xs font-bold text-yellow-200">
            Editar preferencias
          </Link>
          <Link href="/portal/nutricion/preferencias#datos-utilizados" className="min-h-11 rounded-xl border border-zinc-700 px-4 py-3 text-xs font-bold text-zinc-300">
            Ver datos utilizados
          </Link>
          {data?.evaluation && (
            <Link href="/portal/evaluaciones" className="min-h-11 rounded-xl border border-zinc-700 px-4 py-3 text-xs font-bold text-zinc-300">
              Ver mi evaluación
            </Link>
          )}
        </div>
      </header>

      {error && <p role="alert" className="rounded-xl bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
      {message && <p role="status" className="rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-300">{message}</p>}

      {!data?.profile.personalizationEnabled && (
        <section className="rounded-2xl border border-yellow-400/15 bg-yellow-400/[.035] p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div>
            <h2 className="font-bold text-yellow-100">Activá la personalización inteligente</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-400">
              Usa tu objetivo, evaluación, entrenamiento, hábitos y preferencias. No comparte datos de otros alumnos ni reemplaza atención profesional.
            </p>
          </div>
          <button type="button" onClick={enablePersonalization} disabled={consenting} className="mt-3 min-h-11 shrink-0 rounded-xl bg-yellow-400 px-4 text-xs font-black text-black disabled:opacity-50 sm:mt-0">
            {consenting ? "Activando…" : "Aceptar y activar"}
          </button>
        </section>
      )}

      {data?.evaluationUpdated && (
        <section className="rounded-2xl border border-yellow-400/20 bg-yellow-400/[.05] p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <p className="text-sm text-yellow-100">Tu evaluación fue actualizada. Podés revisar tu guía; los planes guardados no cambiarán sin tu permiso.</p>
          <Link href="/portal/nutricion/preferencias#datos-utilizados" className="mt-3 inline-flex min-h-11 shrink-0 items-center rounded-xl border border-yellow-400/25 px-4 text-xs font-bold text-yellow-200 sm:mt-0">Revisar datos</Link>
        </section>
      )}

      <section className="rounded-2xl border border-yellow-400/20 bg-gradient-to-br from-zinc-900 to-black p-5">
        <p className="text-[10px] font-bold uppercase tracking-[.18em] text-yellow-400">Recomendación principal</p>
        <h2 className="mt-2 text-lg font-black">{data?.recommendation.title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-300">{data?.recommendation.message}</p>
        {data?.recommendation && (
          <Link href={data.recommendation.href} className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-yellow-400 px-4 text-xs font-black text-black">
            {data.recommendation.action} →
          </Link>
        )}
      </section>

      <section>
        <div className="mb-3">
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-yellow-400">Accesos rápidos</p>
          <h2 className="mt-1 text-lg font-bold">Organizá tu alimentación</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {quickLinks.map(([title, description, href, icon]) => (
            <Link key={href} href={href} className="group min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 transition duration-200 hover:border-yellow-400/25 hover:bg-zinc-900 focus-visible:outline-2 focus-visible:outline-yellow-300">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-yellow-400/15 bg-yellow-400/[.05] text-lg text-yellow-300">{icon}</span>
              <h3 className="mt-3 text-sm font-bold text-zinc-100">{title}</h3>
              <p className="mt-1 text-xs leading-5 text-zinc-500">{description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-yellow-400">Planificación activa</p>
              <h2 className="mt-2 text-lg font-bold">{data?.activePlan ? `${showDate(data.activePlan.startDate)} al ${showDate(data.activePlan.endDate)}` : "Todavía no organizaste tu semana"}</h2>
            </div>
            <Link href="/portal/nutricion/plan" className="text-xs font-bold text-yellow-300">Abrir →</Link>
          </div>
          {data?.activePlan ? (
            <div className="mt-4 space-y-2">
              {data.activePlan.meals.slice(0, 4).map((meal) => (
                <div key={meal.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-black/35 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{meal.title}</p>
                    <p className="text-[10px] text-zinc-500">{showDate(meal.dateKey)} · {meal.mealType}</p>
                  </div>
                  <span className="text-[10px] text-yellow-300">{meal.status === "COMPLETED" ? "Realizada" : "Planificada"}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-zinc-500">Creá una planificación estable y cambiala solo cuando vos lo decidas.</p>
          )}
        </article>

        <article id="habitos" className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 scroll-mt-24">
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-yellow-400">Resumen de hábitos</p>
          {data?.summary.daysRegistered ? (
            <>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Metric label="Días" value={String(data.summary.daysRegistered)} />
                <Metric label="Cumplimiento" value={`${data.summary.compliancePercentage}%`} />
                <Metric label="Más sostenido" value={data.summary.strongestHabit ?? "—"} />
                <Metric label="A mejorar" value={data.summary.habitToImprove ?? "—"} />
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-300">{data.summary.automaticMessage}</p>
            </>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">Todavía no registraste tus hábitos esta semana.</p>
          )}
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <article className="rounded-2xl border border-yellow-400/15 bg-gradient-to-br from-zinc-900 to-black p-5">
          <h2 className="text-lg font-bold">Hábitos de hoy</h2>
          <p className="mt-1 text-xs text-zinc-500">Podés actualizar este registro durante el día.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {NUTRITION_HABITS.map(({ key, label }) => (
              <label key={key} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-zinc-800 bg-black/35 px-3 py-2 text-sm">
                <input type="checkbox" checked={habits[key]} onChange={(event) => setHabits((current) => ({ ...current, [key]: event.target.checked }))} className="h-5 w-5 accent-yellow-400" />
                {label}
              </label>
            ))}
          </div>
          <label className="mt-4 block text-sm text-zinc-300">
            Comentario opcional
            <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} rows={3} className="mt-2 w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 p-3 outline-none focus:border-yellow-400" placeholder="¿Cómo estuvo tu alimentación hoy?" />
            <span className="mt-2 block text-xs leading-5 text-zinc-500">Este registro es personal y no requiere una respuesta diaria del entrenador.</span>
          </label>
          <button type="button" onClick={saveHabits} disabled={saving} className="mt-4 min-h-12 w-full rounded-xl bg-yellow-400 px-4 font-black text-black disabled:opacity-50">
            {saving ? "Guardando…" : data?.todayCheckin ? "Actualizar hábitos" : "Guardar hábitos"}
          </button>
        </article>

        <div className="space-y-4">
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-bold">Recetas recientes</h2>
              <Link href="/portal/nutricion/recetas" className="text-xs font-bold text-yellow-300">Ver todas</Link>
            </div>
            {data?.recentRecipes.length ? (
              <div className="mt-3 space-y-2">
                {data.recentRecipes.map((recipe) => (
                  <Link key={recipe.id} href={`/portal/nutricion/recetas/${recipe.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-black/35 p-3">
                    <span className="min-w-0 truncate text-sm font-bold">{recipe.title}</span>
                    <span className="shrink-0 text-[10px] text-zinc-500">{recipe.preparationMinutes} min</span>
                  </Link>
                ))}
              </div>
            ) : <p className="mt-3 text-sm text-zinc-500">Aún no guardaste recetas.</p>}
          </article>
          <article className="rounded-2xl border border-yellow-400/15 bg-yellow-400/[.035] p-5">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-yellow-400">Recomendación de tu entrenador</p>
            <p className="mt-3 text-sm leading-6 text-zinc-300">{data?.trainerNote?.text ?? "Seguí tu guía y tus hábitos. Tu entrenador puede agregar una recomendación cuando lo considere necesario."}</p>
          </article>
          <Link href="/portal/nutricion/asistente" className="block rounded-2xl border border-yellow-400/20 bg-gradient-to-r from-yellow-400/[.08] to-transparent p-5">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-yellow-400">Asistente</p>
            <h2 className="mt-2 font-bold">¿Qué necesitás resolver hoy?</h2>
            <p className="mt-1 text-xs text-zinc-500">Usa tu objetivo, preferencias y evaluación actual.</p>
          </Link>
        </div>
      </section>

      <p className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs leading-5 text-zinc-500">
        Esta orientación acompaña tu entrenamiento y tus evaluaciones. No reemplaza la atención de un nutricionista o profesional de salud.
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-black/40 p-3">
      <p className="text-[9px] uppercase tracking-wider text-zinc-600">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-yellow-200">{value}</p>
    </div>
  );
}
