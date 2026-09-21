import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { AUTH_SESSION_DAYS, authSessionExpiresAt, clearAuthCookieOptions, persistentAuthCookieOptions } from "./session-persistence.ts";

export const ADMIN_SESSION_COOKIE = "bm_coach_admin_session";
export const ADMIN_SESSION_DAYS = AUTH_SESSION_DAYS;

type AdminSessionResult =
  | { ok: true; role: "coach"; userId: string | null; expiresAt: Date }
  | { ok: false; reason: "missing" | "invalid" | "expired" | "misconfigured" };

function configuredSecret() {
  const value = process.env.BM_COACH_ADMIN_TOKEN ?? "";
  return value.length >= 32 ? value : null;
}

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyAdminCredential(supplied: string) {
  const secret = configuredSecret();
  if (!secret) return { ok: false as const, reason: "misconfigured" as const };
  return safeEqual(supplied, secret)
    ? { ok: true as const }
    : { ok: false as const, reason: "invalid" as const };
}

export function createAdminSessionValue(userId: string | null = null, now = new Date()) {
  const secret = configuredSecret();
  if (!secret) return null;
  const expiresAt = authSessionExpiresAt(now);
  const nonce = randomBytes(24).toString("base64url");
  const payload = userId
    ? `v2.${expiresAt.getTime()}.coach.${Buffer.from(userId).toString("base64url")}.${nonce}`
    : `v1.${expiresAt.getTime()}.coach.${nonce}`;
  return { value: `${payload}.${signature(payload, secret)}`, expiresAt };
}

export function verifyAdminSessionValue(value: string | undefined, now = new Date()): AdminSessionResult {
  if (!value) return { ok: false, reason: "missing" };
  const secret = configuredSecret();
  if (!secret) return { ok: false, reason: "misconfigured" };
  const parts = value.split(".");
  if (parts.length !== 5 && parts.length !== 6) return { ok: false, reason: "invalid" };
  const version = parts[0];
  const expires = parts[1];
  const role = parts[2];
  const encodedUserId = version === "v2" ? parts[3] : null;
  const nonce = version === "v2" ? parts[4] : parts[3];
  const suppliedSignature = version === "v2" ? parts[5] : parts[4];
  if (!['v1', 'v2'].includes(version) || role !== "coach" || !nonce || !suppliedSignature || !/^\d+$/.test(expires)) return { ok: false, reason: "invalid" };
  if (version === "v2" && !encodedUserId) return { ok: false, reason: "invalid" };
  const payload = version === "v2" ? `${version}.${expires}.${role}.${encodedUserId}.${nonce}` : `${version}.${expires}.${role}.${nonce}`;
  if (!safeEqual(suppliedSignature, signature(payload, secret))) return { ok: false, reason: "invalid" };
  const expiresAt = new Date(Number(expires));
  if (!Number.isFinite(expiresAt.getTime())) return { ok: false, reason: "invalid" };
  if (expiresAt <= now) return { ok: false, reason: "expired" };
  let userId: string | null = null;
  if (encodedUserId) {
    try { userId = Buffer.from(encodedUserId, "base64url").toString("utf8"); }
    catch { return { ok: false, reason: "invalid" }; }
    if (!userId || userId.length > 191) return { ok: false, reason: "invalid" };
  }
  return { ok: true, role: "coach", userId, expiresAt };
}

export function adminSessionCookieOptions(expiresAt: Date) {
  return persistentAuthCookieOptions(expiresAt);
}

export function clearAdminSessionCookieOptions() {
  return clearAuthCookieOptions();
}

export function adminAuthError(result: Exclude<AdminSessionResult, { ok: true }>) {
  if (result.reason === "missing" || result.reason === "expired") {
    return { status: 401, error: "Autenticación administrativa requerida." };
  }
  if (result.reason === "misconfigured") {
    return { status: 503, error: "La autenticación administrativa no está configurada correctamente." };
  }
  return { status: 403, error: "La sesión administrativa no es válida." };
}
