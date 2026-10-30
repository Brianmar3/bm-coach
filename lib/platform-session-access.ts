import type { PrismaClient } from "@prisma/client";
import { verifyPlatformSessionValue } from "@/lib/admin-auth";
import { trainerSessionIsCurrent } from "@/lib/trainer-session-revocation";

/** Same authorization at the proxy, page and API boundaries; unrelated cookies are never consulted. */
export async function platformSessionAccess(token: string | undefined, store: Pick<PrismaClient, "user" | "trainerPasswordResetToken">) {
  const session = verifyPlatformSessionValue(token);
  if (!session.ok || !session.userId) return { session, user: null };
  // Master and Trainer use the same account password, so its existing reset marker revokes both.
  if (!await trainerSessionIsCurrent(session.userId, session.expiresAt, store)) return { session, user: null };
  const user = await store.user.findUnique({ where: { id: session.userId }, select: { id: true, status: true, platformRole: true } });
  return { session, user: user?.status === "ACTIVE" && user.platformRole === "PLATFORM_OWNER" ? user : null };
}
