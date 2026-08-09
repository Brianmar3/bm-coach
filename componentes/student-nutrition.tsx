"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
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
  ["Compras", "Armá tu lista.", "/portal/nutricion/compras", "cart"],
  ["Cocinar", "Usá lo que tenés.", "/portal/nutricion/despensa", "pot"],
  ["Recetas", "Encontrá una opción.", "/portal/nutricion/recetas", "book"],
  ["Aprender", "Guías prácticas.", "/portal/nutricion/aprender", "learn"],
] as const;

type LineIconName = "calendar" | "shield" | "comment" | "bookmark" | "star" | "cart" | "pot" | "book" | "learn";

function LineIcon({ name, className = "size-5" }: { name: LineIconName; className?: string }) {
  const paths: Record<LineIconName, ReactNode> = {
    calendar: <><path d="M7 3v3m10-3v3M4.5 9h15M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /></>,
    shield: <><path d="M12 3 5.5 6v5.5c0 4 2.6 7.4 6.5 9 3.9-1.6 6.5-5 6.5-9V6L12 3Z" /><path d="m9 12 2 2 4-4" /></>,
    comment: <path d="M5 5.5h14v10H10l-4 3v-3H5v-10Z" />,
    bookmark: <path d="M7 4.5h10v15l-5-3-5 3v-15Z" />,
    star: <path d="m12 3 2.7 5.5 6 .9-4.3 4.2 1 5.9-5.4-2.8-5.4 2.8 1-5.9-4.3-4.2 6-.9L12 3Z" />,
    cart: <><path d="M3 5h2l2 10h10l2-7H6" /><path d="M9 19h.01M17 19h.01" /></>,
    pot: <><path d="M5 9h14v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9Zm-2 0h18M9 6h6M8 3c0 1 1 1 1 2m4-2c0 1 1 1 1 2" /></>,
    book: <><path d="M4 5.5c3-.8 5.7-.2 8 1.5v12c-2.3-1.7-5-2.3-8-1.5v-12Zm16 0c-3-.8-5.7-.2-8 1.5v12c2.3-1.7 5-2.3 8-1.5v-12Z" /></>,
    learn: <><path d="m3 9 9-5 9 5-9 5-9-5Zm4 2.5V16c2.7 2 7.3 2 10 0v-4.5M20 10v6" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function HabitIcon({ habit }: { habit: NutritionHabitKey }) {
  const paths: Record<NutritionHabitKey, ReactNode> = {
    hydration: <path d="M12 3S6.5 9.4 6.5 14a5.5 5.5 0 0 0 11 0C17.5 9.4 12 3 12 3Z" />,
    protein: <><path d="M7 14c1.5-4 3.5-6 6-6 2.8 0 4.5 2 4.5 5.5V19H9a4 4 0 0 1-4-4v-3" /><path d="M10 9V5.5a2 2 0 0 1 4 0V8" /></>,
    fruitsVegetables: <><path d="M12 20c-4.5-1.5-6.5-5-5-9 4-.5 7 1 8 5" /><path d="M12 20c4-2 5.5-5.5 4.5-9-3.5 0-6 1.5-7 4.5M12 8c0-2 1-3.5 3-4" /></>,
    mealOrganization: <><path d="M5 8h14l-1 11H6L5 8Zm-1-3h16M9 5V3h6v2" /></>,
    energy: <path d="m13 2-7 12h5l-1 8 8-13h-5V2Z" />,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[habit]}</svg>;
}

function NutritionIllustration() {
  return <svg viewBox="0 0 180 150" aria-hidden="true" className="absolute -right-2 top-2 hidden h-36 w-44 text-yellow-400 opacity-[.16] sm:block" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="92" cy="75" r="58" /><circle cx="92" cy="75" r="49" strokeDasharray="2 5" /><path d="M46 91h73c-4 21-18 31-36 31S51 112 46 91Zm9-8c8-13 21-18 36-18 12 0 23 4 31 12M74 67c-8-10-8-20-4-27 10 3 17 12 17 23m8 2c0-13 7-23 17-27 3 9 0 20-10 28m27-20h22v66h-19m-4-56h31m-27-10v-8h22v8" /></svg>;
}

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
    <div className="mx-auto min-w-0 max-w-5xl space-y-3.5 sm:space-y-4">
      <header className="relative overflow-hidden rounded-[26px] border border-white/[.11] bg-[radial-gradient(circle_at_86%_20%,rgba(250,204,21,.06),transparent_30%),linear-gradient(135deg,#181818,#090909_72%)] p-5 shadow-[0_18px_48px_rgba(0,0,0,.28)] sm:p-6">
        <NutritionIllustration />
        <div className="relative min-w-0 sm:max-w-[68%]">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-yellow-400">
              Tu guía para hoy{data?.studentName ? `, ${data.studentName}` : ""}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-[-.035em] sm:text-4xl">Nutrición</h1>
            <p className="mt-2 text-sm text-zinc-400 sm:text-base">Tu objetivo: <strong className="text-zinc-100">{data?.objective || "Mejorar hábitos"}</strong></p>
          </div>
          <span className="mt-3 inline-flex rounded-full border border-yellow-400/25 bg-yellow-400/[.045] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-yellow-200">
            {data?.contextStatus === "FULL" ? "Personalización completa" : data?.contextStatus === "LIMITED" ? "Personalización limitada" : "Guía base"}
            {data?.contextStatus === "FULL" && <span aria-hidden="true" className="ml-2">✓</span>}
          </span>
        </div>
        <div className="relative mt-5 flex items-center justify-between gap-3 border-t border-white/[.09] pt-3.5"><p className="flex min-w-0 items-center gap-2 truncate text-xs text-zinc-400"><span className="shrink-0 text-yellow-400"><LineIcon name="calendar" /></span>{data?.evaluation ? `Evaluación del ${showDate(data.evaluation.date)}` : "Guía basada en tu perfil actual"}</p><Link href="/portal/nutricion/preferencias" className="inline-flex min-h-11 shrink-0 items-center px-1 text-xs font-bold text-yellow-300">Preferencias →</Link></div>
      </header>

      {error && <p role="alert" className="rounded-xl bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
      {message && <p role="status" className="rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-300">{message}</p>}

      {!data?.profile.personalizationEnabled && (
        <section className="rounded-2xl border border-yellow-400/15 bg-yellow-400/[.025] p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div>
            <h2 className="font-bold text-yellow-100">Activá la personalización inteligente</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-400">Adaptá la guía a tu objetivo, hábitos y preferencias.</p>
          </div>
          <button type="button" onClick={enablePersonalization} disabled={consenting} className="mt-3 min-h-11 shrink-0 rounded-xl border border-yellow-400/30 bg-yellow-400/[.05] px-4 text-xs font-black text-yellow-200 disabled:opacity-50 sm:mt-0">
            {consenting ? "Activando…" : "Aceptar y activar"}
          </button>
        </section>
      )}

      {data?.evaluationUpdated && (
        <section className="rounded-2xl border border-yellow-400/18 bg-yellow-400/[.025] p-3.5 sm:flex sm:items-center sm:gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full border border-yellow-400/25 text-yellow-300"><LineIcon name="shield" /></span>
          <p className="mt-2 flex-1 text-xs leading-5 text-zinc-300 sm:mt-0 sm:text-sm">Tu evaluación fue actualizada. Podés revisar tu guía; los planes guardados no cambiarán sin tu permiso.</p>
          <Link href="/portal/nutricion/preferencias#datos-utilizados" className="mt-3 inline-flex min-h-11 shrink-0 items-center rounded-xl border border-yellow-400/30 bg-black/20 px-4 text-xs font-bold text-yellow-200 sm:mt-0">Revisar datos</Link>
        </section>
      )}

      <section className="relative overflow-hidden rounded-2xl border border-white/[.1] bg-[linear-gradient(145deg,#171717,#090909)] p-4 sm:p-5">
        <p className="text-[10px] font-bold uppercase tracking-[.18em] text-yellow-400">Para hoy</p>
        <h2 className="mt-1.5 text-lg font-black">{data?.recommendation.title}</h2>
        <p className="mt-1.5 max-w-3xl text-sm leading-5 text-zinc-300">{data?.recommendation.message}</p>
        {data?.recommendation && (
          <Link href={data.recommendation.href} className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-yellow-400/30 bg-yellow-400/[.055] px-4 text-xs font-black text-yellow-200">
            {data.recommendation.action} →
          </Link>
        )}
      </section>

      <section id="habitos" className="scroll-mt-24 rounded-2xl border border-white/[.1] bg-[linear-gradient(145deg,#171717,#0b0b0b)] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold">Hábitos de hoy</h2><p className="mt-0.5 text-xs text-zinc-500">Marcá lo que pudiste sostener</p></div>{data?.summary.daysRegistered ? <div className="shrink-0 text-right"><p className="text-lg font-black text-yellow-300">{data.summary.compliancePercentage}%</p><p className="text-[10px] text-zinc-500">esta semana</p></div> : null}</div>
        {data?.summary.daysRegistered ? <p className="mt-2 text-[11px] text-zinc-500">{data.summary.daysRegistered} días registrados{data.summary.strongestHabit ? ` · Mejor: ${data.summary.strongestHabit}` : ""}{data.summary.habitToImprove ? ` · Próximo foco: ${data.summary.habitToImprove}` : ""}</p> : <p className="mt-2 text-[11px] text-zinc-500">Tu resumen semanal aparecerá después del primer registro.</p>}
          <div className="mt-3 grid grid-cols-5 gap-px overflow-hidden rounded-xl bg-white/[.08]">
            {NUTRITION_HABITS.map(({ key, label }) => (
              <label key={key} className={`relative flex min-h-[6.75rem] cursor-pointer flex-col items-center justify-between gap-1 bg-[#0d0d0d] px-1.5 py-2.5 text-center transition focus-within:ring-2 focus-within:ring-inset focus-within:ring-yellow-300 ${habits[key] ? "text-yellow-200" : "text-zinc-300"}`}>
                <input type="checkbox" checked={habits[key]} onChange={(event) => setHabits((current) => ({ ...current, [key]: event.target.checked }))} className="peer sr-only" />
                <span className={`grid size-9 place-items-center rounded-full border ${habits[key] ? "border-yellow-400/35 bg-yellow-400/[.07] text-yellow-300" : "border-zinc-700 text-zinc-500"}`}><HabitIcon habit={key} /></span>
                <span className="text-[9px] font-medium leading-3 sm:text-[11px] sm:leading-4">{label}</span>
                <span aria-hidden="true" className={`grid size-5 place-items-center rounded-full border text-[11px] font-black ${habits[key] ? "border-emerald-400/45 bg-emerald-400/[.08] text-emerald-300" : "border-zinc-500 text-transparent"}`}>✓</span>
              </label>
            ))}
          </div>
          <details className="mt-3 rounded-xl border border-white/[.09] bg-black/20"><summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-xs font-bold text-zinc-500"><LineIcon name="comment" className="size-4" />Agregar comentario opcional</summary><label className="block border-t border-white/[.08] p-3"><span className="sr-only">Comentario opcional</span><textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} rows={2} className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm outline-none focus:border-yellow-400" placeholder="¿Cómo estuvo tu alimentación hoy?" /></label></details>
          <button type="button" onClick={saveHabits} disabled={saving} className="mt-3 min-h-11 w-full rounded-xl border border-yellow-400/35 bg-yellow-400/[.04] px-4 text-sm font-black text-yellow-300 transition hover:bg-yellow-400/[.08] disabled:opacity-50">
            {saving ? "Guardando…" : data?.todayCheckin ? "Actualizar hábitos" : "Guardar hábitos"}
          </button>
      </section>

      <section><p className="mb-2 text-[10px] font-bold uppercase tracking-[.18em] text-yellow-400">Accesos útiles</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{quickLinks.map(([title, description, href, icon]) => <Link key={href} href={href} className="group grid min-h-[4.5rem] min-w-0 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border border-white/[.1] bg-[linear-gradient(145deg,#171717,#0c0c0c)] px-2.5 py-2 transition hover:border-yellow-400/25 focus-visible:outline-2 focus-visible:outline-yellow-300"><span className="grid size-8 shrink-0 place-items-center text-yellow-400"><LineIcon name={icon} /></span><span className="min-w-0"><span className="block truncate text-xs font-bold sm:text-sm">{title}</span><span className="mt-0.5 block truncate text-[9px] leading-3 text-zinc-500 sm:text-[10px]">{description}</span></span><span aria-hidden="true" className="text-zinc-600 transition group-hover:text-yellow-300">›</span></Link>)}</div></section>

      <section className="space-y-3">
          <article className="rounded-2xl border border-white/[.1] bg-[linear-gradient(145deg,#171717,#0c0c0c)] p-3.5 sm:p-4">
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
            ) : <div className="mt-2 flex min-h-11 items-center justify-between gap-3 rounded-xl border border-dashed border-white/[.1] bg-black/20 px-3"><p className="flex min-w-0 items-center gap-2 truncate text-xs text-zinc-500"><LineIcon name="bookmark" className="size-5 shrink-0" />Todavía no guardaste recetas.</p><Link href="/portal/nutricion/recetas" className="inline-flex min-h-11 shrink-0 items-center text-xs font-bold text-yellow-300">Explorar →</Link></div>}
          </article>
          <article className="flex items-start gap-3 rounded-2xl border border-yellow-400/15 bg-[linear-gradient(145deg,rgba(250,204,21,.045),#0b0b0b_72%)] p-3.5 sm:p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full border border-yellow-400/25 text-yellow-300"><LineIcon name="star" /></span>
            <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-yellow-400">Recomendación de tu entrenador</p>
            <p className="mt-1.5 text-sm leading-5 text-zinc-300">{data?.trainerNote?.text ?? "Todavía no hay una recomendación nueva."}</p>
            {!data?.trainerNote && <p className="mt-0.5 text-xs text-zinc-500">Cuando tu entrenador agregue una, aparecerá acá.</p>}</div>
          </article>
      </section>

      <p className="px-1 pb-1 text-[10px] leading-4 text-zinc-600 sm:text-xs sm:leading-5">
        Esta orientación acompaña tu entrenamiento y tus evaluaciones. No reemplaza la atención de un nutricionista o profesional de salud.
      </p>
    </div>
  );
}
