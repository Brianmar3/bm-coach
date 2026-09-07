import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPortalSession, validRequestOrigin } from "@/lib/portal-auth";
import { onboardingData, onboardingValidation, type StudentOnboardingData } from "@/lib/student-onboarding";
import type { Student } from "@/types/gestion";

export async function PATCH(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const session = await getPortalSession();
  if (!session) return Response.json({ error: "Sesión vencida." }, { status: 401 });
  if (session.credential.mustChangePassword) return Response.json({ error: "Primero cambiá tu contraseña temporal." }, { status: 403 });
  const body = await request.json().catch(() => null) as { step?: number; complete?: boolean; data?: Partial<StudentOnboardingData> } | null;
  if (!body?.data || ![1, 2, 3, 4].includes(body.step ?? 0)) return Response.json({ error: "Datos de onboarding inválidos." }, { status: 400 });
  const record = await prisma.studentRecord.findUnique({ where: { id: session.studentId }, select: { data: true } });
  if (!record) return Response.json({ error: "Alumno no encontrado." }, { status: 404 });
  const stored = record.data as Prisma.JsonObject;
  const current = onboardingData(stored as unknown as Student);
  const merged: StudentOnboardingData = {
    ...current,
    birthDate: typeof body.data.birthDate === "string" ? body.data.birthDate : current.birthDate,
    height: typeof body.data.height === "number" ? body.data.height : current.height,
    weight: typeof body.data.weight === "number" ? body.data.weight : current.weight,
    goal: typeof body.data.goal === "string" ? body.data.goal.trim().slice(0, 80) : current.goal,
    experienceLevel: typeof body.data.experienceLevel === "string" ? body.data.experienceLevel : current.experienceLevel,
    trainingExperience: typeof body.data.trainingExperience === "string" ? body.data.trainingExperience : current.trainingExperience,
    hasLimitations: typeof body.data.hasLimitations === "boolean" ? body.data.hasLimitations : current.hasLimitations,
    limitations: typeof body.data.limitations === "string" ? body.data.limitations.trim().slice(0, 500) : current.limitations,
    onboardingCompleted: body.complete === true,
    onboardingUpdatedAt: new Date().toISOString(),
  };
  if (!merged.hasLimitations) merged.limitations = "";
  const step = body.step as 1 | 2 | 3 | 4;
  const error = onboardingValidation(merged, body.complete ? 4 : step);
  if (error) return Response.json({ error }, { status: 400 });
  await prisma.studentRecord.update({ where: { id: session.studentId }, data: { data: { ...stored, ...merged } } });
  return Response.json({ data: merged });
}
