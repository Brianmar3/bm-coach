import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, adminSessionCookieOptions, createAdminSessionValue, verifyAdminCredential } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { consumePasswordVerificationTime, normalizeUsername, validRequestOrigin, verifyPassword } from "@/lib/portal-auth";
import { LAST_PORTAL_COOKIE, portalExperienceCookieOptions } from "@/lib/portal-experience";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen de solicitud inválido." }, { status: 403 });
  const body = await request.json().catch(() => null) as { token?: string; email?: string; password?: string } | null;
  let userId: string | null = null;
  let onboardingCompleted = true;
  if (body?.email || body?.password) {
    const email = normalizeUsername(body.email ?? "");
    const password = body.password ?? "";
    if (!email || !password || password.length > 128) return Response.json({ error: "Ingresá email y contraseña." }, { status: 400 });
    const user = await prisma.user.findUnique({ where: { email } });
    const validPassword = user?.passwordHash ? await verifyPassword(password, user.passwordHash) : (await consumePasswordVerificationTime(password), false);
    if (!user || user.status !== "ACTIVE" || !validPassword) {
      return Response.json({ error: "Email o contraseña incorrectos." }, { status: 401 });
    }
    userId = user.id;
    onboardingCompleted = user.onboardingCompleted;
  } else {
    const verification = verifyAdminCredential(body?.token?.trim() ?? "");
    if (!verification.ok) return Response.json({ error: verification.reason === "misconfigured" ? "La autenticación administrativa no está configurada." : "Credencial administrativa incorrecta." }, { status: verification.reason === "misconfigured" ? 503 : 401 });
    const owners = await prisma.workspaceMembership.findMany({ where: { role: "OWNER", status: "ACTIVE", user: { status: "ACTIVE" }, workspace: { slug: "bm-fuerza-funcional", status: "ACTIVE" } }, select: { userId: true } });
    if (owners.length !== 1) return Response.json({ error: "La cuenta administrativa inicial no está configurada correctamente." }, { status: 503 });
    userId = owners[0].userId;
  }
  const session = createAdminSessionValue(userId);
  if (!session) return Response.json({ error: "La autenticación administrativa no está configurada." }, { status: 503 });
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, session.value, adminSessionCookieOptions(session.expiresAt));
  cookieStore.set(LAST_PORTAL_COOKIE, "admin", portalExperienceCookieOptions());
  return Response.json({ authenticated: true, role: "coach", next: onboardingCompleted ? "/dashboard" : "/trainer/onboarding", expiresAt: session.expiresAt.toISOString() });
}
