import { prisma } from "@/lib/prisma";
import { establishAchievementBaseline } from "@/lib/push-notifications";
import { getPortalSession, validRequestOrigin } from "@/lib/portal-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validEndpoint(value: string) {
  try { return new URL(value).protocol === "https:" && value.length <= 2048; } catch { return false; }
}
const validKey = (value: string) => /^[A-Za-z0-9_-]{16,512}$/.test(value);

export async function GET() {
  const session = await getPortalSession();
  if (!session) return Response.json({ error: "Sesión vencida." }, { status: 401 });
  return Response.json({
    configured: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT),
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
    activeDevices: await prisma.studentPushSubscription.count({ where: { studentId: session.studentId, active: true } }),
  });
}

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const session = await getPortalSession();
  if (!session) return Response.json({ error: "Sesión vencida." }, { status: 401 });
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) return Response.json({ error: "Las notificaciones todavía no están configuradas." }, { status: 503 });
  const input = await request.json().catch(() => null) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown }; deviceLabel?: unknown } | null;
  const endpoint = typeof input?.endpoint === "string" ? input.endpoint : "";
  const p256dh = typeof input?.keys?.p256dh === "string" ? input.keys.p256dh : "";
  const auth = typeof input?.keys?.auth === "string" ? input.keys.auth : "";
  if (!validEndpoint(endpoint) || !validKey(p256dh) || !validKey(auth)) return Response.json({ error: "La suscripción push no es válida." }, { status: 400 });
  const ownedByOther = await prisma.studentPushSubscription.findFirst({ where: { endpoint, studentId: { not: session.studentId } }, select: { id: true } });
  if (ownedByOther) return Response.json({ error: "Este dispositivo está asociado a otra cuenta." }, { status: 409 });
  await establishAchievementBaseline(session.studentId);
  await prisma.studentPushSubscription.upsert({
    where: { endpoint },
    create: { studentId: session.studentId, endpoint, p256dh, auth, userAgent: request.headers.get("user-agent")?.slice(0, 500), deviceLabel: typeof input?.deviceLabel === "string" ? input.deviceLabel.slice(0, 80) : null, active: true, lastUsedAt: new Date() },
    update: { p256dh, auth, active: true, userAgent: request.headers.get("user-agent")?.slice(0, 500), lastUsedAt: new Date() },
  });
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
