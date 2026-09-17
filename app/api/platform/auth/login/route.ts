import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, adminSessionCookieOptions, createAdminSessionValue } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { consumePasswordVerificationTime, normalizeUsername, validRequestOrigin, verifyPassword } from "@/lib/portal-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen de solicitud inválido." }, { status: 403 });
  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  const email = normalizeUsername(body?.email ?? "");
  const password = body?.password ?? "";
  if (!email || !password || password.length > 128) return Response.json({ error: "Ingresá email y contraseña." }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, passwordHash: true, platformRole: true, status: true } });
  const validPassword = user?.passwordHash ? await verifyPassword(password, user.passwordHash) : (await consumePasswordVerificationTime(password), false);
  if (!user || user.status !== "ACTIVE" || user.platformRole !== "PLATFORM_OWNER" || !validPassword) return Response.json({ error: "Email o contraseña incorrectos." }, { status: 401 });
  const session = createAdminSessionValue(user.id);
  if (!session) return Response.json({ error: "La autenticación no está configurada." }, { status: 503 });
  (await cookies()).set(ADMIN_SESSION_COOKIE, session.value, adminSessionCookieOptions(session.expiresAt));
  return Response.json({ authenticated: true, next: "/platform/trainers", expiresAt: session.expiresAt.toISOString() });
}
