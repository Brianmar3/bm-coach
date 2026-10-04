import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPortalSession, validRequestOrigin } from "@/lib/portal-auth";
import { onboardingData, onboardingMeasurementValidation, onboardingValidation, type StudentOnboardingData } from "@/lib/student-onboarding";
import type { Student } from "@/types/gestion";
import { isSelfService, SELF_SERVICE_GOALS, selfServicePreferences, selfServicePreferencesError } from "@/lib/self-service";

export async function PATCH(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const session = await getPortalSession({ allowSelfService: true });
  if (!session) return Response.json({ error: "Sesión vencida." }, { status: 401 });
  if (session.credential.mustChangePassword) return Response.json({ error: "Primero cambiá tu contraseña temporal." }, { status: 403 });
  const body = await request.json().catch(() => null) as { step?: number; complete?: boolean; data?: Partial<StudentOnboardingData> } | null;
  if (!body?.data || ![1, 2, 3, 4].includes(body.step ?? 0)) return Response.json({ error: "Datos de onboarding inválidos." }, { status: 400 });
  const record = await prisma.studentRecord.findUnique({ where: { id: session.studentId }, select: { data: true } });
  if (!record) return Response.json({ error: "Alumno no encontrado." }, { status: 404 });
  const stored = record.data as Prisma.JsonObject;
  const selfService = isSelfService(stored);
  const current = onboardingData(stored as unknown as Student);
  for (const field of ["height", "weight"] as const) {
    if (body.data[field] !== undefined && body.data[field] !== null && typeof body.data[field] !== "number") return Response.json({ error: "Revisá la altura y el peso ingresados." }, { status: 400 });
  }
  if (body.data.trainingCurrently !== undefined && body.data.trainingCurrently !== null && typeof body.data.trainingCurrently !== "boolean") return Response.json({ error: "Revisá si entrenás actualmente." }, { status: 400 });
  const merged: StudentOnboardingData = {
    ...current,
    birthDate: typeof body.data.birthDate === "string" ? body.data.birthDate : current.birthDate,
    height: body.data.height === null || typeof body.data.height === "number" ? body.data.height : current.height,
    weight: body.data.weight === null || typeof body.data.weight === "number" ? body.data.weight : current.weight,
    goal: typeof body.data.goal === "string" ? body.data.goal.trim().slice(0, 80) : current.goal,
    experienceLevel: typeof body.data.experienceLevel === "string" ? body.data.experienceLevel : current.experienceLevel,
    trainingExperience: typeof body.data.trainingExperience === "string" ? body.data.trainingExperience : current.trainingExperience,
    trainingCurrently: typeof body.data.trainingCurrently === "boolean" ? body.data.trainingCurrently : current.trainingCurrently,
    hasLimitations: typeof body.data.hasLimitations === "boolean" ? body.data.hasLimitations : current.hasLimitations,
    limitations: typeof body.data.limitations === "string" ? body.data.limitations.trim().slice(0, 500) : current.limitations,
    onboardingCompleted: body.complete === true,
    onboardingUpdatedAt: new Date().toISOString(),
  };
  if (!merged.hasLimitations) merged.limitations = "";
  const measurementsError = onboardingMeasurementValidation(merged);
  if (measurementsError) return Response.json({ error: measurementsError }, { status: 400 });
  if (selfService) Object.assign(merged, selfServicePreferences({ ...stored, ...body.data }));
  const step = body.step as 1 | 2 | 3 | 4;
  const validationData = selfService && merged.goal === "Mantenerme activo" ? { ...merged, goal: "Otro" } : merged;
  const error = onboardingValidation(validationData, body.complete ? 4 : step);
  if (error) return Response.json({ error }, { status: 400 });
  if (selfService && (step === 2 || body.complete) && !(SELF_SERVICE_GOALS as readonly string[]).includes(merged.goal)) return Response.json({ error: "Elegí tu objetivo principal." }, { status: 400 });
  if (selfService && (step >= 3 || body.complete)) {
    const preferencesError = selfServicePreferencesError(selfServicePreferences(merged));
    if (preferencesError) return Response.json({ error: preferencesError }, { status: 400 });
  }
  await prisma.studentRecord.update({ where: { id: session.studentId }, data: { data: { ...stored, ...merged } } });
  return Response.json({ data: merged });
}
