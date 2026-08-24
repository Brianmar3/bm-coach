import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, adminSessionCookieOptions, createAdminSessionValue, verifyAdminCredential } from "@/lib/admin-auth";
import { validRequestOrigin } from "@/lib/portal-auth";
import { LAST_PORTAL_COOKIE, portalExperienceCookieOptions } from "@/lib/portal-experience";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen de solicitud inválido." }, { status: 403 });
  const body = await request.json().catch(() => null) as { token?: string } | null;
  const verification = verifyAdminCredential(body?.token?.trim() ?? "");
  if (!verification.ok) {
    return Response.json(
      { error: verification.reason === "misconfigured" ? "La autenticación administrativa no está configurada." : "Credencial administrativa incorrecta." },
      { status: verification.reason === "misconfigured" ? 503 : 401 },
    );
  }
  const session = createAdminSessionValue();
  if (!session) return Response.json({ error: "La autenticación administrativa no está configurada." }, { status: 503 });
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, session.value, adminSessionCookieOptions(session.expiresAt));
  cookieStore.set(LAST_PORTAL_COOKIE, "admin", portalExperienceCookieOptions());
  return Response.json({ authenticated: true, role: "coach", expiresAt: session.expiresAt.toISOString() });
}
