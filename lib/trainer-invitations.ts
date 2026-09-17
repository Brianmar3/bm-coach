import { createHash, randomBytes } from "node:crypto";

export const TRAINER_INVITATION_DAYS = 7;

export function trainerInvitationToken() {
  return randomBytes(32).toString("base64url");
}

export function trainerInvitationTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function studentEmailConflict(records: Array<{ data: unknown }>, email: string) {
  const normalized = email.trim().toLowerCase();
  return records.some(({ data }) => {
    if (!data || typeof data !== "object" || Array.isArray(data)) return false;
    const candidate = (data as Record<string, unknown>).email;
    return typeof candidate === "string" && candidate.trim().toLowerCase() === normalized;
  });
}

export type TrainerInvitationInput = { firstName: string; lastName: string; email: string; phone: string | null; brandName: string | null };

export function parseTrainerInvitation(value: unknown): TrainerInvitationInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const allowed = ["firstName", "lastName", "email", "phone", "brandName"];
  if (Object.keys(body).some((key) => !allowed.includes(key))) return null;
  if ([body.firstName, body.lastName, body.email].some((field) => typeof field !== "string")) return null;
  if (body.phone != null && typeof body.phone !== "string" || body.brandName != null && typeof body.brandName !== "string") return null;
  const firstName = (body.firstName as string).trim();
  const lastName = (body.lastName as string).trim();
  const email = (body.email as string).trim().toLowerCase();
  const phone = typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
  const brandName = typeof body.brandName === "string" && body.brandName.trim() ? body.brandName.trim() : null;
  if (!firstName || firstName.length > 80 || !lastName || lastName.length > 80 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  if (phone && (phone.length > 40 || !/^[+\d\s().-]+$/.test(phone))) return null;
  if (brandName && brandName.length > 120) return null;
  return { firstName, lastName, email, phone, brandName };
}
