import { createHash, randomBytes } from "node:crypto";

export const TRAINER_PASSWORD_RESET_MINUTES = 30;

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
