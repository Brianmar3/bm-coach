import { timingSafeEqual } from "node:crypto";
import { effectiveTrainerSubscriptionStatus, type TrainerSubscriptionPlanValue, type TrainerSubscriptionStatusValue } from "./trainer-subscription.ts";

export const MASTER_EMAIL_TO = "briiianm36@gmail.com";
export const MASTER_TIME_ZONE = "America/Argentina/Buenos_Aires";
export type MasterEmailItem = { trainer: string; plan: string; dueAt: string | null; state: string; notice: string; trainerId?: string };
export type MasterEmailPayload = { from: string; to: string[]; subject: string; html: string; text: string };

export function argentinaDay(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: MASTER_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function digestWindow(now: Date) {
  const day = argentinaDay(now);
  const cutoff = new Date(`${day}T08:00:00-03:00`);
  return { day, cutoff, ready: now >= cutoff };
}

export function authorizedMasterCron(request: Request, secret: string | undefined) {
  if (!secret || secret.length < 16) return false;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function masterEmailConfig(env: Record<string, string | undefined>) {
  if (env.MASTER_EMAIL_ENABLED !== "true" || env.VERCEL_ENV !== "production") return null;
  if (!env.RESEND_API_KEY || !env.MASTER_EMAIL_FROM || !env.MASTER_APP_URL) throw new Error("MASTER_EMAIL_CONFIG");
  const url = new URL(env.MASTER_APP_URL);
  if (url.protocol !== "https:" || url.username || url.password || /[\r\n]/.test(env.MASTER_EMAIL_FROM)) throw new Error("MASTER_EMAIL_CONFIG");
  if (!/^[^<>\s]+@[^<>\s]+\.[^<>\s]+$/.test(env.MASTER_EMAIL_FROM)) throw new Error("MASTER_EMAIL_CONFIG");
  return { apiKey: env.RESEND_API_KEY, from: `BM Training <${env.MASTER_EMAIL_FROM}>`, masterUrl: new URL("/master", url.origin).href };
}

const states: Record<TrainerSubscriptionStatusValue, string> = { ACTIVE: "Al día", PAST_DUE: "Vencida", SUSPENDED: "Suspendida", CANCELLED: "Cancelada" };
export function membershipEmailItem(subscription: { nextDueAt: Date | null; plan: TrainerSubscriptionPlanValue; status: TrainerSubscriptionStatusValue; trainer: { id?: string; name: string; status?: string } }, now: Date): MasterEmailItem | null {
  if (subscription.status === "CANCELLED" || subscription.status === "SUSPENDED" || subscription.trainer.status === "SUSPENDED" || !subscription.nextDueAt) return null;
  const days = Math.round((Date.parse(argentinaDay(subscription.nextDueAt)) - Date.parse(argentinaDay(now))) / 86400000);
  if (days !== 7 && days !== 3 && days !== 0) return null;
  return { trainer: subscription.trainer.name, trainerId: subscription.trainer.id, plan: subscription.plan, dueAt: subscription.nextDueAt.toISOString(), state: states[effectiveTrainerSubscriptionStatus(subscription, now)], notice: days === 0 ? "Vence hoy" : "Vence en " + days + " días" };
}

function itemUrl(item: MasterEmailItem, masterUrl: string) {
  return item.trainerId ? new URL('/platform/trainers/' + encodeURIComponent(item.trainerId), masterUrl).href : masterUrl;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}
function displayDate(value: string | null) {
  if (!value) return "Sin definir";
  return new Intl.DateTimeFormat("es-AR", { timeZone: MASTER_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

export function renderMasterEmail(items: MasterEmailItem[], day: string, from: string, masterUrl: string): MasterEmailPayload {
  const date = day.split("-").reverse().join("/");
  const subject = `BM Training · Resumen Master · ${date}`;
  const cards = items.map((item) => `<tr><td style="padding:20px 24px;border-bottom:1px solid #dedede"><p style="margin:0 0 8px;color:#85621a;font-size:13px;font-weight:bold">${escapeHtml(item.notice)}</p><h2 style="margin:0 0 12px;color:#111111;font-size:19px">${escapeHtml(item.trainer)}</h2><p style="margin:0;color:#333333;line-height:1.7">Plan: <strong>${escapeHtml(item.plan)}</strong><br>Vencimiento: <strong>${displayDate(item.dueAt)}</strong><br>Estado: <strong>${escapeHtml(item.state)}</strong></p><p><a href="${escapeHtml(itemUrl(item, masterUrl))}" style="color:#85621a">Ver en el Master</a></p></td></tr>`).join("");
  return {
    from, to: [MASTER_EMAIL_TO], subject,
    html: `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#eeeeee;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#ffffff"><tr><td style="background:#0a0a0a;padding:28px 24px;border-top:4px solid #c9a44c"><p style="margin:0;color:#c9a44c;font-size:24px;font-weight:bold">BM TRAINING</p><h1 style="color:#ffffff;font-size:21px;margin:16px 0 8px">Resumen del Master</h1><p style="color:#eeeeee;margin:0">${date} · ${items.length} ${items.length === 1 ? "novedad" : "novedades"}</p></td></tr>${cards}<tr><td style="padding:28px 24px"><a href="${escapeHtml(masterUrl)}" style="display:inline-block;background:#c9a44c;color:#0a0a0a;padding:14px 24px;font-weight:bold;text-decoration:none">Abrir Master</a><p style="font-size:12px;color:#666666;line-height:1.6;margin:20px 0 0">Resumen diario de membresías y accesos. Corte: 08:00, hora argentina. Las novedades posteriores se incluyen en el próximo resumen.</p></td></tr></table></td></tr></table></body></html>`,
    text: `${subject}\n\n${items.map((item) => `${item.notice}\nEntrenador: ${item.trainer}\nPlan: ${item.plan}\nVencimiento: ${displayDate(item.dueAt)}\nEstado: ${item.state}\nVer en el Master: ${itemUrl(item, masterUrl)}`).join("\n\n")}\n\nAbrir Master: ${masterUrl}\nCorte diario: 08:00, hora argentina.`,
  };
}

export class MasterEmailDeliveryError extends Error {
  retryable: boolean;
  constructor(code: string, retryable: boolean) { super(code); this.retryable = retryable; }
}

export async function sendMasterEmail(payload: MasterEmailPayload, key: string, apiKey: string, transport: typeof fetch = fetch) {
  const { from, subject, html, text } = payload;
  const body = JSON.stringify({ from, to: [MASTER_EMAIL_TO], subject, html, text });
  let response: Response;
  try {
    response = await transport("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": key },
      body, signal: AbortSignal.timeout(10000), redirect: "error",
    });
  } catch { throw new MasterEmailDeliveryError("RESEND_NETWORK", true); }
  if (!response.ok) throw new MasterEmailDeliveryError(`RESEND_HTTP_${response.status}`, response.status >= 500 || response.status === 429 || response.status === 409);
  const result = await response.json().catch(() => null) as { id?: unknown } | null;
  if (!result || typeof result.id !== "string" || !result.id) throw new MasterEmailDeliveryError("RESEND_INVALID_RESPONSE", true);
  return result.id;
}
