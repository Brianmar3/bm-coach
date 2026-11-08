import { randomUUID } from "node:crypto";
import type { PrismaClient, Prisma } from "@prisma/client";
import { argentinaDay, digestWindow, MasterEmailDeliveryError, membershipEmailItem, invitationEmailItem, renderMasterEmail, sendMasterEmail, type MasterEmailPayload, type masterEmailConfig } from "./master-email.ts";

type Config = NonNullable<ReturnType<typeof masterEmailConfig>>;
type Database = Pick<PrismaClient, "$transaction">;
const LOCK_ID = 2710202608;

// Serialize snapshot creation across deployments; never hold a DB transaction during HTTP.
export async function prepareMasterDigest(db: Database, config: Config, now: Date) {
  const { day, cutoff } = digestWindow(now);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${LOCK_ID}::bigint)::text`;
    // Never automatically resend an old, ambiguous delivery beyond Resend's 24h key lifetime.
    await tx.masterEmailDigest.updateMany({
      where: { day: { lt: day }, status: { in: ["PENDING", "FAILED", "SENDING"] } },
      data: { status: "REVIEW", lastError: "PREVIOUS_DAY_UNRESOLVED", leaseUntil: null, leaseToken: null },
    });
    const existing = await tx.masterEmailDigest.findUnique({ where: { day } });
    if (existing) return existing;
    const subscriptions = await tx.trainerSubscription.findMany({
      where: {
        status: { not: "CANCELLED" },
        trainer: { platformRole: "TRAINER", memberships: { some: { role: "OWNER", workspace: { type: "PROFESSIONAL" } } } },
      },
      include: { trainer: { select: { id: true, name: true, status: true } } }, orderBy: [{ nextDueAt: "asc" }, { id: "asc" }],
    });
    const renewals = await tx.masterMembershipRenewal.findMany({ where: { digestId: null, occurredAt: { lte: cutoff } }, orderBy: [{ occurredAt: "asc" }, { id: "asc" }] });
    const items = subscriptions.flatMap((subscription) => {
      const item = membershipEmailItem(subscription, cutoff);
      return item ? [item] : [];
    });
    const included = new Set(items.map(item => item.trainerId).filter(Boolean));
    items.push(...[...new Map(renewals.map(renewal => [renewal.trainerUserId, renewal])).values()].map((renewal) => ({ trainer: renewal.trainerName, trainerId: renewal.trainerUserId, plan: renewal.plan, dueAt: renewal.nextDueAt.toISOString(), state: "Renovada", notice: `Renovación registrada · ${argentinaDay(renewal.occurredAt).split("-").reverse().join("/")}` })));
    const suspended = await tx.user.findMany({
      where: { platformRole: "TRAINER", status: "SUSPENDED", memberships: { some: { role: "OWNER", workspace: { type: "PROFESSIONAL" } } } },
      select: { id: true, name: true }, orderBy: { id: "asc" },
    });

    for (const trainer of suspended) if (!included.has(trainer.id)) items.push({ trainer: trainer.name, trainerId: trainer.id, plan: "Consultar membresía", dueAt: null, state: "Acceso suspendido", notice: "Cuenta profesional suspendida · revisar" });
    const invitations = await tx.trainerInvitation.findMany({
      where: { status: "PENDING", acceptedAt: null, createdAt: { lte: cutoff }, expiresAt: { gte: new Date(cutoff.getTime() - 8 * 86400000), lte: new Date(cutoff.getTime() + 3 * 86400000) }, inviter: { platformRole: "PLATFORM_OWNER" } },
      select: { firstName: true, lastName: true, expiresAt: true, createdAt: true, status: true, acceptedAt: true }, orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
    });
    items.push(...invitations.flatMap(invitation => { const item = invitationEmailItem(invitation, cutoff); return item ? [item] : []; }));
    const payload = renderMasterEmail(items, day, config.from, config.masterUrl);
    const digest = await tx.masterEmailDigest.create({ data: { day, status: items.length ? "PENDING" : "SKIPPED", payload, itemCount: items.length } });
    if (renewals.length) await tx.masterMembershipRenewal.updateMany({ where: { id: { in: renewals.map((item) => item.id) }, digestId: null }, data: { digestId: digest.id } });
    return digest;
  }, { maxWait: 5000, timeout: 20000 });
}

async function claimMasterDigest(db: Database, id: string, now: Date) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${LOCK_ID}::bigint)::text`;
    const digest = await tx.masterEmailDigest.findUniqueOrThrow({ where: { id } });
    if (["SENT", "SKIPPED", "REVIEW"].includes(digest.status)) return null;
    if (digest.day !== argentinaDay(now) || digest.firstAttemptAt && now.getTime() - digest.firstAttemptAt.getTime() >= 23 * 3600000) {
      await tx.masterEmailDigest.update({ where: { id }, data: { status: "REVIEW", lastError: "IDEMPOTENCY_WINDOW_EXPIRED" } });
      return null;
    }
    if (digest.leaseUntil && digest.leaseUntil > now) return null;
    const leaseToken = randomUUID();
    const updated = await tx.masterEmailDigest.update({ where: { id }, data: {
      status: "SENDING", leaseToken, leaseUntil: new Date(now.getTime() + 120000), firstAttemptAt: digest.firstAttemptAt ?? now,
    } });
    const attempt = await tx.masterEmailAttempt.create({ data: { digestId: id } });
    return { digest: updated, attempt, leaseToken };
  });
}

async function completeAttempt(db: Database, claim: NonNullable<Awaited<ReturnType<typeof claimMasterDigest>>>, now: Date, result: { providerId: string } | { error: MasterEmailDeliveryError }) {
  await db.$transaction(async (tx) => {
    const success = "providerId" in result;
    const data: Prisma.MasterEmailDigestUpdateManyMutationInput = success
      ? { status: "SENT", sentAt: now, providerId: result.providerId, lastError: null }
      : { status: result.error.retryable ? "FAILED" : "REVIEW", lastError: result.error.message };
    const updated = await tx.masterEmailDigest.updateMany({ where: { id: claim.digest.id, leaseToken: claim.leaseToken }, data: { ...data, leaseToken: null, leaseUntil: null } });
    if (updated.count !== 1) throw new Error("MASTER_EMAIL_LEASE_LOST");
    await tx.masterEmailAttempt.update({ where: { id: claim.attempt.id }, data: {
      status: success ? "ACCEPTED" : "FAILED", completedAt: now,
      ...(success ? { providerId: result.providerId } : { errorCode: result.error.message }),
    } });
  });
}

export async function runMasterDigest(db: Database, config: Config, options: {
  now?: () => Date;
  send?: typeof sendMasterEmail;
  wait?: (ms: number) => Promise<void>;
} = {}) {
  const now = options.now ?? (() => new Date());
  if (!digestWindow(now()).ready) return { status: "BEFORE_SCHEDULE" };
  const digest = await prepareMasterDigest(db, config, now());
  if (["SENT", "SKIPPED", "REVIEW"].includes(digest.status)) return { status: digest.status, digestId: digest.id };
  for (let retry = 0; retry < 3; retry++) {
    const claim = await claimMasterDigest(db, digest.id, now());
    if (!claim) return { status: "ALREADY_CLAIMED", digestId: digest.id };
    let providerId: string;
    try {
      providerId = await (options.send ?? sendMasterEmail)(claim.digest.payload as MasterEmailPayload, `bm-master/${digest.id}`, config.apiKey);
    } catch (cause) {
      const error = cause instanceof MasterEmailDeliveryError ? cause : new MasterEmailDeliveryError("RESEND_UNEXPECTED", true);
      await completeAttempt(db, claim, now(), { error });
      if (!error.retryable || retry === 2) throw error;
      await (options.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))))(1000 * (retry + 1));
      continue;
    }
    // A failed DB acknowledgement leaves the lease intact. Recovery reuses the exact saved payload/key.
    await completeAttempt(db, claim, now(), { providerId });
    return { status: "SENT", digestId: digest.id };
  }
  throw new Error("MASTER_EMAIL_RETRY_EXHAUSTED");
}
