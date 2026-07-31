"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type {
  NutritionContextSnapshot,
  NutritionPlanMeal,
  NutritionProfileData,
  NutritionRecipeResult,
  NutritionShoppingItem,
} from "@/types/nutrition-intelligence";

type JsonRecord = Record<string, unknown>;

const mealTypes = [
  "Desayuno",
  "Almuerzo",
  "Merienda",
  "Cena",
  "Preentrenamiento",
  "Postentrenamiento",
];

async function apiBody(response: Response) {
  const text = await response.text();
  if (!text) return {} as JsonRecord;
  try {
    return JSON.parse(text) as JsonRecord;
  } catch {
    return {} as JsonRecord;
  }
}

function asArray<T>(value: unknown) {
  return Array.isArray(value) ? (value as T[]) : [];
}

function dateLabel(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("es-AR");
}

function listText(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

async function saveFavorite(contentType: string, contentId: string) {
  const response = await fetch("/api/portal/nutrition/favorites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType, contentId }),
  });
  const body = await apiBody(response);
  if (!response.ok) throw new Error(String(body.error ?? "No se pudo guardar el favorito."));
  return String(body.message ?? "Guardado en favoritos.");
}

function PageHeader({
  title,
  description,
  back = "/portal/nutricion",
}: {
  title: string;
  description: string;
  back?: string;
}) {
  return (
    <header className="rounded-3xl border border-yellow-400/15 bg-gradient-to-br from-zinc-900 to-black p-5 sm:p-6">
      <Link href={back} className="text-xs font-bold text-yellow-300">← Nutrición</Link>
      <h1 className="mt-3 text-2xl font-black">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">{description}</p>
    </header>
  );
}

function Notice({ error, message }: { error: string; message: string }) {
  return (
    <>
      {error && <p role="alert" className="rounded-xl bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
      {message && <p role="status" className="rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-300">{message}</p>}
    </>
  );
}

function Loading() {
  return <div className="h-64 animate-pulse rounded-2xl bg-zinc-900" aria-label="Cargando" />;
}

export function NutritionWorkspace({ slug }: { slug: string[] }) {
  const view = slug[0] ?? "";
  const id = slug[1] ?? "";
  if (view === "preferencias") return <PreferencesView />;
  if (view === "ideas") return <IdeasView />;
  if (view === "recetas") return <RecipesView id={id} />;
  if (view === "despensa") return <PantryView />;
  if (view === "plan") return <PlansView id={id} />;
  if (view === "compras") return <ShoppingView id={id} />;
  if (view === "aprender") return <EducationView />;
  if (view === "favoritos") return <FavoritesView />;
  if (view === "historial") return <HistoryView />;
  if (view === "asistente") return <AssistantView conversationId={id} />;
  return (
    <div className="space-y-4">
      <PageHeader title="Nutrición" description="La sección solicitada no existe." />
      <Link href="/portal/nutricion" className="inline-flex min-h-11 items-center rounded-xl bg-yellow-400 px-4 font-bold text-black">Volver al inicio</Link>
    </div>
  );
}

const emptyProfile: NutritionProfileData = {
  dietaryType: "",
  allergies: [],
  intolerances: [],
  restrictions: [],
  preferredFoods: [],
  dislikedFoods: [],
  budgetPreference: "",
  cookingTimeMinutes: null,
  cookingLevel: "",
  equipment: [],
  servings: 1,
  usualMealTimes: {},
  repetitionPreference: "",
  varietyPreference: "",
  locale: "es-AR",
  consentAt: null,
  personalizationEnabled: false,
  notificationPreferences: {},
  updatedAt: null,
};

function PreferencesView() {
  const [profile, setProfile] = useState(emptyProfile);
  const [context, setContext] = useState<NutritionContextSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/portal/nutrition/profile", { cache: "no-store" }),
      fetch("/api/portal/nutrition/context", { cache: "no-store" }),
    ]).then(async ([profileResponse, contextResponse]) => {
      const profileBody = await apiBody(profileResponse);
      const contextBody = await apiBody(contextResponse);
      if (!profileResponse.ok || !contextResponse.ok) throw new Error(String(profileBody.error ?? contextBody.error ?? "No se pudieron cargar tus preferencias."));
      setProfile((profileBody.profile as NutritionProfileData) ?? emptyProfile);
      setContext((contextBody.context as NutritionContextSnapshot) ?? null);
    }).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "No se pudieron cargar tus preferencias.");
    }).finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/portal/nutrition/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const body = await apiBody(response);
      if (!response.ok) throw new Error(String(body.error ?? "No se pudo guardar."));
      setProfile(body.profile as NutritionProfileData);
      setMessage("Preferencias actualizadas.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleConsent() {
    const enabled = !profile.personalizationEnabled;
    const response = await fetch("/api/portal/nutrition/consent", {
      method: enabled ? "PUT" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: enabled ? JSON.stringify({ personalizationEnabled: true }) : undefined,
    });
    const body = await apiBody(response);
    if (!response.ok) {
      setError(String(body.error ?? "No se pudo actualizar el consentimiento."));
      return;
    }
    setProfile((current) => ({
      ...current,
      personalizationEnabled: enabled,
      consentAt: enabled ? new Date().toISOString() : null,
    }));
    setMessage(enabled ? "Personalización activada." : "Personalización desactivada.");
  }

  async function clearPreferences() {
    if (!window.confirm("¿Eliminar tus preferencias alimentarias y desactivar la personalización? Tus recetas, planes, hábitos y evaluaciones se conservarán.")) return;
    const response = await fetch("/api/portal/nutrition/profile", {
      method: "DELETE",
    });
    const body = await apiBody(response);
    if (!response.ok) {
      setError(String(body.error ?? "No se pudieron eliminar."));
      return;
    }
    setProfile(emptyProfile);
    setMessage("Preferencias eliminadas.");
  }

  if (loading) return <Loading />;
  return (
    <div className="space-y-4">
      <PageHeader title="Preferencias alimentarias" description="Declaralas una vez y actualizalas cuando cambien. Las alergias y restricciones tienen prioridad absoluta." />
      <Notice error={error} message={message} />
      <section className="rounded-2xl border border-yellow-400/15 bg-zinc-900/80 p-5">
        <h2 className="font-bold">Personalización y consentimiento</h2>
        <p className="mt-2 text-xs leading-5 text-zinc-500">
          La personalización usa objetivo, evaluación, entrenamiento, hábitos y estas preferencias. Podés desactivarla cuando quieras; la guía local seguirá disponible.
        </p>
        <button type="button" onClick={toggleConsent} className={`mt-4 min-h-11 rounded-xl px-4 text-sm font-black ${profile.personalizationEnabled ? "border border-zinc-700 text-zinc-300" : "bg-yellow-400 text-black"}`}>
          {profile.personalizationEnabled ? "Revocar consentimiento" : "Aceptar y activar IA personalizada"}
        </button>
      </section>
      <section className="grid gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 md:grid-cols-2">
        <SelectField label="Tipo de alimentación" value={profile.dietaryType} options={["", "Omnívora", "Vegetariana", "Vegana", "Otra"]} onChange={(value) => setProfile({ ...profile, dietaryType: value })} />
        <SelectField label="Presupuesto" value={profile.budgetPreference} options={["", "Económico", "Moderado", "Flexible"]} onChange={(value) => setProfile({ ...profile, budgetPreference: value })} />
        <TextListField label="Alergias (declaración obligatoria si existen)" value={profile.allergies} onChange={(value) => setProfile({ ...profile, allergies: value })} placeholder="Ej: maní, huevo" />
        <TextListField label="Intolerancias" value={profile.intolerances} onChange={(value) => setProfile({ ...profile, intolerances: value })} placeholder="Ej: lactosa" />
        <TextListField label="Restricciones" value={profile.restrictions} onChange={(value) => setProfile({ ...profile, restrictions: value })} placeholder="Ej: sin gluten" />
        <TextListField label="Alimentos que no consumís" value={profile.dislikedFoods} onChange={(value) => setProfile({ ...profile, dislikedFoods: value })} placeholder="Separados por coma" />
        <TextListField label="Alimentos preferidos" value={profile.preferredFoods} onChange={(value) => setProfile({ ...profile, preferredFoods: value })} placeholder="Separados por coma" />
        <TextListField label="Equipamiento disponible" value={profile.equipment} onChange={(value) => setProfile({ ...profile, equipment: value })} placeholder="Ej: horno, microondas" />
        <SelectField label="Nivel de cocina" value={profile.cookingLevel} options={["", "Inicial", "Intermedio", "Avanzado"]} onChange={(value) => setProfile({ ...profile, cookingLevel: value })} />
        <label className="text-sm text-zinc-300">Tiempo habitual para cocinar
          <input type="number" min={5} max={240} value={profile.cookingTimeMinutes ?? ""} onChange={(event) => setProfile({ ...profile, cookingTimeMinutes: event.target.value ? Number(event.target.value) : null })} className="mt-2 min-h-12 w-full rounded-xl border border-zinc-700 bg-black/40 px-3 outline-none focus:border-yellow-400" />
        </label>
        <label className="text-sm text-zinc-300">Porciones habituales
          <input type="number" min={1} max={12} value={profile.servings} onChange={(event) => setProfile({ ...profile, servings: Number(event.target.value) || 1 })} className="mt-2 min-h-12 w-full rounded-xl border border-zinc-700 bg-black/40 px-3 outline-none focus:border-yellow-400" />
        </label>
        <SelectField label="Repetición aceptada" value={profile.repetitionPreference} options={["", "Poca", "Moderada", "Alta"]} onChange={(value) => setProfile({ ...profile, repetitionPreference: value })} />
        <SelectField label="Variedad deseada" value={profile.varietyPreference} options={["", "Simple", "Equilibrada", "Variada"]} onChange={(value) => setProfile({ ...profile, varietyPreference: value })} />
        <fieldset className="rounded-xl border border-zinc-800 p-4 md:col-span-2">
          <legend className="px-1 text-sm font-bold text-zinc-300">Recordatorios útiles</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {[
              ["habitReminder", "Hábito del día"],
              ["weeklyPlanning", "Planificación semanal"],
              ["activeList", "Lista activa"],
              ["newEvaluation", "Nueva evaluación"],
            ].map(([key, label]) => (
              <label key={key} className="flex min-h-11 items-center gap-2 rounded-xl bg-black/30 px-3 text-sm text-zinc-400">
                <input type="checkbox" checked={profile.notificationPreferences[key] === true} onChange={(event) => setProfile({ ...profile, notificationPreferences: { ...profile.notificationPreferences, [key]: event.target.checked } })} className="h-5 w-5 accent-yellow-400" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="md:col-span-2">
          <button type="button" onClick={save} disabled={saving} className="min-h-12 w-full rounded-xl bg-yellow-400 px-5 font-black text-black disabled:opacity-50">{saving ? "Guardando…" : "Guardar preferencias"}</button>
          {profile.updatedAt && <button type="button" onClick={clearPreferences} className="mt-3 min-h-11 w-full rounded-xl border border-red-400/20 px-4 text-xs font-bold text-red-300">Eliminar preferencias</button>}
        </div>
      </section>
      <section id="datos-utilizados" className="scroll-mt-24 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="font-bold">Datos utilizados</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Data label="Objetivo" value={context?.student.objective || "No registrado"} />
          <Data label="Evaluación" value={context?.evaluation ? dateLabel(context.evaluation.date) : "Sin evaluación"} />
          <Data label="Rutina activa" value={context?.training.routineName ?? "Sin rutina activa"} />
          <Data label="Horarios activos" value={String(context?.training.scheduledClasses.length ?? 0)} />
          <Data label="Asistencias recientes" value={String(context?.training.recentAttendances ?? 0)} />
          <Data label="Hábitos registrados" value={String(context?.habits.daysRegistered ?? 0)} />
        </div>
        <p className="mt-3 text-xs leading-5 text-zinc-600">No se envían credenciales, datos administrativos ni información de otros alumnos.</p>
      </section>
    </div>
  );
}

function IdeasView() {
  const [mealType, setMealType] = useState("Almuerzo");
  const [tags, setTags] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [ingredient, setIngredient] = useState("");
  const [budget, setBudget] = useState("");
  const [maxMinutes, setMaxMinutes] = useState(45);
  const [recipes, setRecipes] = useState<NutritionRecipeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/portal/nutrition/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealType, tags, search, ingredient, budget, maxMinutes, intention: "meal-ideas" }),
      });
      const body = await apiBody(response);
      if (!response.ok) throw new Error(String(body.error ?? "No pudimos generar opciones."));
      const data = body.data as { recipes?: NutritionRecipeResult[] };
      setRecipes(data.recipes ?? []);
      if (!data.recipes?.length) setMessage("No encontramos opciones compatibles. Revisá tus restricciones o probá otro filtro.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos generar opciones.");
    } finally {
      setLoading(false);
    }
  }

  async function saveRecipe(recipe: NutritionRecipeResult) {
    const response = await fetch("/api/portal/nutrition/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipe, source: "ideas" }),
    });
    const body = await apiBody(response);
    if (!response.ok) {
      setError(String(body.error ?? "No se pudo guardar."));
      return;
    }
    setMessage(`Guardaste “${recipe.title}”.`);
  }

  async function feedback(recipe: NutritionRecipeResult, signal: string) {
    const response = await fetch("/api/portal/nutrition/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipeId: recipe.id ?? recipe.title, signal }),
    });
    const body = await apiBody(response);
    if (!response.ok) return setError(String(body.error ?? "No se pudo guardar tu preferencia."));
    setMessage(String(body.message ?? "Preferencia guardada."));
    if (signal !== "USEFUL") setRecipes((current) => current.filter((item) => item !== recipe));
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Ideas de comidas" description="Generá entre tres y cinco opciones usando tu objetivo, preferencias, restricciones, tiempo y entrenamiento." />
      <Notice error={error} message={message} />
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Comida" value={mealType} options={mealTypes} onChange={setMealType} />
          <SelectField label="Presupuesto" value={budget} options={["", "Económico", "Moderado", "Flexible"]} onChange={setBudget} />
          <label className="text-sm text-zinc-300">Buscar por nombre o ingrediente<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ej: tortilla, pollo" className="mt-2 min-h-12 w-full rounded-xl border border-zinc-700 bg-black/40 px-3 outline-none focus:border-yellow-400" /></label>
          <label className="text-sm text-zinc-300">Ingrediente principal<input value={ingredient} onChange={(event) => setIngredient(event.target.value)} placeholder="Ej: arroz" className="mt-2 min-h-12 w-full rounded-xl border border-zinc-700 bg-black/40 px-3 outline-none focus:border-yellow-400" /></label>
          <label className="text-sm text-zinc-300">Tiempo máximo: {maxMinutes} min<input type="range" min={5} max={90} step={5} value={maxMinutes} onChange={(event) => setMaxMinutes(Number(event.target.value))} className="mt-3 w-full accent-yellow-400" /></label>
          <div>
            <p className="text-sm text-zinc-300">Prioridades</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {["Rápido", "Económico", "Para llevar", "Sin cocinar", "Sin horno", "Vegetariana"].map((tag) => (
                <button key={tag} type="button" onClick={() => setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])} className={`min-h-11 rounded-full border px-3 text-xs font-bold ${tags.includes(tag) ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-200" : "border-zinc-700 text-zinc-400"}`}>{tag}</button>
              ))}
            </div>
          </div>
        </div>
        <button type="button" onClick={generate} disabled={loading} className="mt-5 min-h-12 w-full rounded-xl bg-yellow-400 font-black text-black disabled:opacity-50">{loading ? "Generando opciones…" : recipes.length ? "Dame alternativas" : "Generar ideas"}</button>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        {recipes.map((recipe) => <RecipeCard key={recipe.id ?? recipe.title} recipe={recipe} actions={<div className="flex flex-wrap gap-2"><button type="button" onClick={() => saveRecipe(recipe)} className="min-h-11 rounded-xl bg-yellow-400 px-4 text-xs font-black text-black">Guardar receta</button><button type="button" onClick={() => feedback(recipe, "USEFUL")} className="min-h-11 rounded-xl border border-yellow-400/20 px-3 text-xs font-bold text-yellow-200">Me sirve</button><button type="button" onClick={() => feedback(recipe, "DISLIKE")} className="min-h-11 rounded-xl border border-zinc-700 px-3 text-xs font-bold text-zinc-400">No me gusta</button><button type="button" onClick={() => feedback(recipe, "RECENTLY_EATEN")} className="min-h-11 rounded-xl border border-zinc-700 px-3 text-xs font-bold text-zinc-400">Ya la comí</button><button type="button" onClick={() => feedback(recipe, "TOO_EXPENSIVE")} className="min-h-11 rounded-xl border border-zinc-700 px-3 text-xs font-bold text-zinc-400">Muy cara</button><button type="button" onClick={() => feedback(recipe, "TOO_DIFFICULT")} className="min-h-11 rounded-xl border border-zinc-700 px-3 text-xs font-bold text-zinc-400">Difícil</button><button type="button" onClick={() => feedback(recipe, "MISSING_INGREDIENTS")} className="min-h-11 rounded-xl border border-zinc-700 px-3 text-xs font-bold text-zinc-400">No tengo eso</button></div>} />)}
      </div>
    </div>
  );
}

type StoredRecipe = NutritionRecipeResult & {
  id: string;
  isFavorite: boolean;
  rating: number | null;
  createdAt: string;
};

function RecipesView({ id }: { id: string }) {
  const [recipes, setRecipes] = useState<StoredRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const load = useCallback(async () => {
    const response = await fetch(`/api/portal/nutrition/recipes${id ? `?id=${encodeURIComponent(id)}` : ""}`, { cache: "no-store" });
    const body = await apiBody(response);
    if (!response.ok) throw new Error(String(body.error ?? "No se pudieron cargar las recetas."));
    setRecipes(asArray<StoredRecipe>(body.recipes));
  }, [id]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudieron cargar.")).finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function update(recipe: StoredRecipe, input: JsonRecord) {
    const response = await fetch("/api/portal/nutrition/recipes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: recipe.id, ...input }),
    });
    const body = await apiBody(response);
    if (!response.ok) return setError(String(body.error ?? "No se pudo actualizar."));
    setMessage("Receta actualizada.");
    await load();
  }
  async function remove(recipe: StoredRecipe) {
    if (!window.confirm(`¿Eliminar “${recipe.title}”?`)) return;
    const response = await fetch(`/api/portal/nutrition/recipes?id=${encodeURIComponent(recipe.id)}`, { method: "DELETE" });
    const body = await apiBody(response);
    if (!response.ok) return setError(String(body.error ?? "No se pudo eliminar."));
    setMessage("Receta eliminada.");
    await load();
  }
  async function shopping(recipe: StoredRecipe) {
    const response = await fetch("/api/portal/nutrition/shopping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipeIds: [recipe.id], title: `Compras · ${recipe.title}` }),
    });
    const body = await apiBody(response);
    if (!response.ok) return setError(String(body.error ?? "No se pudo crear la lista."));
    window.location.assign(`/portal/nutricion/compras/${String((body.list as JsonRecord).id)}`);
  }
  if (loading) return <Loading />;
  const visibleRecipes = id ? recipes : recipes.filter((recipe) => {
    const searchable = `${recipe.title} ${recipe.ingredients.map((item) => item.name).join(" ")} ${recipe.tags.join(" ")}`.toLocaleLowerCase("es-AR");
    return (!query.trim() || searchable.includes(query.trim().toLocaleLowerCase("es-AR"))) &&
      (!filter || recipe.tags.some((tag) => tag.toLocaleLowerCase("es-AR").includes(filter.toLocaleLowerCase("es-AR"))));
  });
  return (
    <div className="space-y-4">
      <PageHeader title={id ? recipes[0]?.title ?? "Receta" : "Mis recetas"} description={id ? "Ingredientes, pasos, reemplazos y relación con tu objetivo." : "Tus recetas guardadas permanecen disponibles aunque la IA no responda."} back={id ? "/portal/nutricion/recetas" : undefined} />
      <Notice error={error} message={message} />
      {!id && recipes.length > 0 && <section className="grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 sm:grid-cols-2"><label className="text-sm text-zinc-300">Buscar<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre o ingrediente" className="mt-2 min-h-11 w-full rounded-xl border border-zinc-700 bg-black/40 px-3" /></label><SelectField label="Filtro" value={filter} options={["", "desayuno", "almuerzo", "cena", "económica", "vegetariana", "sin horno", "para llevar"]} onChange={setFilter} /></section>}
      {!visibleRecipes.length ? (
        <Empty text="Aún no guardaste recetas." action="Generar ideas" href="/portal/nutricion/ideas" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visibleRecipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} detail={id === recipe.id} actions={
              <div className="flex flex-wrap gap-2">
                {!id && <Link href={`/portal/nutricion/recetas/${recipe.id}`} className="min-h-11 rounded-xl bg-yellow-400 px-4 py-3 text-xs font-black text-black">Abrir receta</Link>}
                <button type="button" onClick={() => update(recipe, { isFavorite: !recipe.isFavorite })} className="min-h-11 rounded-xl border border-yellow-400/20 px-4 text-xs font-bold text-yellow-200">{recipe.isFavorite ? "Quitar favorito" : "Guardar favorito"}</button>
                <button type="button" onClick={() => shopping(recipe)} className="min-h-11 rounded-xl border border-zinc-700 px-4 text-xs font-bold text-zinc-300">Generar lista</button>
                <button type="button" onClick={() => update(recipe, { servings: Math.min(12, recipe.servings + 1) })} className="min-h-11 rounded-xl border border-zinc-700 px-4 text-xs font-bold text-zinc-300">+ Porción</button>
                <button type="button" onClick={() => remove(recipe)} className="min-h-11 rounded-xl border border-red-400/20 px-4 text-xs font-bold text-red-300">Eliminar</button>
              </div>
            } />
          ))}
        </div>
      )}
    </div>
  );
}

function PantryView() {
  const [ingredients, setIngredients] = useState("");
  const [result, setResult] = useState<JsonRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function generate() {
    const values = listText(ingredients);
    if (!values.length) return setError("Agregá al menos un ingrediente.");
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/portal/nutrition/pantry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: values, ingredientsText: ingredients }),
      });
      const body = await apiBody(response);
      if (!response.ok) throw new Error(String(body.error ?? "No se pudieron generar opciones."));
      setResult(body.data as JsonRecord);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron generar opciones.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="space-y-4">
      <PageHeader title="Cocinar con lo que tengo" description="Cargá ingredientes disponibles. Se guardan temporalmente durante 24 horas, no como inventario permanente." />
      <Notice error={error} message="" />
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
        <label className="text-sm text-zinc-300">Ingredientes
          <textarea value={ingredients} onChange={(event) => setIngredients(event.target.value)} rows={4} maxLength={800} placeholder="Ej: arroz, huevo, tomate, lentejas" className="mt-2 w-full rounded-xl border border-zinc-700 bg-black/40 p-3 outline-none focus:border-yellow-400" />
        </label>
        <button type="button" onClick={generate} disabled={loading} className="mt-4 min-h-12 w-full rounded-xl bg-yellow-400 font-black text-black disabled:opacity-50">{loading ? "Buscando opciones…" : "Buscar qué cocinar"}</button>
      </section>
      {result && (
        <div className="space-y-4">
          {asArray<string>(result.normalizedIngredients).length > 0 && <p className="rounded-xl border border-zinc-800 bg-black/30 p-3 text-xs text-zinc-400">Entendimos: {asArray<string>(result.normalizedIngredients).join(", ")}.</p>}
          {asArray<string>(result.blockedIngredients).length > 0 && <p role="alert" className="rounded-xl bg-red-400/10 p-3 text-xs text-red-200">No usamos ingredientes incompatibles con tus restricciones: {asArray<string>(result.blockedIngredients).join(", ")}.</p>}
          <PantryGroup title="Podés cocinar ahora" values={asArray<{ recipe: NutritionRecipeResult; missing: string[] }>(result.canCookNow)} />
          <PantryGroup title="Te falta un ingrediente" values={asArray<{ recipe: NutritionRecipeResult; missing: string[] }>(result.missingOne)} />
          <PantryGroup title="Alternativas con reemplazo" values={asArray<{ recipe: NutritionRecipeResult; missing: string[] }>(result.alternatives)} />
        </div>
      )}
    </div>
  );
}

type StoredPlan = {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
  active: boolean;
  meals: NutritionPlanMeal[];
};

function PlansView({ id }: { id: string }) {
  const [plans, setPlans] = useState<StoredPlan[]>([]);
  const [days, setDays] = useState(7);
  const [meals, setMeals] = useState(["Almuerzo", "Cena"]);
  const [budget, setBudget] = useState("");
  const [mode, setMode] = useState("Variada");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/portal/nutrition/plans", { cache: "no-store" });
    const body = await apiBody(response);
    if (!response.ok) throw new Error(String(body.error ?? "No se pudieron cargar los planes."));
    const all = asArray<StoredPlan>(body.plans);
    setPlans(id ? all.filter((item) => item.id === id) : all);
  }, [id]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudieron cargar.")).finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function generate() {
    setWorking(true);
    setError("");
    try {
      const response = await fetch("/api/portal/nutrition/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days, meals, budget, mode, startDate: new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }) }),
      });
      const body = await apiBody(response);
      if (!response.ok) throw new Error(String(body.error ?? "No se pudo generar."));
      setMessage("Planificación guardada.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo generar.");
    } finally { setWorking(false); }
  }
  async function update(plan: StoredPlan, payload: JsonRecord) {
    const response = await fetch("/api/portal/nutrition/plans", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: plan.id, ...payload }) });
    const body = await apiBody(response);
    if (!response.ok) return setError(String(body.error ?? "No se pudo actualizar."));
    setMessage(String(body.message ?? "Plan actualizado."));
    await load();
  }
  async function replaceMeal(plan: StoredPlan, meal: NutritionPlanMeal) {
    const response = await fetch("/api/portal/nutrition/ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mealType: meal.mealType }) });
    const body = await apiBody(response);
    const recipe = ((body.data as { recipes?: NutritionRecipeResult[] } | undefined)?.recipes ?? []).find((item) => item.title !== meal.title);
    if (!response.ok || !recipe) return setError(String(body.error ?? "No encontramos un reemplazo compatible."));
    await update(plan, { meals: plan.meals.map((item) => item.id === meal.id ? { ...item, title: recipe.title } : item) });
  }
  async function createShopping(plan: StoredPlan) {
    const response = await fetch("/api/portal/nutrition/shopping", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mealPlanId: plan.id, title: `Compras del plan ${dateLabel(plan.startDate)}`, budgetMode: false }) });
    const body = await apiBody(response);
    if (!response.ok) return setError(String(body.error ?? "No se pudo crear la lista."));
    window.location.assign(`/portal/nutricion/compras/${String((body.list as JsonRecord).id)}`);
  }
  async function favorite(plan: StoredPlan) {
    try {
      setMessage(await saveFavorite("plan", plan.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar el favorito.");
    }
  }
  if (loading) return <Loading />;
  return (
    <div className="space-y-4">
      <PageHeader title="Planificación semanal" description="Creá un plan estable. Las comidas guardadas no cambian automáticamente cuando cambia tu evaluación." />
      <Notice error={error} message={message} />
      {!id && (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-zinc-300">Cantidad de días
              <input type="number" min={1} max={7} value={days} onChange={(event) => setDays(Number(event.target.value) || 7)} className="mt-2 min-h-12 w-full rounded-xl border border-zinc-700 bg-black/40 px-3" />
            </label>
            <div><p className="text-sm text-zinc-300">Comidas</p><div className="mt-2 flex flex-wrap gap-2">{mealTypes.slice(0, 4).map((item) => <button key={item} type="button" onClick={() => setMeals((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item])} className={`min-h-11 rounded-full border px-3 text-xs font-bold ${meals.includes(item) ? "border-yellow-400/30 text-yellow-200" : "border-zinc-700 text-zinc-500"}`}>{item}</button>)}</div></div>
            <SelectField label="Presupuesto" value={budget} options={["", "Económico", "Moderado", "Flexible"]} onChange={setBudget} />
            <SelectField label="Tipo de planificación" value={mode} options={["Variada", "Económica", "Rápida", "Pocas recetas", "Preparación anticipada"]} onChange={setMode} />
          </div>
          <button type="button" onClick={generate} disabled={working || !meals.length} className="mt-5 min-h-12 w-full rounded-xl bg-yellow-400 font-black text-black disabled:opacity-50">{working ? "Generando plan…" : plans.length ? "Regenerar y guardar nuevo plan" : "Generar y guardar plan"}</button>
        </section>
      )}
      {!plans.length ? <Empty text="Todavía no organizaste tu semana." action="Crear planificación" href="/portal/nutricion/plan" /> : plans.map((plan) => (
        <section key={plan.id} className="rounded-2xl border border-yellow-400/15 bg-zinc-900/80 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-[10px] font-bold uppercase text-yellow-400">{plan.active ? "Plan activo" : plan.status}</p><h2 className="mt-1 font-bold">{dateLabel(plan.startDate)} al {dateLabel(plan.endDate)}</h2></div>
            {!id && <Link href={`/portal/nutricion/plan/${plan.id}`} className="text-xs font-bold text-yellow-300">Abrir →</Link>}
          </div>
          <div className="mt-4 space-y-2">
            {plan.meals.map((meal) => (
              <div key={meal.id} className="rounded-xl bg-black/35 p-3 sm:flex sm:items-center sm:justify-between sm:gap-3">
                <div className="min-w-0"><p className="text-[10px] text-zinc-500">{dateLabel(meal.dateKey)} · {meal.mealType}</p><p className="mt-1 truncate text-sm font-bold">{meal.title}</p><p className="mt-1 text-[10px] text-zinc-600">{meal.relationToTraining}</p></div>
                {id && <div className="mt-3 flex shrink-0 flex-wrap gap-2 sm:mt-0"><button type="button" onClick={() => update(plan, { meals: plan.meals.map((item) => item.id === meal.id ? { ...item, status: item.status === "COMPLETED" ? "PLANNED" : "COMPLETED" } : item) })} className="min-h-10 rounded-lg border border-zinc-700 px-3 text-[10px] font-bold">{meal.status === "COMPLETED" ? "Reabrir" : "Marcar realizada"}</button><button type="button" onClick={() => replaceMeal(plan, meal)} className="min-h-10 rounded-lg border border-yellow-400/20 px-3 text-[10px] font-bold text-yellow-300">Reemplazar</button></div>}
              </div>
            ))}
          </div>
          {id && <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => createShopping(plan)} className="min-h-11 rounded-xl bg-yellow-400 px-4 text-xs font-black text-black">Generar lista</button><button type="button" onClick={() => favorite(plan)} className="min-h-11 rounded-xl border border-yellow-400/20 px-4 text-xs font-bold text-yellow-200">Guardar favorito</button><button type="button" onClick={() => update(plan, { action: "duplicate" })} className="min-h-11 rounded-xl border border-zinc-700 px-4 text-xs font-bold">Duplicar</button><button type="button" onClick={() => update(plan, { action: "archive" })} className="min-h-11 rounded-xl border border-zinc-700 px-4 text-xs font-bold text-zinc-400">Archivar</button></div>}
        </section>
      ))}
    </div>
  );
}

type StoredList = { id: string; title: string; status: string; items: NutritionShoppingItem[]; updatedAt: string };

function ShoppingView({ id }: { id: string }) {
  const [lists, setLists] = useState<StoredList[]>([]);
  const [newItem, setNewItem] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const response = await fetch("/api/portal/nutrition/shopping", { cache: "no-store" });
    const body = await apiBody(response);
    if (!response.ok) throw new Error(String(body.error ?? "No se pudieron cargar las listas."));
    const all = asArray<StoredList>(body.lists);
    setLists(id ? all.filter((item) => item.id === id) : all);
  }, [id]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudieron cargar.")).finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function create() {
    const response = await fetch("/api/portal/nutrition/shopping", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: `Compras · ${new Date().toLocaleDateString("es-AR")}` }) });
    const body = await apiBody(response);
    if (!response.ok) return setError(String(body.error ?? "No se pudo crear."));
    window.location.assign(`/portal/nutricion/compras/${String((body.list as JsonRecord).id)}`);
  }
  async function save(list: StoredList, items: NutritionShoppingItem[], action?: string) {
    const response = await fetch("/api/portal/nutrition/shopping", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: list.id, items, action }) });
    const body = await apiBody(response);
    if (!response.ok) return setError(String(body.error ?? "No se pudo actualizar."));
    setMessage("Lista actualizada.");
    await load();
  }
  async function favorite(list: StoredList) {
    try {
      setMessage(await saveFavorite("shopping", list.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar el favorito.");
    }
  }
  if (loading) return <Loading />;
  return (
    <div className="space-y-4">
      <PageHeader title="Lista inteligente de compras" description="Agrupá ingredientes, marcá compras y mantené una lista reutilizable sin precios inventados." />
      <Notice error={error} message={message} />
      {!id && <button type="button" onClick={create} className="min-h-12 w-full rounded-xl bg-yellow-400 font-black text-black">Crear lista desde mis recetas</button>}
      {!lists.length ? <Empty text="No tenés una lista activa." action="Crear lista" href="/portal/nutricion/compras" /> : lists.map((list) => (
        <section key={list.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] uppercase text-yellow-400">{list.status}</p><h2 className="font-bold">{list.title}</h2></div>{!id && <Link href={`/portal/nutricion/compras/${list.id}`} className="text-xs font-bold text-yellow-300">Abrir →</Link>}</div>
          {id && <>
            <div className="mt-4 space-y-2">{list.items.map((item) => <div key={item.id} className="flex min-w-0 items-center gap-3 rounded-xl bg-black/35 p-3"><input aria-label={`Marcar ${item.name}`} type="checkbox" checked={item.checked} onChange={() => save(list, list.items.map((current) => current.id === item.id ? { ...current, checked: !current.checked } : current))} className="h-5 w-5 accent-yellow-400" /><div className="min-w-0 flex-1"><p className={`truncate text-sm font-bold ${item.checked ? "text-zinc-600 line-through" : ""}`}>{item.name}</p><p className="text-[10px] text-zinc-500">{item.quantity ?? "—"} {item.unit} · {item.category}</p></div><button type="button" aria-label={`Eliminar ${item.name}`} onClick={() => save(list, list.items.filter((current) => current.id !== item.id))} className="min-h-10 min-w-10 rounded-lg text-red-300">×</button></div>)}</div>
            <div className="mt-4 flex gap-2"><input value={newItem} onChange={(event) => setNewItem(event.target.value)} placeholder="Agregar alimento" className="min-h-11 min-w-0 flex-1 rounded-xl border border-zinc-700 bg-black/40 px-3" /><button type="button" onClick={() => { const name = newItem.trim(); if (!name) return; void save(list, [...list.items, { id: `manual-${Date.now()}`, name, quantity: null, unit: "", category: "Otros", checked: false }]); setNewItem(""); }} className="min-h-11 rounded-xl bg-yellow-400 px-4 text-xs font-black text-black">Agregar</button></div>
            <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => favorite(list)} className="min-h-11 rounded-xl border border-yellow-400/20 px-4 text-xs font-bold text-yellow-200">Guardar favorito</button><button type="button" onClick={() => save(list, list.items, "archive")} className="min-h-11 rounded-xl border border-zinc-700 px-4 text-xs font-bold text-zinc-400">Archivar lista</button></div>
          </>}
        </section>
      ))}
    </div>
  );
}

type EducationItem = { id: string; category: string; title: string; summary: string; body: string; durationMinutes: number; viewedAt: string | null; completedAt: string | null; favorite: boolean };
function EducationView() {
  const [content, setContent] = useState<EducationItem[]>([]);
  const [open, setOpen] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/portal/nutrition/education", { cache: "no-store" });
    const body = await apiBody(response);
    if (!response.ok) throw new Error(String(body.error ?? "No se pudo cargar."));
    setContent(asArray<EducationItem>(body.content));
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudo cargar."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function update(item: EducationItem, payload: JsonRecord) {
    const response = await fetch("/api/portal/nutrition/education", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentId: item.id, ...payload }) });
    if (!response.ok) return setError(String((await apiBody(response)).error ?? "No se pudo actualizar."));
    await load();
  }
  return (
    <div className="space-y-4">
      <PageHeader title="Aprender" description="Lecciones breves sobre organización, entrenamiento y hábitos. Sin cursos extensos ni lenguaje clínico." />
      <Notice error={error} message="" />
      <div className="grid gap-3 lg:grid-cols-2">{content.map((item) => <article key={item.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5"><p className="text-[10px] font-bold uppercase text-yellow-400">{item.category} · {item.durationMinutes} min</p><h2 className="mt-2 font-bold">{item.title}</h2><p className="mt-2 text-sm leading-6 text-zinc-500">{item.summary}</p>{open === item.id && <p className="mt-3 rounded-xl bg-black/35 p-3 text-sm leading-6 text-zinc-300">{item.body}</p>}<div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => { setOpen(open === item.id ? "" : item.id); if (!item.viewedAt) void update(item, {}); }} className="min-h-11 rounded-xl bg-yellow-400 px-4 text-xs font-black text-black">{open === item.id ? "Cerrar" : "Leer"}</button><button type="button" onClick={() => update(item, { completed: !item.completedAt })} className="min-h-11 rounded-xl border border-zinc-700 px-4 text-xs font-bold">{item.completedAt ? "Completada ✓" : "Marcar completa"}</button><button type="button" onClick={() => update(item, { favorite: !item.favorite })} className="min-h-11 rounded-xl border border-yellow-400/20 px-4 text-xs font-bold text-yellow-200">{item.favorite ? "★ Favorita" : "☆ Favorito"}</button></div></article>)}</div>
    </div>
  );
}

type Favorite = { id: string; contentType: string; contentId: string; label: string; createdAt: string };
function FavoritesView() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/portal/nutrition/favorites", { cache: "no-store" });
    const body = await apiBody(response);
    if (!response.ok) throw new Error(String(body.error ?? "No se pudieron cargar."));
    setFavorites(asArray<Favorite>(body.favorites));
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudieron cargar."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function remove(id: string) {
    const response = await fetch(`/api/portal/nutrition/favorites?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!response.ok) return setError(String((await apiBody(response)).error ?? "No se pudo eliminar."));
    await load();
  }
  function favoriteHref(item: Favorite) {
    if (item.contentType === "recipe") return `/portal/nutricion/recetas/${item.contentId}`;
    if (item.contentType === "plan") return `/portal/nutricion/plan/${item.contentId}`;
    if (item.contentType === "shopping") return `/portal/nutricion/compras/${item.contentId}`;
    if (item.contentType === "education") return "/portal/nutricion/aprender";
    return "/portal/nutricion";
  }
  return <div className="space-y-4"><PageHeader title="Favoritos" description="Tus recetas, planes, listas y contenidos elegidos en un solo lugar." /><Notice error={error} message="" />{!favorites.length ? <Empty text="Todavía no guardaste favoritos." action="Explorar recetas" href="/portal/nutricion/ideas" /> : <div className="space-y-2">{favorites.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4"><Link href={favoriteHref(item)} className="min-w-0 flex-1 rounded-lg focus-visible:outline-2 focus-visible:outline-yellow-300"><p className="truncate font-bold">{item.label}</p><p className="text-[10px] uppercase text-zinc-500">{item.contentType}</p></Link><button type="button" onClick={() => remove(item.id)} className="min-h-11 rounded-xl border border-red-400/20 px-4 text-xs font-bold text-red-300">Quitar</button></div>)}</div>}</div>;
}

type HistoryItem = { id: string; type: string; title: string; createdAt: string };
function HistoryView() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/portal/nutrition/history", { cache: "no-store" });
    const body = await apiBody(response);
    if (!response.ok) throw new Error(String(body.error ?? "No se pudo cargar."));
    setHistory(asArray<HistoryItem>(body.history));
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudo cargar."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function clear() {
    if (!window.confirm("¿Eliminar recetas, planes, listas, conversaciones e historial de Nutrición? Las evaluaciones y hábitos diarios no se borrarán.")) return;
    const response = await fetch("/api/portal/nutrition/history?all=true", { method: "DELETE" });
    const body = await apiBody(response);
    if (!response.ok) return setError(String(body.error ?? "No se pudo eliminar."));
    setMessage("Historial de Nutrición eliminado.");
    await load();
  }
  async function remove(item: HistoryItem) {
    if (!window.confirm(`¿Eliminar "${item.title}" del historial?`)) return;
    const response = await fetch(`/api/portal/nutrition/history?id=${encodeURIComponent(item.id)}&type=${encodeURIComponent(item.type)}`, { method: "DELETE" });
    const body = await apiBody(response);
    if (!response.ok) {
      setError(String(body.error ?? "No se pudo eliminar el elemento."));
      return;
    }
    setHistory((current) => current.filter((currentItem) => !(currentItem.id === item.id && currentItem.type === item.type)));
    setMessage(String(body.message ?? "Elemento eliminado."));
  }
  return <div className="space-y-4"><PageHeader title="Historial" description="Recetas, planes, listas, recomendaciones y conversaciones, separados de tus evaluaciones." /><Notice error={error} message={message} />{history.length ? <><button type="button" onClick={clear} className="min-h-11 rounded-xl border border-red-400/20 px-4 text-xs font-bold text-red-300">Borrar historial completo</button><div className="space-y-2">{history.map((item) => <article key={`${item.type}-${item.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4"><div className="min-w-0"><p className="text-[10px] font-bold uppercase text-yellow-400">{item.type}</p><p className="mt-1 truncate font-bold">{item.title}</p><p className="mt-1 text-xs text-zinc-600">{new Date(item.createdAt).toLocaleString("es-AR")}</p></div><button type="button" onClick={() => remove(item)} className="min-h-11 shrink-0 rounded-xl border border-red-400/20 px-3 text-xs font-bold text-red-300">Eliminar</button></article>)}</div></> : <Empty text="Todavía no hay actividad en tu historial." action="Volver a Nutrición" href="/portal/nutricion" />}</div>;
}

type Conversation = { id: string; title: string; messages: Array<{ id: string; role: string; content: string; createdAt: string }> };
function AssistantView({ conversationId }: { conversationId: string }) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const suggestions = ["¿Qué puedo comer antes de entrenar?", "Dame una cena económica.", "¿Qué preparo con lo que tengo?", "¿Cómo mejoro mi hidratación?", "Explicame para qué sirve la proteína."];
  useEffect(() => {
    if (!conversationId) return;
    fetch(`/api/portal/nutrition/assistant?conversationId=${encodeURIComponent(conversationId)}`, { cache: "no-store" }).then(async (response) => {
      const body = await apiBody(response);
      if (!response.ok) throw new Error(String(body.error ?? "No se pudo cargar."));
      setConversation(asArray<Conversation>(body.conversations)[0] ?? null);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudo cargar."));
  }, [conversationId]);
  async function send(value = question) {
    const clean = value.trim();
    if (!clean || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/portal/nutrition/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: clean, conversationId: conversation?.id || conversationId || undefined }) });
      const body = await apiBody(response);
      if (!response.ok) throw new Error(String(body.error ?? "No pudimos responder en este momento."));
      const next = body.conversation as Conversation;
      setConversation(next);
      setQuestion("");
      if (!conversationId) window.history.replaceState(null, "", `/portal/nutricion/asistente/${next.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos responder.");
    } finally { setSending(false); }
  }
  return (
    <div className="space-y-4">
      <PageHeader title="Asistente de Nutrición" description="Una función secundaria para resolver dudas prácticas usando tu objetivo, preferencias y evaluación actual." />
      <Notice error={error} message="" />
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
        <p className="text-xs text-zinc-500">Usando tu objetivo, preferencias y evaluación actual. <Link href="/portal/nutricion/preferencias#datos-utilizados" className="font-bold text-yellow-300">Ver datos utilizados</Link></p>
        {!conversation?.messages.length && <div className="mt-4 flex flex-wrap gap-2">{suggestions.map((item) => <button key={item} type="button" onClick={() => send(item)} className="min-h-11 rounded-full border border-yellow-400/20 px-3 text-left text-xs font-bold text-yellow-100">{item}</button>)}</div>}
        <div className="mt-4 max-h-[55vh] space-y-3 overflow-y-auto pr-1">{conversation?.messages.map((item) => <div key={item.id} className={`max-w-[90%] rounded-2xl p-3 text-sm leading-6 ${item.role === "USER" ? "ml-auto bg-yellow-400 text-black" : "bg-black/50 text-zinc-200"}`}>{item.content}</div>)}</div>
        <div className="mt-4 flex items-end gap-2"><label className="min-w-0 flex-1 text-xs text-zinc-400">Tu pregunta<textarea value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={800} rows={2} className="mt-1 w-full resize-none rounded-xl border border-zinc-700 bg-black/50 p-3 text-sm text-white outline-none focus:border-yellow-400" placeholder="Contame qué necesitás organizar…" /></label><button type="button" onClick={() => send()} disabled={sending || !question.trim()} className="min-h-12 rounded-xl bg-yellow-400 px-4 text-xs font-black text-black disabled:opacity-50">{sending ? "Enviando…" : "Enviar"}</button></div>
      </section>
      <p className="rounded-xl border border-zinc-800 p-3 text-xs leading-5 text-zinc-500">Esta orientación no diagnostica ni reemplaza una consulta profesional. Las consultas clínicas se derivan de forma segura.</p>
    </div>
  );
}

function RecipeCard({ recipe, onSave, actions, detail = false }: { recipe: NutritionRecipeResult; onSave?: () => void; actions?: ReactNode; detail?: boolean }) {
  const budget = recipe.budgetLevel === "VERY_LOW" ? "Muy económica" : recipe.budgetLevel === "LOW" ? "Económica" : recipe.budgetLevel === "MODERATE" ? "Moderada" : recipe.budgetLevel === "HIGH" ? "Más costosa" : "";
  return <article className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="text-lg font-black">{recipe.title}</h2><p className="mt-1 text-xs text-zinc-500">{recipe.preparationMinutes} min · {recipe.difficulty} · {recipe.servings} porción/es{budget ? ` · ${budget}` : ""}</p></div></div><p className="mt-3 text-sm leading-6 text-zinc-300">{recipe.description}</p><div className="mt-4"><h3 className="text-xs font-bold uppercase text-yellow-400">Ingredientes</h3><ul className="mt-2 space-y-1 text-sm text-zinc-400">{recipe.ingredients.map((item, index) => <li key={`${item.name}-${index}`}>{item.quantity ?? "—"} {item.unit} · {item.name}{item.optional ? " (opcional)" : ""}</li>)}</ul></div>{detail && <><div className="mt-4"><h3 className="text-xs font-bold uppercase text-yellow-400">Preparación</h3><ol className="mt-2 space-y-2 text-sm leading-6 text-zinc-300">{recipe.steps.map((step, index) => <li key={step}><span className="mr-2 text-yellow-300">{index + 1}.</span>{step}</li>)}</ol></div>{recipe.substitutions.length > 0 && <div className="mt-4 rounded-xl bg-black/35 p-3"><h3 className="text-xs font-bold text-yellow-300">Reemplazos</h3>{recipe.substitutions.map((item) => <p key={item.ingredient} className="mt-1 text-xs text-zinc-400">{item.ingredient} → {item.replacement}</p>)}</div>}</>}<p className="mt-4 text-xs leading-5 text-zinc-500">{recipe.rationale}</p><div className="mt-4">{actions ?? (onSave && <button type="button" onClick={onSave} className="min-h-11 rounded-xl bg-yellow-400 px-4 text-xs font-black text-black">Guardar receta</button>)}</div></article>;
}

function PantryGroup({ title, values }: { title: string; values: Array<{ recipe: NutritionRecipeResult; missing: string[] }> }) {
  return <section><h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-yellow-300">{title}</h2>{values.length ? <div className="grid gap-3 lg:grid-cols-2">{values.map((item) => <article key={item.recipe.title} className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4"><h3 className="font-bold">{item.recipe.title}</h3><p className="mt-1 text-xs text-zinc-500">{item.recipe.preparationMinutes} min</p>{item.missing.length > 0 && <p className="mt-2 text-xs text-yellow-100">Falta: {item.missing.join(", ")}</p>}<Link href={`/portal/nutricion/ideas?tipo=${encodeURIComponent(item.recipe.tags[0] ?? "")}`} className="mt-3 inline-flex min-h-10 items-center text-xs font-bold text-yellow-300">Ver alternativas →</Link></article>)}</div> : <p className="rounded-xl border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">No hay opciones seguras en esta categoría.</p>}</section>;
}

function TextListField({ label, value, onChange, placeholder }: { label: string; value: string[]; onChange: (value: string[]) => void; placeholder: string }) {
  return <label className="text-sm text-zinc-300">{label}<input value={value.join(", ")} onChange={(event) => onChange(listText(event.target.value))} placeholder={placeholder} className="mt-2 min-h-12 w-full rounded-xl border border-zinc-700 bg-black/40 px-3 outline-none focus:border-yellow-400" /></label>;
}
function SelectField({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return <label className="text-sm text-zinc-300">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-zinc-700 bg-black/40 px-3 outline-none focus:border-yellow-400">{options.map((option) => <option key={option || "none"} value={option}>{option || "Seleccionar"}</option>)}</select></label>;
}
function Data({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-zinc-900 p-3"><p className="text-[9px] uppercase tracking-wide text-zinc-600">{label}</p><p className="mt-1 text-sm font-bold text-zinc-300">{value}</p></div>;
}
function Empty({ text, action, href }: { text: string; action: string; href: string }) {
  return <div className="rounded-2xl border border-dashed border-zinc-700 p-6 text-center"><p className="text-sm text-zinc-500">{text}</p><Link href={href} className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-yellow-400 px-4 text-xs font-black text-black">{action}</Link></div>;
}
