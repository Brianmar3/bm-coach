"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NUTRITION_HABITS } from "@/lib/nutrition";
import type { NutritionHabitKey } from "@/types/nutrition";
import type { NutritionDashboardData } from "@/types/nutrition-intelligence";
import { BmCalendarIcon, BmCheckIcon, BmChevronRightIcon, BmShieldCheckIcon, BmCommentIcon, BmBookmarkIcon, BmStarIcon, BmCartIcon, BmCookingIcon, BmBookIcon, BmLearningIcon, BmProteinIcon, BmPlantIcon, BmMealPlanIcon, BmHydrationIcon, BmChallengeIcon } from "@/componentes/icons";

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

const nutritionIcons = { calendar: BmCalendarIcon, shield: BmShieldCheckIcon, comment: BmCommentIcon, bookmark: BmBookmarkIcon, star: BmStarIcon, cart: BmCartIcon, pot: BmCookingIcon, book: BmBookIcon, learn: BmLearningIcon };
function LineIcon({ name, className = "size-5" }: { name: LineIconName; className?: string }) { const Icon = nutritionIcons[name]; return <Icon className={className} />; }
const habitIcons = { hydration: BmHydrationIcon, protein: BmProteinIcon, fruitsVegetables: BmPlantIcon, mealOrganization: BmMealPlanIcon, energy: BmChallengeIcon };
function HabitIcon({ habit }: { habit: NutritionHabitKey }) { const Icon = habitIcons[habit]; return <Icon size={24} />; }

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
        <div className="h-44 rounded-3xl bg-[var(--surface)]" />
        <div className="h-36 rounded-2xl bg-[var(--surface)]" />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-20 rounded-2xl bg-[var(--surface)]" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="nutrition-home mx-auto min-w-0 max-w-5xl">
      <header className="nutrition-context">
        <p className="nutrition-eyebrow">Tu guía para hoy{data?.studentName ? `, ${data.studentName}` : ""}</p>
        <div className="nutrition-context-title"><h1>Nutrición</h1><Link href="/portal/nutricion/preferencias" className="nutrition-text-action">Preferencias <BmChevronRightIcon size={16} /></Link></div>
        <p className="nutrition-objective">Tu objetivo: <strong>{data?.objective || "Mejorar hábitos"}</strong></p>
        <div className="nutrition-context-meta">
          <span className="nutrition-context-status">{data?.contextStatus === "FULL" ? "Personalización completa" : data?.contextStatus === "LIMITED" ? "Personalización limitada" : "Guía base"}{data?.contextStatus === "FULL" && <BmCheckIcon size={16} />}</span>
          <p><LineIcon name="calendar" className="size-4" />{data?.evaluation ? `Evaluación del ${showDate(data.evaluation.date)}` : "Guía basada en tu perfil actual"}</p>
        </div>
      </header>
      {error && <p role="alert" className="nutrition-feedback is-error">{error}</p>}
      {message && <p role="status" className="nutrition-feedback">{message}</p>}
      <section className="nutrition-today" aria-labelledby="nutrition-today-title">
        <div><p className="nutrition-eyebrow">Para hoy</p><h2 id="nutrition-today-title">{data?.recommendation.title}</h2><p className="nutrition-description">{data?.recommendation.message}</p></div>
        {data?.recommendation && <Link href={data.recommendation.href} className="bm-button bm-button-primary nutrition-primary-action">{data.recommendation.action}<BmChevronRightIcon size={20} /></Link>}
      </section>
      <section className={`nutrition-trainer ${data?.trainerNote ? "has-note" : "is-empty"}`} aria-labelledby="nutrition-trainer-title">
        <span className="nutrition-trainer-icon"><LineIcon name="star" /></span>
        <div><h2 id="nutrition-trainer-title" className="nutrition-eyebrow">Recomendación de tu entrenador</h2><p>{data?.trainerNote?.text ?? "Todavía no hay una recomendación nueva."}</p>{!data?.trainerNote && <small>Cuando tu entrenador agregue una, aparecerá acá.</small>}</div>
      </section>
      <div className="nutrition-workspace-grid">
        <section id="habitos" className="nutrition-habits" aria-labelledby="nutrition-habits-title">
          <div className="nutrition-section-heading"><div><p className="nutrition-eyebrow">Planificar</p><h2 id="nutrition-habits-title">Hábitos de hoy</h2><p className="nutrition-description">Marcá lo que pudiste sostener</p></div>{data?.summary.daysRegistered ? <div className="nutrition-week-progress"><strong>{data.summary.compliancePercentage}%</strong><span>esta semana</span></div> : null}</div>
          {data?.summary.daysRegistered ? <p className="nutrition-habit-summary">{data.summary.daysRegistered} días registrados{data.summary.strongestHabit ? ` · Mejor: ${data.summary.strongestHabit}` : ""}{data.summary.habitToImprove ? ` · Próximo foco: ${data.summary.habitToImprove}` : ""}</p> : <p className="nutrition-habit-summary">Tu resumen semanal aparecerá después del primer registro.</p>}
          <div className="nutrition-habit-list">
            {NUTRITION_HABITS.map(({ key, label }) => (
              <label key={key} className="nutrition-habit" data-selected={habits[key]}>
                <input type="checkbox" checked={habits[key]} onChange={(event) => setHabits((current) => ({ ...current, [key]: event.target.checked }))} className="peer sr-only" />
                <span className="nutrition-habit-icon"><HabitIcon habit={key} /></span><span>{label}</span><span className="nutrition-habit-check" aria-hidden="true">{habits[key] && <BmCheckIcon size={16} />}</span>
              </label>
            ))}
          </div>
          <details className="nutrition-comment"><summary><LineIcon name="comment" className="size-4" />Agregar comentario opcional</summary><label><span className="sr-only">Comentario opcional</span><textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} rows={2} placeholder="¿Cómo estuvo tu alimentación hoy?" /></label></details>
          <button type="button" onClick={saveHabits} disabled={saving} className="bm-button bm-button-secondary nutrition-save-habits">{saving ? "Guardando…" : data?.todayCheckin ? "Actualizar hábitos" : "Guardar hábitos"}</button>
        </section>
        <div className="nutrition-discovery">
          <section aria-labelledby="nutrition-tools-title">
            <h2 id="nutrition-tools-title" className="nutrition-eyebrow">Accesos útiles</h2>
            <div className="nutrition-tools">{quickLinks.map(([title, description, href, icon], index) => <Link key={href} href={href} className="nutrition-tool"><LineIcon name={icon} /><span><small>{index < 2 ? "Organizar" : "Explorar"}</small><strong>{title}</strong><span>{description}</span></span><BmChevronRightIcon size={16} /></Link>)}</div>
          </section>
          <section className="nutrition-recipes" aria-labelledby="nutrition-recipes-title">
            <div className="nutrition-section-heading"><h2 id="nutrition-recipes-title">Recetas recientes</h2><Link href="/portal/nutricion/recetas" className="nutrition-text-action">Ver todas</Link></div>
            {data?.recentRecipes.length ? <div className="nutrition-recipe-list">{data.recentRecipes.slice(0, 3).map((recipe) => <Link key={recipe.id} href={`/portal/nutricion/recetas/${recipe.id}`}><LineIcon name="bookmark" /><strong>{recipe.title}</strong><span>{recipe.preparationMinutes} min</span><BmChevronRightIcon size={16} /></Link>)}</div> : <div className="nutrition-recipes-empty"><LineIcon name="bookmark" /><div><p>Todavía no guardaste recetas.</p><small>Encontrá una opción para tu próxima comida.</small><Link href="/portal/nutricion/recetas" className="nutrition-text-action">Explorar <BmChevronRightIcon size={16} /></Link></div></div>}
          </section>
        </div>
      </div>
      <div className="nutrition-context-notices">
        {!data?.profile.personalizationEnabled && <section className="nutrition-context-notice"><div><h2 className="nutrition-personalization-title">Activá la personalización inteligente</h2><p>Adaptá la guía a tu objetivo, hábitos y preferencias.</p></div><button type="button" onClick={enablePersonalization} disabled={consenting} className="bm-button bm-button-secondary">{consenting ? "Activando…" : "Aceptar y activar"}</button></section>}
        {data?.evaluationUpdated && <section className="nutrition-context-notice"><LineIcon name="shield" /><p>Tu evaluación fue actualizada. Podés revisar tu guía; los planes guardados no cambiarán sin tu permiso.</p><Link href="/portal/nutricion/preferencias#datos-utilizados" className="nutrition-text-action">Revisar datos<BmChevronRightIcon size={16} /></Link></section>}
      </div>
      <p className="nutrition-disclaimer">Esta orientación acompaña tu entrenamiento y tus evaluaciones. No reemplaza la atención de un nutricionista o profesional de salud.</p>
    </div>
  );
}
