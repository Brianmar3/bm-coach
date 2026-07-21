import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPortalSession, PORTAL_COOKIE, validRequestOrigin } from "@/lib/portal-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen de solicitud inválido." }, { status: 403 });
  const session = await getPortalSession();
  if (session) await prisma.studentPortalSession.delete({ where: { id: session.id } });
  (await cookies()).set(PORTAL_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return Response.json({ ok: true });
}
