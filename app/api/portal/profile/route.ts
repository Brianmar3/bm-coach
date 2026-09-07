import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPortalSession, validRequestOrigin } from "@/lib/portal-auth";
import { duplicatePhone, normalizePhone } from "@/lib/student-enrollment";
import { isDateKey } from "@/lib/payment-dates";
import { EXPERIENCE_LEVELS, ONBOARDING_GOALS, TRAINING_EXPERIENCE } from "@/lib/student-onboarding";

const allowed = new Set(["phone", "email", "birthDate", "goal", "height", "weight", "experienceLevel", "trainingExperience", "hasLimitations", "limitations"]);

export async function PATCH(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const session = await getPortalSession();
  if (!session) return Response.json({ error: "Sesión vencida." }, { status: 401 });
  const value = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!value || typeof value !== "object" || Object.keys(value).some((key) => !allowed.has(key))) return Response.json({ error: "Sólo podés editar tus datos personales habilitados." }, { status: 400 });
  const phone = typeof value.phone === "string" ? value.phone.trim().slice(0, 40) : "";
  const email = typeof value.email === "string" ? value.email.trim().slice(0, 254) : "";
  const birthDate = typeof value.birthDate === "string" ? value.birthDate : "";
  const goal = typeof value.goal === "string" ? value.goal.trim().slice(0, 160) : "";
  const height = Number(value.height);
  const weight = Number(value.weight);
  const experienceLevel = typeof value.experienceLevel === "string" ? value.experienceLevel : "";
  const trainingExperience = typeof value.trainingExperience === "string" ? value.trainingExperience : "";
  const hasLimitations = value.hasLimitations === true;
  const limitations = hasLimitations && typeof value.limitations === "string" ? value.limitations.trim().slice(0, 500) : "";
  const normalizedPhone = normalizePhone(phone);
  if (normalizedPhone.length < 6) return Response.json({ error: "Ingresá un teléfono válido de al menos 6 dígitos." }, { status: 400 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Ingresá un correo válido." }, { status: 400 });
  if (birthDate && (!isDateKey(birthDate) || birthDate > new Date().toISOString().slice(0, 10))) return Response.json({ error: "La fecha de nacimiento no es válida." }, { status: 400 });
  if (!ONBOARDING_GOALS.includes(goal as (typeof ONBOARDING_GOALS)[number])) return Response.json({ error: "Elegí un objetivo válido." }, { status: 400 });
  if (!Number.isFinite(height) || height < 80 || height > 250 || !Number.isFinite(weight) || weight < 25 || weight > 350) return Response.json({ error: "Revisá la altura y el peso ingresados." }, { status: 400 });
  if (!EXPERIENCE_LEVELS.includes(experienceLevel as (typeof EXPERIENCE_LEVELS)[number]) || !TRAINING_EXPERIENCE.includes(trainingExperience as (typeof TRAINING_EXPERIENCE)[number])) return Response.json({ error: "Revisá tu experiencia de entrenamiento." }, { status: 400 });
  if (hasLimitations && limitations.length < 3) return Response.json({ error: "Describí brevemente la molestia o limitación." }, { status: 400 });
  const record = await prisma.studentRecord.findUnique({ where: { id: session.studentId }, select: { data: true } });
  if (!record) return Response.json({ error: "Alumno no encontrado." }, { status: 404 });
  const stored = record.data as Prisma.JsonObject;
  const duplicate = await prisma.$transaction(async (transaction) => {
    const found = await duplicatePhone(transaction, normalizedPhone, session.studentId);
    if (!found) await transaction.studentRecord.update({ where: { id: session.studentId }, data: { phoneNormalized: normalizedPhone, data: { ...stored, phone, email, birthDate, goal, height, weight, experienceLevel, trainingExperience, hasLimitations, limitations, onboardingUpdatedAt: new Date().toISOString() } } });
    return found;
  });
  if (duplicate) return Response.json({ error: "Ese teléfono ya pertenece a otro alumno." }, { status: 409 });
  return Response.json({ profile: { phone, email, birthDate, goal, height, weight, experienceLevel, trainingExperience, hasLimitations, limitations } });
}
