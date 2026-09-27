import { cookies } from "next/headers";
import { PLATFORM_SESSION_COOKIE, clearAdminSessionCookieOptions } from "@/lib/admin-auth";
import { validRequestOrigin } from "@/lib/portal-auth";

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen de solicitud inválido." }, { status: 403 });
  (await cookies()).set(PLATFORM_SESSION_COOKIE, "", clearAdminSessionCookieOptions());
  return Response.json({ authenticated: false });
}
