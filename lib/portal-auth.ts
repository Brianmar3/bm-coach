import "server-only";

import { createHash, randomBytes, randomInt, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const PORTAL_COOKIE = "bm_coach_student_session";
const SESSION_DAYS = 14;
const SCRYPT_KEY_LENGTH = 64;

function scrypt(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => nodeScrypt(password, salt, SCRYPT_KEY_LENGTH, (error, derived) => error ? reject(error) : resolve(derived as Buffer)));
}

export function passwordValidationError(password: string) {
  if (password.length < 10 || password.length > 128) return "La contraseña debe tener entre 10 y 128 caracteres.";
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) return "La contraseña debe incluir mayúscula, minúscula y número.";
  return null;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derived = await scrypt(password, salt);
  return `scrypt$v1$${salt}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, version, salt, encoded] = storedHash.split("$");
  if (algorithm !== "scrypt" || version !== "v1" || !salt || !encoded) return false;
  const expected = Buffer.from(encoded, "base64url");
  const actual = await scrypt(password, salt);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function consumePasswordVerificationTime(password: string) {
  await scrypt(password, "bm-coach-invalid-user-salt");
}

export function temporaryPassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const all = upper + lower + digits;
  const chars = [upper[randomInt(upper.length)], lower[randomInt(lower.length)], digits[randomInt(digits.length)]];
  while (chars.length < 14) chars.push(all[randomInt(all.length)]);
  for (let index = chars.length - 1; index > 0; index--) { const swap = randomInt(index + 1); [chars[index], chars[swap]] = [chars[swap], chars[index]]; }
  return chars.join("");
}

export function normalizeUsername(value: string) {
  return value.trim().toLocaleLowerCase("es").replace(/\s+/g, "");
}

export function sessionTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createPortalSession(studentId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await prisma.studentPortalSession.create({ data: { studentId, tokenHash: sessionTokenHash(token), expiresAt } });
  return { token, expiresAt };
}

export function portalCookieOptions(expiresAt: Date) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", expires: expiresAt, priority: "high" as const };
}

export async function getPortalSession() {
  const token = (await cookies()).get(PORTAL_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.studentPortalSession.findUnique({
    where: { tokenHash: sessionTokenHash(token) },
    include: { credential: { include: { student: true } } },
  });
  if (!session || session.expiresAt <= new Date() || !session.credential.active) return null;
  return session;
}

export async function requirePortalPageSession() {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");
  return session;
}

export function validRequestOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return request.method === "GET" || request.method === "HEAD" || process.env.NODE_ENV !== "production";
  try {
    const originHost = new URL(origin).host;
    const requestHosts = [
      new URL(request.url).host,
      request.headers.get("x-forwarded-host")?.split(",")[0]?.trim(),
      request.headers.get("host")?.trim(),
    ].filter((host): host is string => Boolean(host));
    return requestHosts.includes(originHost);
  } catch {
    return false;
  }
}

export function adminAuthorization(request: Request) {
  const configured = process.env.BM_COACH_ADMIN_TOKEN;
  if (!configured || configured.length < 32) return { ok: false as const, status: 503, error: "Configurá BM_COACH_ADMIN_TOKEN con al menos 32 caracteres." };
  const supplied = request.headers.get("x-bm-admin-token") ?? "";
  const expectedBuffer = Buffer.from(configured);
  const suppliedBuffer = Buffer.from(supplied);
  const ok = expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
  return ok ? { ok: true as const } : { ok: false as const, status: 401, error: "Autorización administrativa inválida." };
}
