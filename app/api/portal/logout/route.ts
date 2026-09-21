import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { clearPortalSessionCookieOptions, getPortalSession, PORTAL_COOKIE, validRequestOrigin } from "@/lib/portal-auth";
import { clearPortalExperienceCookieOptions, LAST_PORTAL_COOKIE, parsePortalExperience } from "@/lib/portal-experience";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen de solicitud inválido." }, { status: 403 });
  const session = await getPortalSession({ allowSelfService: true });
  if (session) await prisma.studentPortalSession.delete({ where: { id: session.id } });
  const cookieStore = await cookies();
  cookieStore.set(PORTAL_COOKIE, "", clearPortalSessionCookieOptions());
  if (parsePortalExperience(cookieStore.get(LAST_PORTAL_COOKIE)?.value) === "student") cookieStore.set(LAST_PORTAL_COOKIE, "", clearPortalExperienceCookieOptions());
  return Response.json({ ok: true });
}
