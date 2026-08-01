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
  ["Compras", "Armá tu lista.", "/portal/nutricion/compras", "✓"],
  ["Cocinar", "Usá lo que tenés.", "/portal/nutricion/despensa", "◇"],
  ["Recetas", "Encontrá una opción.", "/portal/nutricion/recetas", "≡"],
  ["Aprender", "Guías prácticas.", "/portal/nutricion/aprender", "○"],
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
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-20 rounded-2xl bg-zinc-900" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      <header className="overflow-hidden rounded-3xl border border-yellow-400/15 bg-[radial-gradient(circle_at_88%_15%,rgba(250,204,21,.08),transparent_28%),linear-gradient(135deg,#18181b,#090909_70%)] p-5 shadow-[0_18px_48px_rgba(0,0,0,.3)]">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-yellow-400">
              Tu guía para hoy{data?.studentName ? `, ${data.studentName}` : ""}
            </p>
            <h1 className="mt-1 text-2xl font-black">Nutrición</h1>
            <p className="mt-2 text-sm text-zinc-400">Tu objetivo: <strong className="text-zinc-100">{data?.objective || "Mejorar hábitos"}</strong></p>
          </div>
          <span className="shrink-0 rounded-full border border-yellow-400/20 bg-yellow-400/[.06] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-yellow-200">
            {data?.contextStatus === "FULL" ? "Personalización completa" : data?.contextStatus === "LIMITED" ? "Personalización limitada" : "Guía base"}
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-800/80 pt-3"><p className="min-w-0 truncate text-xs text-zinc-500">{data?.evaluation ? `Evaluación del ${showDate(data.evaluation.date)}` : "Guía basada en tu perfil actual"}</p><Link href="/portal/nutricion/preferencias" className="shrink-0 rounded-lg px-2 py-2 text-xs font-bold text-yellow-300">Preferencias →</Link></div>
      </header>

      {error && <p role="alert" className="rounded-xl bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
      {message && <p role="status" className="rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-300">{message}</p>}

      {!data?.profile.personalizationEnabled && (
        <section className="rounded-2xl border border-yellow-400/15 bg-yellow-400/[.035] p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div>
            <h2 className="font-bold text-yellow-100">Activá la personalización inteligente</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-400">Adaptá la guía a tu objetivo, hábitos y preferencias.</p>
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

      <section className="rounded-2xl border border-yellow-400/20 bg-gradient-to-br from-zinc-900 to-black p-4 sm:p-5">
        <p className="text-[10px] font-bold uppercase tracking-[.18em] text-yellow-400">Para hoy</p>
        <h2 className="mt-1.5 text-lg font-black">{data?.recommendation.title}</h2>
        <p className="mt-1.5 max-w-3xl text-sm leading-5 text-zinc-300">{data?.recommendation.message}</p>
        {data?.recommendation && (
          <Link href={data.recommendation.href} className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-yellow-400 px-4 text-xs font-black text-black">
            {data.recommendation.action} →
          </Link>
        )}
      </section>

      <section id="habitos" className="scroll-mt-24 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold">Hábitos de hoy</h2><p className="mt-0.5 text-xs text-zinc-500">Marcá lo que pudiste sostener.</p></div>{data?.summary.daysRegistered ? <div className="shrink-0 text-right"><p className="text-lg font-black text-yellow-300">{data.summary.compliancePercentage}%</p><p className="text-[10px] text-zinc-500">esta semana</p></div> : null}</div>
        {data?.summary.daysRegistered ? <p className="mt-3 rounded-xl bg-black/30 px-3 py-2 text-xs text-zinc-400">{data.summary.daysRegistered} días registrados{data.summary.strongestHabit ? ` · Mejor: ${data.summary.strongestHabit}` : ""}{data.summary.habitToImprove ? ` · Próximo foco: ${data.summary.habitToImprove}` : ""}</p> : <p className="mt-3 text-xs text-zinc-500">Tu resumen semanal aparecerá después del primer registro.</p>}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {NUTRITION_HABITS.map(({ key, label }) => (
              <label key={key} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition ${habits[key] ? "border-yellow-400/30 bg-yellow-400/[.06] text-zinc-100" : "border-zinc-800 bg-black/30 text-zinc-300"}`}>
                <input type="checkbox" checked={habits[key]} onChange={(event) => setHabits((current) => ({ ...current, [key]: event.target.checked }))} className="h-5 w-5 accent-yellow-400" />
                {label}
              </label>
            ))}
          </div>
          <details className="mt-3 rounded-xl border border-zinc-800 bg-black/20"><summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-bold text-zinc-400">Agregar comentario opcional</summary><label className="block border-t border-zinc-800 p-3"><span className="sr-only">Comentario opcional</span><textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} rows={2} className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm outline-none focus:border-yellow-400" placeholder="¿Cómo estuvo tu alimentación hoy?" /></label></details>
          <button type="button" onClick={saveHabits} disabled={saving} className="mt-3 min-h-11 w-full rounded-xl bg-yellow-400 px-4 text-sm font-black text-black disabled:opacity-50 sm:w-auto">
            {saving ? "Guardando…" : data?.todayCheckin ? "Actualizar hábitos" : "Guardar hábitos"}
          </button>
      </section>

      <section><div className="mb-2.5"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-yellow-400">Accesos útiles</p><h2 className="mt-0.5 text-lg font-bold">¿Qué querés hacer?</h2></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{quickLinks.map(([title, description, href, icon]) => <Link key={href} href={href} className="group flex min-h-20 min-w-0 items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3 transition hover:border-yellow-400/25 focus-visible:outline-2 focus-visible:outline-yellow-300"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-yellow-400/[.07] text-lg text-yellow-300">{icon}</span><span className="min-w-0"><span className="block text-sm font-bold">{title}</span><span className="mt-0.5 block text-[11px] leading-4 text-zinc-500">{description}</span></span></Link>)}</div></section>

      <section className="grid gap-3 lg:grid-cols-2">
          <article className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-bold">Recetas recientes</h2>
              <Link href="/portal/nutricion/recetas" className="text-xs font-bold text-yellow-300">Ver todas</Link>
            </div>
            {data?.recentRecipes.length ? (
              <div className="mt-2 space-y-1.5">
                {data.recentRecipes.slice(0, 3).map((recipe) => (
                  <Link key={recipe.id} href={`/portal/nutricion/recetas/${recipe.id}`} className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-black/30 px-3 py-2">
                    <span className="min-w-0 truncate text-sm font-bold">{recipe.title}</span>
                    <span className="shrink-0 text-[10px] text-zinc-500">{recipe.preparationMinutes} min</span>
                  </Link>
                ))}
              </div>
            ) : <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-black/25 p-3"><p className="text-xs text-zinc-500">Todavía no guardaste recetas.</p><Link href="/portal/nutricion/recetas" className="shrink-0 text-xs font-bold text-yellow-300">Explorar</Link></div>}
          </article>
          <article className="rounded-2xl border border-yellow-400/15 bg-yellow-400/[.035] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-yellow-400">Recomendación de tu entrenador</p>
            <p className="mt-2 text-sm leading-5 text-zinc-300">{data?.trainerNote?.text ?? "Todavía no hay una recomendación nueva."}</p>
            {!data?.trainerNote && <p className="mt-1 text-xs text-zinc-500">Cuando tu entrenador agregue una, aparecerá acá.</p>}
          </article>
      </section>

      <p className="px-1 text-xs leading-5 text-zinc-600">
        Esta orientación acompaña tu entrenamiento y tus evaluaciones. No reemplaza la atención de un nutricionista o profesional de salud.
      </p>
    </div>
  );
}
