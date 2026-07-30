import { prisma } from "@/lib/prisma";
import { getPortalSession, validRequestOrigin } from "@/lib/portal-auth";
import { argentinaDateKey } from "@/lib/payment-dates";
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
  const [evaluation, checkins, trainerNote] = await Promise.all([
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
  ]);
  const serializedCheckins = checkins.map(serializeNutritionCheckin);
  const student = session.credential.student.data as unknown as Student;
  return Response.json({
    today,
    objective: student.goal ?? "",
    age: ageAtDate(student.birthDate ?? "", today),
    serviceType: session.credential.student.serviceType,
    evaluation: serializeNutritionEvaluation(evaluation),
    todayCheckin:
      serializedCheckins.find((checkin) => checkin.dateKey === today) ?? null,
    weekCheckins: serializedCheckins,
    summary: nutritionSummary(serializedCheckins),
    trainerNote: serializeNutritionNote(trainerNote),
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
