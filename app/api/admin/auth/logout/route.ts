import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-auth";
import { validRequestOrigin } from "@/lib/portal-auth";
import { clearPortalExperienceCookieOptions, LAST_PORTAL_COOKIE, parsePortalExperience } from "@/lib/portal-experience";

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen de solicitud inválido." }, { status: 403 });
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  if (parsePortalExperience(cookieStore.get(LAST_PORTAL_COOKIE)?.value) === "admin") cookieStore.set(LAST_PORTAL_COOKIE, "", clearPortalExperienceCookieOptions());
  return Response.json({ authenticated: false });
}
