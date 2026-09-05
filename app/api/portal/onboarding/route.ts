import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPortalSession, validRequestOrigin } from "@/lib/portal-auth";
import { isDateKey } from "@/lib/payment-dates";

const goals = new Set(["Bajar grasa", "Ganar masa muscular", "Mejorar mi salud", "Ganar fuerza", "Mejorar resistencia", "Mantenerme activo/a"]);
const experiences = new Set(["Principiante", "Intermedio", "Avanzado"]);

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const session = await getPortalSession();
  if (!session) return Response.json({ error: "Sesión vencida." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Los datos no son válidos." }, { status: 400 });

  const goal = typeof body.goal === "string" ? body.goal : "";
  const weight = Number(body.weight);
  const heightCm = Number(body.heightCm);
  const birthDate = typeof body.birthDate === "string" ? body.birthDate : "";
  const trainingExperience = typeof body.trainingExperience === "string" ? body.trainingExperience : "";
  const hasLimitations = body.hasLimitations;
  const limitations = typeof body.limitations === "string" ? body.limitations.trim().slice(0, 800) : "";
  const onboardingObservations = typeof body.observations === "string" ? body.observations.trim().slice(0, 1200) : "";

  if (!goals.has(goal)) return Response.json({ error: "Seleccioná un objetivo principal." }, { status: 400 });
  if (!Number.isFinite(weight) || weight < 25 || weight > 350) return Response.json({ error: "Ingresá un peso válido entre 25 y 350 kg." }, { status: 400 });
  if (!Number.isFinite(heightCm) || heightCm < 100 || heightCm > 250) return Response.json({ error: "Ingresá una altura válida entre 100 y 250 cm." }, { status: 400 });
  if (!isDateKey(birthDate) || birthDate >= new Date().toISOString().slice(0, 10)) return Response.json({ error: "Ingresá una fecha de nacimiento válida." }, { status: 400 });
  if (!experiences.has(trainingExperience)) return Response.json({ error: "Seleccioná tu nivel de experiencia." }, { status: 400 });
  if (typeof hasLimitations !== "boolean") return Response.json({ error: "Indicá si tenés molestias o limitaciones." }, { status: 400 });
  if (hasLimitations && limitations.length < 3) return Response.json({ error: "Contanos brevemente qué molestia o limitación tenés." }, { status: 400 });

  const record = await prisma.studentRecord.findUnique({ where: { id: session.studentId }, select: { data: true } });
  if (!record) return Response.json({ error: "Alumno no encontrado." }, { status: 404 });
  const completedAt = new Date().toISOString();
  await prisma.studentRecord.update({
    where: { id: session.studentId },
    data: { data: { ...(record.data as Prisma.JsonObject), goal, weight, height: heightCm / 100, birthDate, trainingExperience, hasLimitations, limitations: hasLimitations ? limitations : "", onboardingObservations, onboardingCompleted: true, onboardingCompletedAt: completedAt } },
  });
  return Response.json({ ok: true, onboardingCompleted: true, onboardingCompletedAt: completedAt });
}
