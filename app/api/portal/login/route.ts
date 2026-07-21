import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { consumePasswordVerificationTime, createPortalSession, normalizeUsername, portalCookieOptions, PORTAL_COOKIE, validRequestOrigin, verifyPassword } from "@/lib/portal-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen de solicitud inválido." }, { status: 403 });
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    const username = normalizeUsername(body.username ?? "");
    const password = body.password ?? "";
    if (!username || !password || password.length > 128) return Response.json({ error: "Ingresá usuario y contraseña." }, { status: 400 });
    const credential = await prisma.studentPortalCredential.findUnique({ where: { username } });
    if (!credential) { await consumePasswordVerificationTime(password); return Response.json({ error: "Usuario o contraseña incorrectos." }, { status: 401 }); }
    if (!credential.active) { await consumePasswordVerificationTime(password); return Response.json({ error: "El acceso está desactivado. Contactá a tu entrenador." }, { status: 403 }); }
    if (credential.lockedUntil && credential.lockedUntil > new Date()) return Response.json({ error: "Demasiados intentos. Probá nuevamente en 15 minutos." }, { status: 429 });

    const valid = await verifyPassword(password, credential.passwordHash);
    if (!valid) {
      const previousAttempts = credential.lockedUntil && credential.lockedUntil <= new Date() ? 0 : credential.failedLoginAttempts;
      const attempts = previousAttempts + 1;
      await prisma.studentPortalCredential.update({ where: { studentId: credential.studentId }, data: { failedLoginAttempts: attempts, lockedUntil: attempts >= 5 ? new Date(Date.now() + 15 * 60000) : null } });
      return Response.json({ error: attempts >= 5 ? "Demasiados intentos. Probá nuevamente en 15 minutos." : "Usuario o contraseña incorrectos." }, { status: attempts >= 5 ? 429 : 401 });
    }

    await prisma.studentPortalCredential.update({ where: { studentId: credential.studentId }, data: { failedLoginAttempts: 0, lockedUntil: null } });
    await prisma.studentPortalSession.deleteMany({ where: { expiresAt: { lte: new Date() } } });
    const session = await createPortalSession(credential.studentId);
    (await cookies()).set(PORTAL_COOKIE, session.token, portalCookieOptions(session.expiresAt));
    return Response.json({ ok: true, mustChangePassword: credential.mustChangePassword });
  } catch (error) {
    console.error("Error al iniciar sesión en el portal", error);
    return Response.json({ error: "No se pudo iniciar sesión." }, { status: 500 });
  }
}
