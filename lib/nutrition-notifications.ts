import "server-only";

import { prisma } from "@/lib/prisma";
import { sendStudentPush } from "@/lib/push-notifications";

function notificationPreference(value: unknown, key: string) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (value as Record<string, unknown>)[key] === true,
  );
}

export async function notifyNutritionEvaluationUpdate(
  studentId: string,
  evaluationId: string,
) {
  try {
    const profile = await prisma.nutritionProfile.findUnique({
      where: { studentId },
      select: { notificationPreferences: true },
    });
    if (
      !profile ||
      !notificationPreference(
        profile.notificationPreferences,
        "newEvaluation",
      )
    ) {
      return;
    }

    const url = `/portal/nutricion?evaluation=${encodeURIComponent(evaluationId)}`;
    const existing = await prisma.studentNotification.findFirst({
      where: {
        studentId,
        type: "REMINDER",
        url,
      },
      select: { id: true },
    });
    if (existing) return;

    await prisma.studentNotification.create({
      data: {
        studentId,
        type: "REMINDER",
        title: "Nueva actualización",
        message:
          "Ya podés revisar la guía y regenerar tus recomendaciones de Nutrición.",
        url,
      },
    });
    await sendStudentPush(studentId, {
      title: "Evaluación de nutrición actualizada",
      body: "Tu evaluación fue actualizada. Ya podés revisar tu guía de Nutrición.",
      url,
      tag: `nutrition-evaluation-${evaluationId}`,
    });
  } catch (error) {
    console.error(
      "No se pudo crear la notificación nutricional de evaluación",
      error,
    );
  }
}
