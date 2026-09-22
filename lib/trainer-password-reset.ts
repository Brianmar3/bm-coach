import { createHash, randomBytes } from "node:crypto";

export const TRAINER_PASSWORD_RESET_MINUTES = 30;

export class TrainerPasswordResetRejected extends Error {}

type TrainerPasswordResetRecord = {
  id: string;
  trainerUserId: string;
  expiresAt: Date;
  usedAt: Date | null;
  trainer: { platformRole: string };
};

export type TrainerPasswordResetStore = {
  findByTokenHash(tokenHash: string): Promise<TrainerPasswordResetRecord | null>;
  claim(id: string, now: Date): Promise<boolean>;
  updateTrainerPassword(trainerUserId: string, passwordHash: string): Promise<void>;
};

export function trainerPasswordResetToken() {
  return randomBytes(32).toString("base64url");
}

export function trainerPasswordResetTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function trainerPasswordResetExpiresAt(now = new Date()) {
  return new Date(now.getTime() + TRAINER_PASSWORD_RESET_MINUTES * 60000);
}

export function trainerPasswordResetIsUsable(value: { expiresAt: Date; usedAt: Date | null }, now = new Date()) {
  return value.usedAt === null && value.expiresAt > now;
}

export async function consumeTrainerPasswordResetToken(store: TrainerPasswordResetStore, token: string, passwordHash: string, now = new Date()) {
  const reset = await store.findByTokenHash(trainerPasswordResetTokenHash(token));
  if (!reset || !trainerPasswordResetIsUsable(reset, now) || reset.trainer.platformRole !== "TRAINER") throw new TrainerPasswordResetRejected();
  if (!await store.claim(reset.id, now)) throw new TrainerPasswordResetRejected();
  await store.updateTrainerPassword(reset.trainerUserId, passwordHash);
  return reset.trainerUserId;
}
