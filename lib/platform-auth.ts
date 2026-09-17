import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, adminAuthError, verifyAdminSessionValue } from "@/lib/admin-auth";
import { isPlatformOwner } from "@/lib/platform-access";
import { prisma } from "@/lib/prisma";

async function currentUser() {
  const session = verifyAdminSessionValue((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if (!session.ok) return { session, user: null };
  let user = session.userId ? await prisma.user.findUnique({ where: { id: session.userId } }) : null;
  if (!session.userId) {
    const memberships = await prisma.workspaceMembership.findMany({ where: { role: "OWNER", status: "ACTIVE", user: { status: "ACTIVE" }, workspace: { slug: "bm-fuerza-funcional", status: "ACTIVE" } }, include: { user: true } });
    user = memberships.length === 1 ? memberships[0].user : null;
  }
  return { session, user };
}

export async function requirePlatformOwnerPage() {
  const actor = await currentUser();
  if (!actor.session.ok) redirect("/master");
  if (!actor.user || actor.user.status !== "ACTIVE" || !isPlatformOwner(actor.user.platformRole)) redirect("/dashboard");
  return actor.user;
}

export async function platformOwnerApiAccess() {
  const actor = await currentUser();
  if (!actor.session.ok) {
    const failure = adminAuthError(actor.session);
    return { ok: false as const, response: Response.json({ error: failure.error }, { status: failure.status }) };
  }
  if (!actor.user || actor.user.status !== "ACTIVE" || !isPlatformOwner(actor.user.platformRole)) return { ok: false as const, response: Response.json({ error: "Acceso exclusivo del propietario de la plataforma." }, { status: 403 }) };
  return { ok: true as const, user: actor.user };
}
