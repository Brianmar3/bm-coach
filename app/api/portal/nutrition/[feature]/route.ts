import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPortalSession, validRequestOrigin } from "@/lib/portal-auth";
import { argentinaDateKey, dateKeyToDatabase } from "@/lib/payment-dates";
import { finalizeNutritionAIReservation, generateNutrition, nutritionAIUsageStatus, releaseNutritionAIReservation, resolveMaxContextMessages } from "@/lib/nutrition-ai";
import {
  buildNutritionContext,
  serializeNutritionProfile,
} from "@/lib/nutrition-context";
import { educationPriority, NUTRITION_EDUCATION, NUTRITION_EDUCATION_CATEGORIES, quizResult } from "@/lib/nutrition-education";
import {
  safeInteger,
  safeText,
  shoppingItemsFromRecipes,
  stringList,
  validateRecipeResult,
  normalizeIngredientInput,
} from "@/lib/nutrition-rules";
import { catalogRecipesByTitles } from "@/lib/nutrition-catalog";
import type {
  NutritionPlanMeal,
  NutritionRecipeResult,
  NutritionShoppingItem,
} from "@/types/nutrition-intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FEATURES = new Set([
  "profile",
  "context",
  "ideas",
  "recipes",
  "pantry",
  "plans",
  "shopping",
  "favorites",
  "history",
  "education",
  "assistant",
  "consent",
  "feedback",
]);

async function authorize(feature: string) {
  if (!FEATURES.has(feature)) return { error: "Función no disponible.", status: 404 } as const;
  const session = await getPortalSession();
  if (!session) return { error: "Sesión vencida.", status: 401 } as const;
  return { session } as const;
}

function jsonValue(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function parseJsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function updatedConversationSummary(previous: string, messages: Array<{ role: string; content: string }>) {
  const compact = messages.slice(-10).map((message) =>
    `${message.role === "ASSISTANT" ? "Asistente" : "Alumno"}: ${safeText(message.content, 220)}`,
  ).join("\n");
  return `${previous.trim()}${previous.trim() ? "\n" : ""}${compact}`.slice(-1400);
}

function parsePlanMeals(value: unknown): NutritionPlanMeal[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const id = safeText(record.id, 100);
    const dateKey = safeText(record.dateKey, 10);
    const title = safeText(record.title, 120);
    const mealType = safeText(record.mealType, 40);
    if (!id || !title || !mealType || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return [];
    return [{
      id,
      dateKey,
      title,
      mealType,
      suggestedTime: safeText(record.suggestedTime, 5),
      relationToTraining: safeText(record.relationToTraining, 220),
      status: record.status === "COMPLETED" ? "COMPLETED" as const : "PLANNED" as const,
    }];
  }).slice(0, 50);
}

function parseShoppingItems(value: unknown): NutritionShoppingItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const name = safeText(record.name, 80);
    if (!name) return [];
    const quantity = Number(record.quantity);
    return [{
      id: safeText(record.id, 100) || `item-${index + 1}`,
      name,
      quantity: Number.isFinite(quantity) && quantity >= 0 ? quantity : null,
      unit: safeText(record.unit, 30),
      category: safeText(record.category, 50) || "Otros",
      checked: record.checked === true,
      optional: record.optional === true,
    }];
  }).slice(0, 100);
}

function recipePayload(recipe: NutritionRecipeResult) {
  const metadataTags = [
    ...recipe.tags,
    ...(recipe.mealTypes ?? []),
    ...(recipe.id ? [`catalog:${recipe.id}`] : []),
    ...(recipe.budgetLevel ? [`presupuesto:${recipe.budgetLevel.toLocaleLowerCase()}`] : []),
    ...(recipe.cookingMethod ? [`coccion:${recipe.cookingMethod}`] : []),
  ];
  return {
    title: recipe.title,
    description: recipe.description,
    servings: recipe.servings,
    preparationMinutes: recipe.preparationMinutes,
    difficulty: recipe.difficulty,
    ingredients: jsonValue(recipe.ingredients),
    steps: jsonValue(recipe.steps),
    equipment: recipe.equipment,
    substitutions: jsonValue(recipe.substitutions),
    tags: [...new Set(metadataTags)],
    warnings: recipe.warnings,
    rationale: recipe.rationale,
  };
}

async function analytics(studentId: string, event: string, metadata?: Record<string, unknown>) {
  await prisma.nutritionAnalyticsEvent.create({
    data: {
      studentId,
      event,
      metadata: metadata ? jsonValue(metadata) : undefined,
    },
  });
}

export async function GET(
  request: Request,
  context: RouteContext<"/api/portal/nutrition/[feature]">,
) {
  const { feature } = await context.params;
  const auth = await authorize(feature);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  const studentId = auth.session.studentId;
  const search = new URL(request.url).searchParams;

  if (feature === "profile") {
    const profile = await prisma.nutritionProfile.findUnique({ where: { studentId } });
    return Response.json({ profile: serializeNutritionProfile(profile) });
  }
  if (feature === "context") {
    return Response.json({ context: await buildNutritionContext(studentId) });
  }
  if (feature === "recipes") {
    const id = search.get("id");
    const recipes = await prisma.nutritionRecipe.findMany({
      where: { studentId, ...(id ? { id } : {}) },
      orderBy: { updatedAt: "desc" },
      take: id ? 1 : 50,
    });
    return Response.json({ recipes });
  }
  if (feature === "plans") {
    const plans = await prisma.nutritionMealPlan.findMany({
      where: { studentId },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });
    return Response.json({ plans });
  }
  if (feature === "shopping") {
    const lists = await prisma.nutritionShoppingList.findMany({
      where: { studentId },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });
    return Response.json({ lists });
  }
  if (feature === "favorites") {
    const favorites = await prisma.nutritionFavorite.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return Response.json({ favorites });
  }
  if (feature === "education") {
    const [progress, attempts, nutritionContext] = await Promise.all([
      prisma.nutritionEducationProgress.findMany({ where: { studentId } }),
      prisma.nutritionEducationQuizAttempt.findMany({
        where: { studentId },
        orderBy: { answeredAt: "desc" },
      }),
      buildNutritionContext(studentId),
    ]);
    const byId = new Map(progress.map((item) => [item.contentId, item]));
    const latestAttempt = new Map<string, (typeof attempts)[number]>();
    for (const attempt of attempts) if (!latestAttempt.has(attempt.contentId)) latestAttempt.set(attempt.contentId, attempt);
    const completedCount = progress.filter((item) => item.completedAt).length;
    const continueItem = [...progress]
      .filter((item) => item.viewedAt && !item.completedAt)
      .sort((left, right) => (right.updatedAt?.getTime() ?? 0) - (left.updatedAt?.getTime() ?? 0))[0];
    const recommendationScore = (item: (typeof NUTRITION_EDUCATION)[number]) => {
      const activityBoost = nutritionContext.training.recentAttendances > 0
        && (item.category === "Alimentación antes de entrenar" || item.category === "Alimentación después de entrenar" || item.category === "Alimentación y rendimiento") ? 4 : 0;
      const habitBoost = (nutritionContext.habits.habitToImprove ?? "").toLocaleLowerCase("es").includes("hidrat")
        && item.category === "Hidratación" ? 6 : 0;
      return educationPriority(item, nutritionContext.student.objective, Boolean(byId.get(item.id)?.completedAt)) + activityBoost + habitBoost;
    };
    const recommendedIds = [...NUTRITION_EDUCATION]
      .sort((left, right) => recommendationScore(right) - recommendationScore(left))
      .slice(0, 6)
      .map((item) => item.id);
    return Response.json({
      content: NUTRITION_EDUCATION.map((item) => ({
        ...item,
        viewedAt: byId.get(item.id)?.viewedAt?.toISOString() ?? null,
        completedAt: byId.get(item.id)?.completedAt?.toISOString() ?? null,
        favorite: byId.get(item.id)?.favorite ?? false,
        lastSection: byId.get(item.id)?.lastSection ?? "",
        quizAttempt: latestAttempt.get(item.id) ? {
          selectedAnswer: latestAttempt.get(item.id)!.selectedAnswer,
          correct: latestAttempt.get(item.id)!.correct,
          answeredAt: latestAttempt.get(item.id)!.answeredAt.toISOString(),
        } : null,
      })),
      categories: NUTRITION_EDUCATION_CATEGORIES,
      progress: {
        completed: completedCount,
        total: NUTRITION_EDUCATION.length,
        percentage: Math.round((completedCount / NUTRITION_EDUCATION.length) * 100),
        continueContentId: continueItem?.contentId ?? null,
        recommendedIds,
      },
    });
  }
  if (feature === "assistant") {
    const conversationId = search.get("conversationId");
    const conversations = await prisma.nutritionConversation.findMany({
      where: { studentId, ...(conversationId ? { id: conversationId } : {}) },
      include: { messages: { orderBy: { createdAt: "asc" }, take: 50 } },
      orderBy: { updatedAt: "desc" },
      take: conversationId ? 1 : 20,
    });
    return Response.json({ conversations, usage: await nutritionAIUsageStatus(studentId) });
  }
  if (feature === "history") {
    const [recipes, plans, lists, conversations, interactions] = await Promise.all([
      prisma.nutritionRecipe.findMany({ where: { studentId }, select: { id: true, title: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 30 }),
      prisma.nutritionMealPlan.findMany({ where: { studentId }, select: { id: true, status: true, startDate: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 30 }),
      prisma.nutritionShoppingList.findMany({ where: { studentId }, select: { id: true, title: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 30 }),
      prisma.nutritionConversation.findMany({ where: { studentId }, select: { id: true, title: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 30 }),
      prisma.nutritionAIInteraction.findMany({ where: { studentId }, select: { id: true, feature: true, outputSummary: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 30 }),
    ]);
    const history = [
      ...recipes.map((item) => ({ id: item.id, type: "recipe", title: item.title, createdAt: item.createdAt })),
      ...plans.map((item) => ({ id: item.id, type: "plan", title: `Plan desde ${item.startDate.toISOString().slice(0, 10)}`, createdAt: item.createdAt })),
      ...lists.map((item) => ({ id: item.id, type: "shopping", title: item.title, createdAt: item.createdAt })),
      ...conversations.map((item) => ({ id: item.id, type: "conversation", title: item.title, createdAt: item.createdAt })),
      ...interactions.map((item) => ({ id: item.id, type: "recommendation", title: item.outputSummary || item.feature, createdAt: item.createdAt })),
    ].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    return Response.json({ history: history.slice(0, 100) });
  }
  return Response.json({ error: "Usá una acción válida para esta función." }, { status: 405 });
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/portal/nutrition/[feature]">,
) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const { feature } = await context.params;
  const auth = await authorize(feature);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  const studentId = auth.session.studentId;
  const input = parseJsonObject(await request.json().catch(() => null));

  try {
    if (feature === "ideas" || feature === "pantry") {
      const result = await generateNutrition(studentId, feature, input);
      if (feature === "pantry") {
        const ingredients = normalizeIngredientInput(
          typeof input.ingredientsText === "string"
            ? input.ingredientsText
            : stringList(input.ingredients, 30),
        );
        await prisma.nutritionPantrySession.create({
          data: {
            studentId,
            ingredients: jsonValue(ingredients),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
        await analytics(studentId, "pantry_recipe_generated");
      } else {
        await analytics(studentId, "idea_generated");
      }
      return Response.json(result);
    }
    if (feature === "recipes") {
      const recipe = validateRecipeResult(input.recipe);
      if (!recipe) return Response.json({ error: "La receta no tiene una estructura válida." }, { status: 400 });
      const nutritionContext = await buildNutritionContext(studentId);
      const generated = await prisma.nutritionRecipe.create({
        data: {
          studentId,
          ...recipePayload(recipe),
          source: safeText(input.source, 30) || "saved",
          aiModelVersion: safeText(input.modelVersion, 80) || null,
          contextSnapshot: jsonValue(nutritionContext),
          isFavorite: input.isFavorite === true,
        },
      });
      await analytics(studentId, "recipe_saved", { recipeId: generated.id });
      return Response.json({ recipe: generated, message: "Receta guardada." }, { status: 201 });
    }
    if (feature === "plans") {
      const result = await generateNutrition(studentId, "plan", input);
      const generated = result.data as { startDate?: unknown; endDate?: unknown; meals?: unknown; recipes?: unknown };
      const startDate = safeText(generated.startDate, 10);
      const endDate = safeText(generated.endDate, 10);
      const meals = parsePlanMeals(generated.meals);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || !meals.length) {
        return Response.json({ error: "No pudimos generar una planificación válida." }, { status: 422 });
      }
      const plan = await prisma.$transaction(async (transaction) => {
        await transaction.nutritionMealPlan.updateMany({
          where: { studentId, active: true },
          data: { active: false, status: "ARCHIVED" },
        });
        return transaction.nutritionMealPlan.create({
          data: {
            studentId,
            startDate: dateKeyToDatabase(startDate),
            endDate: dateKeyToDatabase(endDate),
            configuration: jsonValue({ ...input, generatedRecipes: generated.recipes ?? [] }),
            meals: jsonValue(meals),
            contextSnapshot: jsonValue(result.context),
          },
        });
      });
      await analytics(studentId, "meal_plan_saved", { planId: plan.id });
      return Response.json({ plan, message: "Planificación guardada." }, { status: 201 });
    }
    if (feature === "shopping") {
      const requestedMealPlanId = safeText(input.mealPlanId, 100);
      const ownedMealPlan = requestedMealPlanId
        ? await prisma.nutritionMealPlan.findFirst({
            where: { id: requestedMealPlanId, studentId },
            select: { id: true, meals: true, configuration: true },
          })
        : null;
      if (requestedMealPlanId && !ownedMealPlan) {
        return Response.json(
          { error: "El plan seleccionado no existe." },
          { status: 404 },
        );
      }
      const recipeIds = stringList(input.recipeIds, 30);
      const recipes = await prisma.nutritionRecipe.findMany({
        where: { studentId, ...(recipeIds.length ? { id: { in: recipeIds } } : {}) },
        orderBy: { updatedAt: "desc" },
        take: recipeIds.length ? 30 : 5,
      });
      let parsedRecipes = recipes.flatMap((recipe) => {
        const candidate = validateRecipeResult({
          ...recipe,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
          substitutions: recipe.substitutions,
        });
        return candidate ? [candidate] : [];
      });
      if (ownedMealPlan) {
        const meals = parsePlanMeals(ownedMealPlan.meals);
        const configuration = parseJsonObject(ownedMealPlan.configuration);
        const storedGenerated = Array.isArray(configuration.generatedRecipes)
          ? configuration.generatedRecipes.flatMap((value) => {
              const recipe = validateRecipeResult(value);
              return recipe ? [recipe] : [];
            })
          : [];
        parsedRecipes = storedGenerated.length
          ? storedGenerated
          : catalogRecipesByTitles(meals.map((meal) => meal.title));
      }
      if (!parsedRecipes.length) {
        const generated = await generateNutrition(studentId, "ideas", { tags: ["económico"] });
        parsedRecipes = ((generated.data as { recipes?: NutritionRecipeResult[] }).recipes ?? []);
      }
      const items = shoppingItemsFromRecipes(parsedRecipes);
      const list = await prisma.nutritionShoppingList.create({
        data: {
          studentId,
          mealPlanId: ownedMealPlan?.id ?? null,
          title: safeText(input.title, 100) || `Compras · ${argentinaDateKey()}`,
          budgetMode: input.budgetMode === true,
          items: jsonValue(items),
        },
      });
      await analytics(studentId, "shopping_list_generated", { listId: list.id });
      return Response.json({ list, message: "Lista de compras creada." }, { status: 201 });
    }
    if (feature === "feedback") {
      const recipeId = safeText(input.recipeId, 120);
      const signal = safeText(input.signal, 40);
      const allowed = new Set([
        "USEFUL",
        "DISLIKE",
        "RECENTLY_EATEN",
        "TOO_EXPENSIVE",
        "TOO_DIFFICULT",
        "MISSING_INGREDIENTS",
      ]);
      if (!recipeId || !allowed.has(signal)) {
        return Response.json({ error: "La señal de preferencia no es válida." }, { status: 400 });
      }
      await analytics(studentId, "recipe_feedback", { recipeId, signal });
      return Response.json({ message: "Preferencia guardada." });
    }
    if (feature === "favorites") {
      const contentType = safeText(input.contentType, 40);
      const contentId = safeText(input.contentId, 120);
      if (!contentType || !contentId) return Response.json({ error: "El favorito no es válido." }, { status: 400 });
      let label = "";
      if (contentType === "recipe") {
        label = (await prisma.nutritionRecipe.findFirst({
          where: { id: contentId, studentId },
          select: { title: true },
        }))?.title ?? "";
      } else if (contentType === "plan") {
        const plan = await prisma.nutritionMealPlan.findFirst({
          where: { id: contentId, studentId },
          select: { startDate: true },
        });
        label = plan ? `Plan desde ${plan.startDate.toISOString().slice(0, 10)}` : "";
      } else if (contentType === "shopping") {
        label = (await prisma.nutritionShoppingList.findFirst({
          where: { id: contentId, studentId },
          select: { title: true },
        }))?.title ?? "";
      } else if (contentType === "education") {
        label = NUTRITION_EDUCATION.find((item) => item.id === contentId)?.title ?? "";
      }
      if (!label) return Response.json({ error: "El contenido no existe o no te pertenece." }, { status: 404 });
      const favorite = await prisma.nutritionFavorite.upsert({
        where: { studentId_contentType_contentId: { studentId, contentType, contentId } },
        create: { studentId, contentType, contentId, label },
        update: { label },
      });
      return Response.json({ favorite, message: "Guardado en favoritos." });
    }
    if (feature === "assistant") {
      const question = safeText(input.question, 800);
      if (!question) return Response.json({ error: "Escribí una pregunta." }, { status: 400 });
      const requestKey = safeText(input.requestKey, 100);
      if (!requestKey) return Response.json({ error: "Falta identificar el envío." }, { status: 400 });
      const conversationId = safeText(input.conversationId, 100);
      const ownedConversation = conversationId
        ? await prisma.nutritionConversation.findFirst({
            where: { id: conversationId, studentId },
            include: {
              messages: {
                orderBy: { createdAt: "desc" },
                take: resolveMaxContextMessages(),
              },
            },
          })
        : null;
      if (conversationId && !ownedConversation) return Response.json({ error: "La conversación no existe." }, { status: 404 });
      const recentMessages = [...(ownedConversation?.messages ?? [])].reverse().map((message) => ({
        role: message.role === "ASSISTANT" ? "assistant" as const : "user" as const,
        content: message.content,
      }));
      const result = await generateNutrition(
        studentId,
        "assistant",
        { question, intention: "question" },
        {
          requestKey,
          conversationSummary: ownedConversation?.contextSummary ?? "",
          recentMessages,
        },
      );
      const answer = safeText((result.data as { answer?: unknown }).answer, 1200);
      let conversation;
      let remainingAfterResponse: number | null = null;
      try {
        const saved = await prisma.$transaction(async (transaction) => {
          const current = ownedConversation ?? await transaction.nutritionConversation.create({
            data: {
              studentId,
              title: question.slice(0, 80),
              contextSummary: `${result.context.student.objective} · ${result.context.evaluation?.date ?? "sin evaluación"}`,
            },
          });
          const newMessages = [
            { role: "USER", content: question },
            { role: "ASSISTANT", content: answer },
          ];
          await transaction.nutritionMessage.createMany({
            data: [
              { conversationId: current.id, role: "USER", content: question },
              {
                conversationId: current.id,
                role: "ASSISTANT",
                content: answer,
                structuredData: jsonValue({ actions: (result.data as { actions?: unknown }).actions ?? [] }),
                safetyCategory: result.safetyCategory,
                modelVersion: result.modelVersion,
              },
            ],
          });
          const remaining = result.quotaReservation
            ? await finalizeNutritionAIReservation(transaction, result.quotaReservation, current.id)
            : null;
          const updated = await transaction.nutritionConversation.update({
            where: { id: current.id },
            data: {
              updatedAt: new Date(),
              contextSummary: updatedConversationSummary(
                current.contextSummary,
                [...recentMessages.map((message) => ({ role: message.role.toUpperCase(), content: message.content })), ...newMessages],
              ),
            },
            include: { messages: { orderBy: { createdAt: "asc" } } },
          });
          return { conversation: updated, remaining };
        });
        conversation = saved.conversation;
        remainingAfterResponse = saved.remaining;
      } catch (error) {
        if (result.quotaReservation) {
          await releaseNutritionAIReservation(result.quotaReservation, "PERSISTENCE_FAILED");
        }
        throw error;
      }
      await analytics(studentId, result.safetyCategory ? "safety_redirect" : "assistant_message_sent").catch((error) => {
        console.error("No se pudo registrar la analítica del asistente", { studentId, error });
      });
      const usage = await nutritionAIUsageStatus(studentId);
      return Response.json({
        conversation,
        usage: { ...usage, remaining: remainingAfterResponse ?? usage.remaining },
        source: result.source,
        fallbackNotice: result.source === "local_fallback"
          ? "No pudimos conectar con el asistente en este momento. Te mostramos una orientación general."
          : null,
      });
    }
    return Response.json({ error: "Acción no disponible." }, { status: 405 });
  } catch (error) {
    if (error instanceof Error && error.message === "DAILY_LIMIT") {
      return Response.json(
        { error: "Alcanzaste tus consultas de IA por hoy. Mañana vas a poder volver a conversar. Mientras tanto, podés seguir usando tus recetas, planes, listas y contenidos educativos." },
        { status: 429 },
      );
    }
    if (error instanceof Error && error.message === "DUPLICATE_REQUEST") {
      return Response.json({ error: "Este mensaje ya se está procesando." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "PROFILE_REQUIRED") {
      return Response.json(
        {
          error:
            "Antes de generar contenido, confirmá si tenés alergias, intolerancias o alimentos que debamos evitar.",
          href: "/portal/nutricion/preferencias",
        },
        { status: 409 },
      );
    }
    console.error("Error en Nutrición Inteligente", { feature, error });
    return Response.json({ error: "No pudimos completar la acción en este momento. Tus datos no se perdieron." }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  context: RouteContext<"/api/portal/nutrition/[feature]">,
) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const { feature } = await context.params;
  const auth = await authorize(feature);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  const studentId = auth.session.studentId;
  const input = parseJsonObject(await request.json().catch(() => null));

  if (feature === "profile" || feature === "consent") {
    const existing = await prisma.nutritionProfile.findUnique({ where: { studentId } });
    const personalizationEnabled =
      feature === "consent"
        ? input.personalizationEnabled === true
        : existing?.personalizationEnabled ?? false;
    const profile = await prisma.nutritionProfile.upsert({
      where: { studentId },
      create: {
        studentId,
        dietaryType: safeText(input.dietaryType, 50),
        allergies: stringList(input.allergies),
        intolerances: stringList(input.intolerances),
        restrictions: stringList(input.restrictions),
        preferredFoods: stringList(input.preferredFoods),
        dislikedFoods: stringList(input.dislikedFoods),
        budgetPreference: safeText(input.budgetPreference, 40),
        cookingTimeMinutes: input.cookingTimeMinutes === null ? null : safeInteger(input.cookingTimeMinutes, 5, 240, 30),
        cookingLevel: safeText(input.cookingLevel, 40),
        equipment: stringList(input.equipment),
        servings: safeInteger(input.servings, 1, 12, 1),
        usualMealTimes: jsonValue(parseJsonObject(input.usualMealTimes)),
        repetitionPreference: safeText(input.repetitionPreference, 40),
        varietyPreference: safeText(input.varietyPreference, 40),
        locale: "es-AR",
        personalizationEnabled,
        consentAt: personalizationEnabled ? new Date() : null,
        notificationPreferences: jsonValue(parseJsonObject(input.notificationPreferences)),
      },
      update:
        feature === "consent"
          ? {
              personalizationEnabled,
              consentAt: personalizationEnabled ? existing?.consentAt ?? new Date() : null,
            }
          : {
              dietaryType: safeText(input.dietaryType, 50),
              allergies: stringList(input.allergies),
              intolerances: stringList(input.intolerances),
              restrictions: stringList(input.restrictions),
              preferredFoods: stringList(input.preferredFoods),
              dislikedFoods: stringList(input.dislikedFoods),
              budgetPreference: safeText(input.budgetPreference, 40),
              cookingTimeMinutes: input.cookingTimeMinutes === null ? null : safeInteger(input.cookingTimeMinutes, 5, 240, 30),
              cookingLevel: safeText(input.cookingLevel, 40),
              equipment: stringList(input.equipment),
              servings: safeInteger(input.servings, 1, 12, 1),
              usualMealTimes: jsonValue(parseJsonObject(input.usualMealTimes)),
              repetitionPreference: safeText(input.repetitionPreference, 40),
              varietyPreference: safeText(input.varietyPreference, 40),
              notificationPreferences: jsonValue(parseJsonObject(input.notificationPreferences)),
            },
    });
    await analytics(studentId, "profile_completed");
    return Response.json({ profile: serializeNutritionProfile(profile), message: "Preferencias actualizadas." });
  }
  if (feature === "recipes") {
    const id = safeText(input.id, 100);
    const owned = await prisma.nutritionRecipe.findFirst({ where: { id, studentId } });
    if (!owned) return Response.json({ error: "La receta no existe." }, { status: 404 });
    const nextFavorite =
      typeof input.isFavorite === "boolean"
        ? input.isFavorite
        : owned.isFavorite;
    const recipe = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.nutritionRecipe.update({
        where: { id },
        data: {
          isFavorite: nextFavorite,
          rating: input.rating === null ? null : safeInteger(input.rating, 1, 5, owned.rating ?? 1),
          servings: input.servings === undefined ? owned.servings : safeInteger(input.servings, 1, 12, owned.servings),
        },
      });
      if (nextFavorite) {
        await transaction.nutritionFavorite.upsert({
          where: {
            studentId_contentType_contentId: {
              studentId,
              contentType: "recipe",
              contentId: id,
            },
          },
          create: {
            studentId,
            contentType: "recipe",
            contentId: id,
            label: owned.title,
          },
          update: { label: owned.title },
        });
      } else {
        await transaction.nutritionFavorite.deleteMany({
          where: { studentId, contentType: "recipe", contentId: id },
        });
      }
      return updated;
    });
    return Response.json({ recipe, message: "Receta actualizada." });
  }
  if (feature === "plans") {
    const id = safeText(input.id, 100);
    const owned = await prisma.nutritionMealPlan.findFirst({ where: { id, studentId } });
    if (!owned) return Response.json({ error: "El plan no existe." }, { status: 404 });
    const action = safeText(input.action, 30);
    if (action === "duplicate") {
      const duplicate = await prisma.nutritionMealPlan.create({
        data: {
          studentId,
          startDate: owned.startDate,
          endDate: owned.endDate,
          status: "DRAFT",
          configuration: jsonValue(owned.configuration),
          meals: jsonValue(owned.meals),
          contextSnapshot:
            owned.contextSnapshot === null
              ? undefined
              : jsonValue(owned.contextSnapshot),
          active: false,
        },
      });
      return Response.json({ plan: duplicate, message: "Plan duplicado." });
    }
    const meals = input.meals === undefined ? undefined : parsePlanMeals(input.meals);
    const plan = await prisma.nutritionMealPlan.update({
      where: { id },
      data: {
        ...(meals ? { meals: jsonValue(meals) } : {}),
        ...(action === "archive" ? { active: false, status: "ARCHIVED" } : {}),
      },
    });
    return Response.json({ plan, message: action === "archive" ? "Plan archivado." : "Plan actualizado." });
  }
  if (feature === "shopping") {
    const id = safeText(input.id, 100);
    const owned = await prisma.nutritionShoppingList.findFirst({ where: { id, studentId } });
    if (!owned) return Response.json({ error: "La lista no existe." }, { status: 404 });
    const items = input.items === undefined ? undefined : parseShoppingItems(input.items);
    const list = await prisma.nutritionShoppingList.update({
      where: { id },
      data: {
        ...(items ? { items: jsonValue(items) } : {}),
        ...(safeText(input.action, 30) === "archive" ? { status: "ARCHIVED" } : {}),
      },
    });
    await analytics(studentId, "shopping_item_checked", { listId: id });
    return Response.json({ list, message: "Lista actualizada." });
  }
  if (feature === "education") {
    const contentId = safeText(input.contentId, 100);
    if (!NUTRITION_EDUCATION.some((item) => item.id === contentId)) return Response.json({ error: "El contenido no existe." }, { status: 404 });
    const content = NUTRITION_EDUCATION.find((item) => item.id === contentId)!;
    const questionId = safeText(input.questionId, 100);
    const selectedAnswer = Number(input.selectedAnswer);
    const answer = questionId ? quizResult(contentId, questionId, selectedAnswer) : null;
    if (questionId && !answer) return Response.json({ error: "La respuesta del cuestionario no es válida." }, { status: 400 });
    const saved = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.nutritionEducationProgress.upsert({
        where: { studentId_contentId: { studentId, contentId } },
        create: {
          studentId,
          contentId,
          viewedAt: new Date(),
          completedAt: input.completed === true ? new Date() : null,
          favorite: input.favorite === true,
          lastSection: safeText(input.lastSection, 100),
        },
        update: {
          viewedAt: new Date(),
          ...(typeof input.completed === "boolean" ? { completedAt: input.completed ? new Date() : null } : {}),
          ...(typeof input.favorite === "boolean" ? { favorite: input.favorite } : {}),
          ...(typeof input.lastSection === "string" ? { lastSection: safeText(input.lastSection, 100) } : {}),
        },
      });
      const attempt = answer ? await transaction.nutritionEducationQuizAttempt.create({
        data: { studentId, contentId, questionId, selectedAnswer, correct: answer.correct },
      }) : null;
      if (input.favorite === true) {
        await transaction.nutritionFavorite.upsert({
          where: {
            studentId_contentType_contentId: {
              studentId,
              contentType: "education",
              contentId,
            },
          },
          create: {
            studentId,
            contentType: "education",
            contentId,
            label: content.title,
          },
          update: { label: content.title },
        });
      } else if (input.favorite === false) {
        await transaction.nutritionFavorite.deleteMany({
          where: { studentId, contentType: "education", contentId },
        });
      }
      return { progress: updated, attempt };
    });
    await analytics(studentId, answer ? "education_quiz_answered" : input.completed === true ? "education_completed" : "education_opened", { contentId });
    return Response.json({ ...saved, quizResult: answer });
  }
  return Response.json({ error: "Acción no disponible." }, { status: 405 });
}

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/portal/nutrition/[feature]">,
) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const { feature } = await context.params;
  const auth = await authorize(feature);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  const studentId = auth.session.studentId;
  const search = new URL(request.url).searchParams;
  const id = search.get("id") ?? "";
  if (feature === "favorites") {
    await prisma.nutritionFavorite.deleteMany({ where: { id, studentId } });
    return Response.json({ message: "Favorito eliminado." });
  }
  if (feature === "recipes") {
    await prisma.nutritionRecipe.deleteMany({ where: { id, studentId } });
    return Response.json({ message: "Receta eliminada." });
  }
  if (feature === "assistant") {
    await prisma.nutritionConversation.deleteMany({ where: { id, studentId } });
    return Response.json({ message: "Conversación eliminada." });
  }
  if (feature === "history" && search.get("all") === "true") {
    await prisma.$transaction([
      prisma.nutritionFavorite.deleteMany({ where: { studentId } }),
      prisma.nutritionShoppingList.deleteMany({ where: { studentId } }),
      prisma.nutritionMealPlan.deleteMany({ where: { studentId } }),
      prisma.nutritionRecipe.deleteMany({ where: { studentId } }),
      prisma.nutritionConversation.deleteMany({ where: { studentId } }),
      prisma.nutritionPantrySession.deleteMany({ where: { studentId } }),
      prisma.nutritionAIInteraction.deleteMany({ where: { studentId } }),
      prisma.nutritionAnalyticsEvent.deleteMany({ where: { studentId } }),
    ]);
    return Response.json({ message: "Historial de Nutrición eliminado." });
  }
  if (feature === "history" && id) {
    const type = search.get("type");
    if (type === "recipe") {
      await prisma.nutritionRecipe.deleteMany({ where: { id, studentId } });
    } else if (type === "plan") {
      await prisma.nutritionMealPlan.deleteMany({ where: { id, studentId } });
    } else if (type === "shopping") {
      await prisma.nutritionShoppingList.deleteMany({ where: { id, studentId } });
    } else if (type === "conversation") {
      await prisma.nutritionConversation.deleteMany({ where: { id, studentId } });
    } else if (type === "recommendation") {
      await prisma.nutritionAIInteraction.deleteMany({ where: { id, studentId } });
    } else {
      return Response.json({ error: "El elemento de historial no es válido." }, { status: 400 });
    }
    return Response.json({ message: "Elemento eliminado del historial." });
  }
  if (feature === "consent") {
    await prisma.nutritionProfile.updateMany({
      where: { studentId },
      data: { personalizationEnabled: false, consentAt: null },
    });
    return Response.json({ message: "Personalización con IA desactivada." });
  }
  if (feature === "profile") {
    await prisma.nutritionProfile.deleteMany({ where: { studentId } });
    return Response.json({ message: "Preferencias alimentarias eliminadas." });
  }
  return Response.json({ error: "Acción no disponible." }, { status: 405 });
}
