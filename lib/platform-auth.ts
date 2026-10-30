import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PLATFORM_SESSION_COOKIE, adminAuthError } from "@/lib/admin-auth";
import { platformSessionAccess } from "@/lib/platform-session-access";
import { isPlatformOwner } from "@/lib/platform-access";
import { prisma } from "@/lib/prisma";

async function currentUser() {
  return platformSessionAccess((await cookies()).get(PLATFORM_SESSION_COOKIE)?.value, prisma);
}

export async function requirePlatformOwnerPage() {
  const actor = await currentUser();
  if (!actor.session.ok) redirect("/master");
  if (!actor.user || actor.user.status !== "ACTIVE" || !isPlatformOwner(actor.user.platformRole)) redirect("/master");
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
