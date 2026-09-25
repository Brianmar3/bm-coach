import {
  getNativePushPublicConfiguration,
  validNativePushAppId,
  validNativePushToken,
} from "@/lib/native-push-notifications";
import { getPortalSession, validRequestOrigin } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { establishAchievementBaseline } from "@/lib/push-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function payload(input: unknown) {
  const body = input as {
    appId?: unknown;
    token?: unknown;
    platform?: unknown;
    deviceLabel?: unknown;
  } | null;
  if (
    !body ||
    !validNativePushAppId(body.appId) ||
    !validNativePushToken(body.token) ||
    body.platform !== "ANDROID"
  ) return null;
  return {
    appId: body.appId,
    token: body.token,
    platform: "ANDROID",
    deviceLabel: typeof body.deviceLabel === "string"
      ? body.deviceLabel.trim().slice(0, 80) || null
      : null,
  } as const;
}

export async function GET(request: Request) {
  const session = await getPortalSession();
  if (!session) return Response.json({ error: "Sesión vencida." }, { status: 401 });
  const url = new URL(request.url);
  const appId = url.searchParams.get("appId");
  const token = url.searchParams.get("token");
  if (!validNativePushAppId(appId)) {
    return Response.json({ error: "La aplicación Android no es válida." }, { status: 400 });
  }
  const configuration = getNativePushPublicConfiguration();
  if (!configuration.configured) {
    return Response.json({ ...configuration, activeDevices: 0, activeCurrent: false });
  }
  const [activeDevices, activeCurrent] = await Promise.all([
    prisma.studentNativePushDevice.count({
      where: { studentId: session.studentId, appId, active: true },
    }),
    token && validNativePushToken(token)
      ? prisma.studentNativePushDevice.count({
          where: { studentId: session.studentId, appId, token, active: true },
        })
      : Promise.resolve(0),
  ]);
  return Response.json({
    ...configuration,
    activeDevices,
    activeCurrent: activeCurrent > 0,
  });
}

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const session = await getPortalSession();
  if (!session) return Response.json({ error: "Sesión vencida." }, { status: 401 });
  if (!getNativePushPublicConfiguration().configured) {
    return Response.json({ error: "Firebase todavía no está configurado." }, { status: 503 });
  }
  const device = payload(await request.json().catch(() => null));
  if (!device) return Response.json({ error: "El dispositivo Android no es válido." }, { status: 400 });
  await establishAchievementBaseline(session.studentId);
  await prisma.$transaction([
    prisma.trainerNativePushDevice.updateMany({
      where: { appId: device.appId, token: device.token, active: true },
      data: { active: false, lastUsedAt: new Date() },
    }),
    prisma.studentNativePushDevice.upsert({
      where: { appId_token: { appId: device.appId, token: device.token } },
      create: {
        studentId: session.studentId,
        ...device,
        userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
        active: true,
        lastUsedAt: new Date(),
      },
      update: {
        studentId: session.studentId,
        platform: device.platform,
        deviceLabel: device.deviceLabel,
        userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
        active: true,
        lastUsedAt: new Date(),
        lastError: null,
      },
    }),
  ]);
  return Response.json({ message: "Notificaciones Android activadas correctamente." });
}

export async function DELETE(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const session = await getPortalSession();
  if (!session) return Response.json({ error: "Sesión vencida." }, { status: 401 });
  const device = payload(await request.json().catch(() => null));
  if (!device) return Response.json({ error: "El dispositivo Android no es válido." }, { status: 400 });
  await prisma.studentNativePushDevice.updateMany({
    where: { studentId: session.studentId, appId: device.appId, token: device.token },
    data: { active: false, lastUsedAt: new Date() },
  });
  return Response.json({ message: "Notificaciones Android desactivadas." });
}
