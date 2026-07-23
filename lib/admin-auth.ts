import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "bm_coach_admin_session";
export const ADMIN_SESSION_HOURS = 12;

type AdminSessionResult =
  | { ok: true; role: "coach"; expiresAt: Date }
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

export function createAdminSessionValue(now = new Date()) {
  const secret = configuredSecret();
  if (!secret) return null;
  const expiresAt = new Date(now.getTime() + ADMIN_SESSION_HOURS * 60 * 60 * 1000);
  const payload = `v1.${expiresAt.getTime()}.coach.${randomBytes(24).toString("base64url")}`;
  return { value: `${payload}.${signature(payload, secret)}`, expiresAt };
}

export function verifyAdminSessionValue(value: string | undefined, now = new Date()): AdminSessionResult {
  if (!value) return { ok: false, reason: "missing" };
  const secret = configuredSecret();
  if (!secret) return { ok: false, reason: "misconfigured" };
  const parts = value.split(".");
  if (parts.length !== 5) return { ok: false, reason: "invalid" };
  const [version, expires, role, nonce, suppliedSignature] = parts;
  if (version !== "v1" || role !== "coach" || !nonce || !/^\d+$/.test(expires)) return { ok: false, reason: "invalid" };
  const payload = `${version}.${expires}.${role}.${nonce}`;
  if (!safeEqual(suppliedSignature, signature(payload, secret))) return { ok: false, reason: "invalid" };
  const expiresAt = new Date(Number(expires));
  if (!Number.isFinite(expiresAt.getTime())) return { ok: false, reason: "invalid" };
  if (expiresAt <= now) return { ok: false, reason: "expired" };
  return { ok: true, role: "coach", expiresAt };
}

export function adminSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
    priority: "high" as const,
  };
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
