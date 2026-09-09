import { randomUUID, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword, passwordValidationError, portalCookieOptions, PORTAL_COOKIE, sessionTokenHash, validRequestOrigin } from "@/lib/portal-auth";
import { LAST_PORTAL_COOKIE, portalExperienceCookieOptions } from "@/lib/portal-experience";
import { parseRegistration } from "@/lib/self-service";
import { SELF_SERVICE_SIGNUP_ENABLED } from "@/lib/self-service-signup";

export const runtime = "nodejs";
class AccountConflict extends Error {}

export async function POST(request: Request) {
  if (!SELF_SERVICE_SIGNUP_ENABLED) return Response.json({ error: "Registro temporalmente no disponible." }, { status: 503 });
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const raw = await request.text();
  if (raw.length > 4096) return Response.json({ error: "Solicitud demasiado grande." }, { status: 413 });
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return Response.json({ error: "Datos inválidos." }, { status: 400 }); }
  const input = parseRegistration(value);
  if (!input) return Response.json({ error: "Revisá nombre, apellido, correo, teléfono y confirmación de contraseña." }, { status: 400 });
  const invalidPassword = passwordValidationError(input.password);
  if (invalidPassword) return Response.json({ error: invalidPassword }, { status: 400 });
  try {
    const passwordHash = await hashPassword(input.password);
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 14 * 86400000);
    await prisma.$transaction(async (tx) => {
      // Serialize registrations across instances; username uniquely reserves the normalized email.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(78341209)`;
      const recent = await tx.studentRecord.count({ where: { createdAt: { gte: new Date(Date.now() - 60000) }, data: { path: ["accountType"], equals: "SELF_SERVICE" } } });
      if (recent >= 10) throw new Error("REGISTRATION_LIMIT");
      const [credential, records] = await Promise.all([
        tx.studentPortalCredential.findUnique({ where: { username: input.email }, select: { studentId: true } }),
        tx.studentRecord.findMany({ select: { data: true, phoneNormalized: true } }),
      ]);
      const phoneNormalized = input.phone.replace(/\D/g, "");
      if (credential || records.some((record) => {
        const data = record.data as Prisma.JsonObject;
        return (typeof data.email === "string" && data.email.trim().toLowerCase() === input.email) || record.phoneNormalized === phoneNormalized || (typeof data.phone === "string" && data.phone.replace(/\D/g, "") === phoneNormalized);
      })) throw new AccountConflict();
      const id = randomUUID();
      await tx.studentRecord.create({ data: {
        id, phoneNormalized,
        // Legacy compatibility only: this does not grant a paid service or an assignment.
        serviceType: "PERSONALIZED",
        data: { id, firstName: input.firstName, lastName: input.lastName, email: input.email, phone: input.phone, accountType: "SELF_SERVICE", trainerId: null, serviceType: "PERSONALIZED", status: "activo", studentType: "Adulto", birthDate: "", height: 0, weight: 0, goal: "", plan: "", monthlyFee: 0, dueDate: "", joinedAt: new Date().toISOString().slice(0, 10), notes: "", onboardingCompleted: false },
        portalCredential: { create: { username: input.email, passwordHash, active: true, mustChangePassword: false, sessions: { create: { tokenHash: sessionTokenHash(token), expiresAt } } } },
      } });
    }, { timeout: 15000 });
    const store = await cookies();
    store.set(PORTAL_COOKIE, token, portalCookieOptions(expiresAt));
    store.set(LAST_PORTAL_COOKIE, "student", portalExperienceCookieOptions());
    return Response.json({ next: "/portal/onboarding" }, { status: 201 });
  } catch (error) {
    if (error instanceof AccountConflict || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) return Response.json({ error: "No se puede crear una cuenta con esos datos. Si ya tenés acceso, iniciá sesión." }, { status: 409 });
    if (error instanceof Error && error.message === "REGISTRATION_LIMIT") return Response.json({ error: "Hay muchos registros en este momento. Intentá nuevamente en un minuto." }, { status: 429 });
    console.error("No se pudo crear la cuenta autogestionada", error instanceof Error ? error.name : "Error");
    return Response.json({ error: "No pudimos crear tu cuenta. Intentá nuevamente." }, { status: 503 });
  }
}
