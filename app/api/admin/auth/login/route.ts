import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, adminSessionCookieOptions, createAdminSessionValue } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { consumePasswordVerificationTime, normalizeUsername, validRequestOrigin, verifyPassword } from "@/lib/portal-auth";
import { LAST_PORTAL_COOKIE, portalExperienceCookieOptions } from "@/lib/portal-experience";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen de solicitud inválido." }, { status: 403 });
  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  const email = normalizeUsername(body?.email ?? "");
  const password = body?.password ?? "";
  if (!email || !password || password.length > 128) return Response.json({ error: "Ingresá email y contraseña." }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { email } });
  const validPassword = user?.passwordHash ? await verifyPassword(password, user.passwordHash) : (await consumePasswordVerificationTime(password), false);
  if (!user || user.status !== "ACTIVE" || user.platformRole !== "TRAINER" || !validPassword) return Response.json({ error: "Email o contraseña incorrectos." }, { status: 401 });
  const userId = user.id;
  const onboardingCompleted = user.onboardingCompleted;
  const session = createAdminSessionValue(userId);
  if (!session) return Response.json({ error: "La autenticación administrativa no está configurada." }, { status: 503 });
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, session.value, adminSessionCookieOptions(session.expiresAt));
  cookieStore.set(LAST_PORTAL_COOKIE, "admin", portalExperienceCookieOptions());
  return Response.json({ authenticated: true, role: "coach", next: onboardingCompleted ? "/dashboard" : "/trainer/onboarding", expiresAt: session.expiresAt.toISOString() });
}
