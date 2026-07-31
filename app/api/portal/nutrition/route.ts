import { prisma } from "@/lib/prisma";
import { getPortalSession, validRequestOrigin } from "@/lib/portal-auth";
import {
  argentinaDateKey,
  argentinaDateTimeBoundary,
} from "@/lib/payment-dates";
import { buildNutritionContext, nutritionRecommendation } from "@/lib/nutrition-context";
import { nutritionAIStatus } from "@/lib/nutrition-ai";
import {
  addDateKeyDays,
  nutritionSummary,
  serializeNutritionCheckin,
  serializeNutritionEvaluation,
  serializeNutritionNote,
} from "@/lib/nutrition";
import type { Student } from "@/types/gestion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ageAtDate(birthDate: string, today: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const birthYear = Number(birthDate.slice(0, 4));
  const currentYear = Number(today.slice(0, 4));
  if (!Number.isInteger(birthYear) || birthYear > currentYear) return null;
  const hadBirthday = today.slice(5) >= birthDate.slice(5);
  return currentYear - birthYear - (hadBirthday ? 0 : 1);
}

export async function GET() {
  const session = await getPortalSession();
  if (!session) {
    return Response.json({ error: "Sesión vencida." }, { status: 401 });
  }
  const today = argentinaDateKey();
  const weekStart = addDateKeyDays(today, -6);
  const [
    evaluation,
    checkins,
    trainerNote,
    context,
    activePlan,
    activeShoppingList,
    recentRecipes,
  ] = await Promise.all([
    prisma.physicalEvaluation.findFirst({
      where: { studentId: session.studentId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        date: true,
        weight: true,
        height: true,
        bodyFatPercentage: true,
        muscleMass: true,
      },
    }),
    prisma.nutritionDailyCheckin.findMany({
      where: {
        studentId: session.studentId,
        dateKey: { gte: weekStart, lte: today },
      },
      orderBy: { dateKey: "desc" },
    }),
    prisma.trainerNutritionNote.findFirst({
      where: { studentId: session.studentId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }),
    buildNutritionContext(session.studentId),
    prisma.nutritionMealPlan.findFirst({
      where: { studentId: session.studentId, active: true, status: "ACTIVE" },
      orderBy: { startDate: "desc" },
    }),
    prisma.nutritionShoppingList.findFirst({
      where: { studentId: session.studentId, status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.nutritionRecipe.findMany({
      where: { studentId: session.studentId },
      orderBy: { updatedAt: "desc" },
      take: 4,
      select: {
        id: true,
        title: true,
        preparationMinutes: true,
        isFavorite: true,
      },
    }),
  ]);
  const serializedCheckins = checkins.map(serializeNutritionCheckin);
  const student = session.credential.student.data as unknown as Student;
  const aiStatus = nutritionAIStatus();
  const savedContext =
    activePlan?.contextSnapshot &&
    typeof activePlan.contextSnapshot === "object" &&
    !Array.isArray(activePlan.contextSnapshot)
      ? activePlan.contextSnapshot
      : null;
  const savedEvaluation =
    savedContext?.evaluation &&
    typeof savedContext.evaluation === "object" &&
    !Array.isArray(savedContext.evaluation)
      ? savedContext.evaluation
      : null;
  const interactionsToday = await prisma.nutritionAIInteraction.count({
    where: {
      studentId: session.studentId,
      provider: "configured",
      createdAt: {
        gte: argentinaDateTimeBoundary(today),
      },
    },
  });
  return Response.json({
    today,
    studentName: student.firstName ?? "",
    objective: student.goal ?? "",
    age: ageAtDate(student.birthDate ?? "", today),
    serviceType: session.credential.student.serviceType,
    evaluation: serializeNutritionEvaluation(evaluation),
    todayCheckin:
      serializedCheckins.find((checkin) => checkin.dateKey === today) ?? null,
    weekCheckins: serializedCheckins,
    summary: nutritionSummary(serializedCheckins),
    trainerNote: serializeNutritionNote(trainerNote),
    contextStatus: context.evaluation
      ? context.profile.personalizationEnabled
        ? "FULL"
        : "LIMITED"
      : "BASE",
    profile: context.profile,
    recommendation: nutritionRecommendation(context),
    activePlan: activePlan
      ? {
          id: activePlan.id,
          startDate: activePlan.startDate.toISOString().slice(0, 10),
          endDate: activePlan.endDate.toISOString().slice(0, 10),
          meals: activePlan.meals,
        }
      : null,
    activeShoppingList: activeShoppingList
      ? {
          id: activeShoppingList.id,
          title: activeShoppingList.title,
          items: activeShoppingList.items,
        }
      : null,
    recentRecipes,
    ai: {
      configured: aiStatus.configured,
      enabled:
        context.profile.personalizationEnabled &&
        Boolean(context.profile.consentAt),
      remainingToday: Math.max(0, aiStatus.dailyLimit - interactionsToday),
    },
    evaluationUpdated: Boolean(
      evaluation &&
        activePlan &&
        savedEvaluation?.id !== evaluation.id,
    ),
  });
}

export async function PUT(request: Request) {
  if (!validRequestOrigin(request)) {
    return Response.json({ error: "Origen no permitido." }, { status: 403 });
  }
  const session = await getPortalSession();
  if (!session) {
    return Response.json({ error: "Sesión vencida." }, { status: 401 });
  }
  const input = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  if (!input) {
    return Response.json({ error: "Los datos no son válidos." }, { status: 400 });
  }
  const comment =
    typeof input.comment === "string" ? input.comment.trim().slice(0, 500) : "";
  const values = {
    hydration: input.hydration === true,
    protein: input.protein === true,
    fruitsVegetables: input.fruitsVegetables === true,
    mealOrganization: input.mealOrganization === true,
    energy: input.energy === true,
    comment,
  };
  const today = argentinaDateKey();
  const saved = await prisma.nutritionDailyCheckin.upsert({
    where: {
      studentId_dateKey: { studentId: session.studentId, dateKey: today },
    },
    create: { studentId: session.studentId, dateKey: today, ...values },
    update: values,
  });
  return Response.json({
    checkin: serializeNutritionCheckin(saved),
    message: "Hábitos de hoy guardados correctamente.",
  });
}
