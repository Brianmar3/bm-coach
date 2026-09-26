import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { StudentServiceType } from "@/types/gestion";

export const STUDENT_INVITATION_DAYS = 7;
export type StudentInvitationDisplayStatus = "PENDING" | "USED" | "EXPIRED" | "REVOKED";

export function studentInvitationToken() { return randomBytes(32).toString("base64url"); }
export function studentInvitationTokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
function invitationKey() {
  const secret = process.env.BM_COACH_ADMIN_TOKEN;
  if (!secret || secret.length < 32) throw new Error("La clave de invitaciones no está configurada.");
  return createHash("sha256").update(`student-invitations:v1:${secret}`).digest();
}
export function encryptStudentInvitationToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", invitationKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64url")).join(".");
}
export function decryptStudentInvitationToken(value: string) {
  const [iv, tag, ciphertext] = value.split(".").map((part) => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", invitationKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
export function validStudentInvitationToken(token: unknown): token is string { return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token); }
export function invitationServiceType(stored: StudentServiceType | null): StudentServiceType { return stored ?? "PERSONALIZED"; }
export function studentInvitationDisplayStatus(invitation: { status: string; expiresAt: Date; usedAt?: Date | null }, now = new Date()): StudentInvitationDisplayStatus {
  if (invitation.status === "USED" || invitation.usedAt) return "USED";
  if (invitation.status === "REVOKED") return "REVOKED";
  return invitation.expiresAt <= now ? "EXPIRED" : "PENDING";
}

export type StudentInvitationRegistration = { firstName: string; lastName: string; phone: string; birthDate: string; username: string; password: string };
export function parseStudentInvitationRegistration(value: unknown): { input: StudentInvitationRegistration | null; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { input: null, error: "Revisá los datos ingresados." };
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some((key) => !["firstName", "lastName", "phone", "birthDate", "username", "password", "confirmPassword"].includes(key))) return { input: null, error: "Revisá los datos ingresados." };
  const firstName = typeof data.firstName === "string" ? data.firstName.trim() : "";
  const lastName = typeof data.lastName === "string" ? data.lastName.trim() : "";
  const phone = typeof data.phone === "string" ? data.phone.trim() : "";
  const birthDate = typeof data.birthDate === "string" ? data.birthDate : "";
  const username = typeof data.username === "string" ? data.username.trim().toLocaleLowerCase("es").replace(/\s+/g, "") : "";
  const password = typeof data.password === "string" ? data.password : "";
  if (!firstName || firstName.length > 80 || !lastName || lastName.length > 80 || phone.replace(/\D/g, "").length < 6 || phone.length > 40 || !/^[+\d\s().-]+$/.test(phone)) return { input: null, error: "Ingresá nombre, apellido y un teléfono válido." };
  if (birthDate && (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || !Number.isFinite(new Date(`${birthDate}T12:00:00Z`).getTime()) || new Date(`${birthDate}T12:00:00Z`).toISOString().slice(0, 10) !== birthDate || birthDate > new Date().toISOString().slice(0, 10))) return { input: null, error: "La fecha de nacimiento no es válida." };
  if (!/^[a-z0-9._@+-]{3,80}$/.test(username)) return { input: null, error: "Elegí un usuario de 3 a 80 caracteres (letras, números, punto, guion o @)." };
  if (password !== data.confirmPassword) return { input: null, error: "Las contraseñas no coinciden." };
  return { input: { firstName, lastName, phone, birthDate, username, password }, error: "" };
}

export function studentInvitationWhatsappText(url: string, displayName = "BM Training") {
  const invitationBrand = displayName.trim() || "BM Training";
  return `Hola 👋 Te invito a ${invitationBrand} para que podamos llevar tu entrenamiento y seguimiento desde la app.\n\nCompletá tu registro acá:\n${url}`;
}
