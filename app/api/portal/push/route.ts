import { prisma } from "@/lib/prisma";
import { establishAchievementBaseline } from "@/lib/push-notifications";
import { getPortalSession, validRequestOrigin } from "@/lib/portal-auth";
import { createECDH } from "node:crypto";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validEndpoint(value: string) {
  try { return new URL(value).protocol === "https:" && value.length <= 2048; } catch { return false; }
}
const validKey = (value: string) => /^[A-Za-z0-9_-]{16,512}$/.test(value);
function publicVapidKey() {
  const raw = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
  const subject = process.env.VAPID_SUBJECT ?? "";
  let valid = false;
  try {
    const url = new URL(subject);
    if (/^[A-Za-z0-9_-]{43}$/.test(privateKey) && (url.protocol === "mailto:" || url.protocol === "https:")) {
      const pair = createECDH("prime256v1");
      pair.setPrivateKey(Buffer.from(privateKey, "base64url"));
      valid = pair.getPublicKey().toString("base64url") === raw;
    }
  } catch { /* Invalid configuration must not reach PushManager. */ }
  return { value: valid ? raw : "", present: raw.length > 0, length: raw.length, valid };
}

export async function GET(request: Request) {
  const session = await getPortalSession();
  if (!session) return Response.json({ error: "Sesión vencida." }, { status: 401 });
  const publicKey = publicVapidKey();
  const endpoint = new URL(request.url).searchParams.get("endpoint");
  const activeCurrent = endpoint && validEndpoint(endpoint)
    ? Boolean(await prisma.studentPushSubscription.findFirst({ where: { studentId: session.studentId, endpoint, active: true }, select: { id: true } }))
    : false;
  return Response.json({
    configured: publicKey.valid,
    publicKey: publicKey.value,
    diagnostics: { publicKeyPresent: publicKey.present, publicKeyLength: publicKey.length, publicKeyValid: publicKey.valid },
    activeDevices: await prisma.studentPushSubscription.count({ where: { studentId: session.studentId, active: true } }),
    activeCurrent,
  });
}

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const session = await getPortalSession();
  if (!session) return Response.json({ error: "Sesión vencida." }, { status: 401 });
  if (!publicVapidKey().valid) return Response.json({ error: "Las notificaciones todavía no están configuradas." }, { status: 503 });
  const input = await request.json().catch(() => null) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown }; deviceLabel?: unknown } | null;
  const endpoint = typeof input?.endpoint === "string" ? input.endpoint : "";
  const p256dh = typeof input?.keys?.p256dh === "string" ? input.keys.p256dh : "";
  const auth = typeof input?.keys?.auth === "string" ? input.keys.auth : "";
  if (!validEndpoint(endpoint) || !validKey(p256dh) || !validKey(auth)) return Response.json({ error: "La suscripción push no es válida." }, { status: 400 });
  const ownedByOther = await prisma.studentPushSubscription.findFirst({ where: { endpoint, studentId: { not: session.studentId } }, select: { id: true } });
  if (ownedByOther) return Response.json({ error: "Este dispositivo está asociado a otra cuenta." }, { status: 409 });
  await establishAchievementBaseline(session.studentId);
  try {
    await prisma.studentPushSubscription.upsert({
    where: { endpoint, studentId: session.studentId },
    create: { studentId: session.studentId, endpoint, p256dh, auth, userAgent: request.headers.get("user-agent")?.slice(0, 500), deviceLabel: typeof input?.deviceLabel === "string" ? input.deviceLabel.slice(0, 80) : null, active: true, lastUsedAt: new Date() },
    update: { p256dh, auth, active: true, userAgent: request.headers.get("user-agent")?.slice(0, 500), lastUsedAt: new Date() },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    // A concurrent insert may win the unique endpoint. Only refresh our own row.
    const updated = await prisma.studentPushSubscription.updateMany({
      where: { endpoint, studentId: session.studentId },
      data: { p256dh, auth, active: true, lastUsedAt: new Date() },
    });
    if (!updated.count) return Response.json({ error: "Este dispositivo está asociado a otra cuenta." }, { status: 409 });
  }
  return Response.json({ message: "Notificaciones activadas correctamente." });
}

export async function DELETE(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const session = await getPortalSession();
  if (!session) return Response.json({ error: "Sesión vencida." }, { status: 401 });
  const input = await request.json().catch(() => null) as { endpoint?: unknown } | null;
  if (typeof input?.endpoint !== "string" || !validEndpoint(input.endpoint)) return Response.json({ error: "La suscripción no es válida." }, { status: 400 });
  await prisma.studentPushSubscription.updateMany({ where: { studentId: session.studentId, endpoint: input.endpoint }, data: { active: false } });
  return Response.json({ message: "Notificaciones desactivadas en este dispositivo." });
}
