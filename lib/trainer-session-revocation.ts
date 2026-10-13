import { AUTH_SESSION_MAX_AGE_SECONDS } from "./session-persistence.ts";

type ResetStore = {
  trainerPasswordResetToken: {
    findFirst(args: { where: { trainerUserId: string; usedAt: { gte: Date } }; select: { id: true } }): Promise<{ id: string } | null>;
  };
};

// Signed sessions have a fixed lifetime, so expiry also authenticates issuance time.
// A consumed/revoked reset token is an existing durable revocation marker.
export async function trainerSessionIsCurrent(userId: string, expiresAt: Date, store: ResetStore) {
  const issuedAt = new Date(expiresAt.getTime() - AUTH_SESSION_MAX_AGE_SECONDS * 1000);
  if (!Number.isFinite(issuedAt.getTime())) return false;
  const reset = await store.trainerPasswordResetToken.findFirst({
    where: { trainerUserId: userId, usedAt: { gte: issuedAt } },
    select: { id: true },
  });
  return reset === null;
}
