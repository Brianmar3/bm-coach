import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { argentinaDateKey, dateKeyToDatabase } from "@/lib/payment-dates";
import {
  addDateKeyDays,
  nutritionSummary,
  serializeNutritionCheckin,
} from "@/lib/nutrition";
import type { Student } from "@/types/gestion";
import type {
  NutritionContextSnapshot,
  NutritionProfileData,
} from "@/types/nutrition-intelligence";
import { resolveNutritionActivities } from "@/lib/nutrition-activity";

function ageAtDate(birthDate: string, today: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const birthYear = Number(birthDate.slice(0, 4));
  const currentYear = Number(today.slice(0, 4));
  if (!Number.isInteger(birthYear) || birthYear > currentYear) return null;
  return currentYear - birthYear - (today.slice(5) >= birthDate.slice(5) ? 0 : 1);
}

function numberOrNull(value: unknown) {
  return value === null || value === undefined ? null : Number(value);
}

function objectOfBooleans(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) =>
      typeof item === "boolean" ? [[key, item]] : [],
    ),
  );
}

function objectOfStrings(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) =>
      typeof item === "string" ? [[key, item]] : [],
    ),
  );
}

export function serializeNutritionProfile(
  profile: {
    dietaryType: string;
    allergies: string[];
    intolerances: string[];
    restrictions: string[];
    preferredFoods: string[];
    dislikedFoods: string[];
    budgetPreference: string;
    cookingTimeMinutes: number | null;
    cookingLevel: string;
    equipment: string[];
    servings: number;
    usualMealTimes: Prisma.JsonValue | null;
    repetitionPreference: string;
    varietyPreference: string;
    locale: string;
    consentAt: Date | null;
    personalizationEnabled: boolean;
    notificationPreferences: Prisma.JsonValue | null;
    updatedAt: Date;
  } | null,
): NutritionProfileData {
  return {
    dietaryType: profile?.dietaryType ?? "",
    allergies: profile?.allergies ?? [],
    intolerances: profile?.intolerances ?? [],
    restrictions: profile?.restrictions ?? [],
    preferredFoods: profile?.preferredFoods ?? [],
    dislikedFoods: profile?.dislikedFoods ?? [],
    budgetPreference: profile?.budgetPreference ?? "",
    cookingTimeMinutes: profile?.cookingTimeMinutes ?? null,
    cookingLevel: profile?.cookingLevel ?? "",
    equipment: profile?.equipment ?? [],
    servings: profile?.servings ?? 1,
    usualMealTimes: objectOfStrings(profile?.usualMealTimes),
    repetitionPreference: profile?.repetitionPreference ?? "",
    varietyPreference: profile?.varietyPreference ?? "",
    locale: profile?.locale ?? "es-AR",
    consentAt: profile?.consentAt?.toISOString() ?? null,
    personalizationEnabled: profile?.personalizationEnabled ?? false,
    notificationPreferences: objectOfBooleans(profile?.notificationPreferences),
    updatedAt: profile?.updatedAt.toISOString() ?? null,
  };
}

export async function buildNutritionContext(
  studentId: string,
): Promise<NutritionContextSnapshot> {
  const today = argentinaDateKey();
  const recentStart = dateKeyToDatabase(addDateKeyDays(today, -29));
  const weekStart = addDateKeyDays(today, -6);
  const [
    studentRecord,
    evaluation,
    profile,
    routineAssignment,
    weeklyClasses,
    todayOccurrences,
    recentAttendances,
    checkins,
    activePlan,
  ] = await Promise.all([
    prisma.studentRecord.findUnique({
      where: { id: studentId },
      select: { data: true, serviceType: true },
    }),
    prisma.physicalEvaluation.findFirst({
      where: { studentId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        date: true,
        weight: true,
        height: true,
        bodyFatPercentage: true,
        muscleMass: true,
        visceralFat: true,
        waist: true,
        hip: true,
      },
    }),
    prisma.nutritionProfile.findUnique({ where: { studentId } }),
    prisma.trainingRoutineAssignment.findFirst({
      where: { studentId, active: true, routine: { status: "ACTIVA" } },
      orderBy: { assignedAt: "desc" },
      select: {
        routine: {
          select: {
            name: true,
            days: {
              where: { active: true },
              orderBy: { dayNumber: "asc" },
              select: { dayNumber: true, name: true },
            },
          },
        },
      },
    }),
    prisma.weeklyClassAssignment.findMany({
      where: { studentId, active: true, schedule: { active: true } },
      select: {
        schedule: {
          select: { dayOfWeek: true, startTime: true, endTime: true, classType: true },
        },
      },
      orderBy: { schedule: { startTime: "asc" } },
    }),
    prisma.classOccurrence.findMany({
      where: {
        date: dateKeyToDatabase(today),
        status: { not: "CANCELLED" },
        OR: [
          { schedule: { assignments: { some: { studentId, active: true } } } },
          { responses: { some: { studentId } } },
        ],
      },
      select: {
        startTime: true,
        endTime: true,
        status: true,
        classNameSnapshot: true,
        schedule: { select: { classType: true } },
      },
      orderBy: { startTime: "asc" },
    }),
    prisma.classOccurrenceAttendance.count({
      where: {
        studentId,
        actualAttendance: "PRESENT",
        occurrence: {
          date: { gte: recentStart },
          status: { not: "CANCELLED" },
        },
      },
    }),
    prisma.nutritionDailyCheckin.findMany({
      where: { studentId, dateKey: { gte: weekStart, lte: today } },
      orderBy: { dateKey: "desc" },
    }),
    prisma.nutritionMealPlan.findFirst({
      where: { studentId, active: true, status: "ACTIVE" },
      orderBy: { startDate: "desc" },
      select: { id: true, startDate: true, endDate: true },
    }),
  ]);
  if (!studentRecord) throw new Error("STUDENT_NOT_FOUND");
  const student = studentRecord.data as unknown as Student;
  const summary = nutritionSummary(checkins.map(serializeNutritionCheckin));
  const localClock = new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Argentina/Buenos_Aires",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date());
  const localHour = Number(localClock.slice(0, 2));
  const trainingActivity = resolveNutritionActivities({
    today,
    localTime: localClock,
    occurrences: todayOccurrences.map((occurrence) => ({
      name: occurrence.schedule?.classType.trim() || occurrence.classNameSnapshot.trim() || "Clase",
      startTime: occurrence.startTime,
      endTime: occurrence.endTime,
      status: occurrence.status,
    })),
    weeklySchedules: weeklyClasses.map(({ schedule }) => schedule),
    routineName: routineAssignment?.routine.name ?? null,
  });
  return {
    today,
    localHour: Number.isFinite(localHour) ? localHour : 12,
    student: {
      firstName: student.firstName ?? "",
      objective: student.goal ?? "",
      birthDate: student.birthDate ?? "",
      age: ageAtDate(student.birthDate ?? "", today),
      plan: student.plan ?? "",
      serviceType: studentRecord.serviceType,
      joinedAt: student.joinedAt ?? "",
    },
    evaluation: evaluation
      ? {
          id: evaluation.id,
          date: evaluation.date.toISOString().slice(0, 10),
          weight: numberOrNull(evaluation.weight),
          height: numberOrNull(evaluation.height),
          bodyFatPercentage: numberOrNull(evaluation.bodyFatPercentage),
          muscleMass: numberOrNull(evaluation.muscleMass),
          visceralFat: numberOrNull(evaluation.visceralFat),
          waist: numberOrNull(evaluation.waist),
          hip: numberOrNull(evaluation.hip),
        }
      : null,
    profile: serializeNutritionProfile(profile),
    training: {
      routineName: routineAssignment?.routine.name ?? null,
      routineDays:
        routineAssignment?.routine.days.map(
          (day) => `Día ${day.dayNumber}${day.name ? ` · ${day.name}` : ""}`,
        ) ?? [],
      scheduledClasses: weeklyClasses.map(({ schedule }) => ({
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        classType: schedule.classType,
      })),
      todayActivities: trainingActivity.activities,
      relevantActivity: trainingActivity.relevantActivity,
      recentAttendances,
    },
    habits: summary,
    activePlan: activePlan
      ? {
          id: activePlan.id,
          startDate: activePlan.startDate.toISOString().slice(0, 10),
          endDate: activePlan.endDate.toISOString().slice(0, 10),
        }
      : null,
  };
}

export function nutritionRecommendation(context: NutritionContextSnapshot) {
  if (!context.activePlan) {
    return {
      title: "Organizá tu próxima semana",
      message:
        "Todavía no tenés una planificación activa. Podés crear una guía semanal y mantenerla estable hasta que decidas cambiarla.",
      href: "/portal/nutricion/plan",
      action: "Planificar semana",
    };
  }
  if (
    context.habits.daysRegistered > 0 &&
    context.habits.habitToImprove === "Hidratación"
  ) {
    return {
      title: "Prioridad de hoy: hidratación",
      message:
        "Fue el hábito menos sostenido de los últimos siete días. Tener agua a mano puede ayudarte a sostenerlo.",
      href: "/portal/nutricion#habitos",
      action: "Registrar hábitos",
    };
  }
  const activity = context.training.relevantActivity;
  if (activity?.status === "UPCOMING" || activity?.status === "IN_PROGRESS") {
    return {
      title: `Organizate para ${activity.name}`,
      message: `${activity.startTime ? `Tu actividad relevante de hoy es a las ${activity.startTime}. ` : ""}Elegí una comida simple que puedas ubicar antes o después sin pasar demasiadas horas sin comer.`,
      href: "/portal/nutricion/ideas?tipo=preentrenamiento",
      action: "Ver opciones",
    };
  }
  if (
    context.training.todayActivities.length > 0 &&
    context.training.todayActivities.every((item) => item.status === "COMPLETED")
  ) {
    return {
      title: "Hoy ya completaste tus actividades programadas",
      message: "Priorizá una comida completa, hidratación y una organización simple para favorecer la recuperación.",
      href: "/portal/nutricion/ideas?tipo=postentrenamiento",
      action: "Ver opciones",
    };
  }
  return {
    title: "Una decisión simple para hoy",
    message:
      context.localHour < 15
        ? "Pensá con anticipación tu próxima comida e incluí una fuente de proteína, vegetales y una opción de energía."
        : "Dejá resuelta una opción sencilla para cerrar el día y facilitar la organización de mañana.",
    href: "/portal/nutricion/ideas",
    action: "Organizar comida",
  };
}
