import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  adminAuthError,
  verifyAdminSessionValue,
} from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { validRequestOrigin } from "@/lib/portal-auth";
import { argentinaDateKey } from "@/lib/payment-dates";
import {
  addDateKeyDays,
  nutritionSummary,
  serializeNutritionCheckin,
  serializeNutritionEvaluation,
  serializeNutritionNote,
} from "@/lib/nutrition";
import type { Student } from "@/types/gestion";

async function authorize() {
  const auth = verifyAdminSessionValue(
    (await cookies()).get(ADMIN_SESSION_COOKIE)?.value,
  );
  return auth.ok ? null : adminAuthError(auth);
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/admin/alumnos/[id]/nutrition">,
) {
  const failure = await authorize();
  if (failure) {
    return Response.json({ error: failure.error }, { status: failure.status });
  }
  const { id: studentId } = await context.params;
  const today = argentinaDateKey();
  const weekStart = addDateKeyDays(today, -6);
  const [studentRecord, evaluation, checkins, trainerNote] = await Promise.all([
    prisma.studentRecord.findUnique({
      where: { id: studentId },
      select: { id: true, data: true },
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
      },
    }),
    prisma.nutritionDailyCheckin.findMany({
      where: { studentId, dateKey: { gte: weekStart, lte: today } },
      orderBy: { dateKey: "desc" },
    }),
    prisma.trainerNutritionNote.findFirst({
      where: { studentId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }),
  ]);
  if (!studentRecord) {
    return Response.json({ error: "El alumno no existe." }, { status: 404 });
  }
  const student = studentRecord.data as unknown as Student;
  const serializedCheckins = checkins.map(serializeNutritionCheckin);
  return Response.json({
    objective: student.goal ?? "",
    evaluation: serializeNutritionEvaluation(evaluation),
    weekCheckins: serializedCheckins,
    summary: nutritionSummary(serializedCheckins),
    trainerNote: serializeNutritionNote(trainerNote),
  });
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/admin/alumnos/[id]/nutrition">,
) {
  if (!validRequestOrigin(request)) {
    return Response.json({ error: "Origen no permitido." }, { status: 403 });
  }
  const failure = await authorize();
  if (failure) {
    return Response.json({ error: failure.error }, { status: failure.status });
  }
  const { id: studentId } = await context.params;
  const input = (await request.json().catch(() => null)) as
    | { text?: unknown }
    | null;
  const text = typeof input?.text === "string" ? input.text.trim() : "";
  if (!text || text.length > 600) {
    return Response.json(
      { error: "Escribí una recomendación de hasta 600 caracteres." },
      { status: 400 },
    );
  }
  const student = await prisma.studentRecord.findUnique({
    where: { id: studentId },
    select: { id: true },
  });
  if (!student) {
    return Response.json({ error: "El alumno no existe." }, { status: 404 });
  }
  const note = await prisma.$transaction(async (transaction) => {
    const saved = await transaction.trainerNutritionNote.create({
      data: { studentId, trainerId: "coach", text },
    });
    await transaction.studentNotification.create({
      data: {
        studentId,
        type: "MESSAGE",
        title: "Nueva recomendación",
        message: "Tu entrenador dejó una recomendación sobre nutrición y hábitos.",
        url: "/portal/nutricion",
      },
    });
    return saved;
  });
  return Response.json({
    trainerNote: serializeNutritionNote(note),
    message: "Recomendación enviada correctamente.",
  });
}
