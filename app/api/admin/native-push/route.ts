import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ADMIN_SESSION_COOKIE, verifyAdminSessionValue } from "@/lib/admin-auth";
import {
  getNativePushPublicConfiguration,
  sendTrainerNativeTestPush,
  validNativePushAppId,
  validNativePushToken,
} from "@/lib/native-push-notifications";
import { validRequestOrigin } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { TRAINER_OWNER_KEY } from "@/lib/trainer-notifications";
import { requireTrainerWorkspace } from "@/lib/trainer-workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function isAuthenticatedTrainer() {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  return verifyAdminSessionValue(token).ok;
}

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
  if (!(await isAuthenticatedTrainer())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const { workspaceId } = await requireTrainerWorkspace();
  const url = new URL(request.url);
  const appId = url.searchParams.get("appId");
  const token = url.searchParams.get("token");
  if (!validNativePushAppId(appId)) {
    return NextResponse.json({ error: "La aplicación Android no es válida." }, { status: 400 });
  }
  const configuration = getNativePushPublicConfiguration();
  if (!configuration.configured) {
    return NextResponse.json({ ...configuration, activeDevices: 0, activeCurrent: false });
  }

  const [activeDevices, activeCurrent] = await Promise.all([
    prisma.trainerNativePushDevice.count({
      where: { workspaceId, appId, active: true },
    }),
    token && validNativePushToken(token)
      ? prisma.trainerNativePushDevice.count({
          where: { workspaceId, appId, token, active: true },
        })
      : Promise.resolve(0),
  ]);

  return NextResponse.json({
    ...configuration,
    activeDevices,
    activeCurrent: activeCurrent > 0,
  });
}

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }
  if (!(await isAuthenticatedTrainer())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const { workspaceId } = await requireTrainerWorkspace();
  if (!getNativePushPublicConfiguration().configured) {
    return NextResponse.json({ error: "Firebase todavía no está configurado." }, { status: 503 });
  }
  const device = payload(await request.json().catch(() => null));
  if (!device) {
    return NextResponse.json({ error: "El dispositivo Android no es válido." }, { status: 400 });
  }
  await prisma.$transaction([
    prisma.studentNativePushDevice.updateMany({
      where: { appId: device.appId, token: device.token, active: true },
      data: { active: false, lastUsedAt: new Date() },
    }),
    prisma.trainerNativePushDevice.upsert({
      where: { appId_token: { appId: device.appId, token: device.token } },
      create: {
        workspaceId,
        ownerKey: TRAINER_OWNER_KEY,
        ...device,
        userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
        active: true,
        lastUsedAt: new Date(),
      },
      update: {
        workspaceId,
        ownerKey: TRAINER_OWNER_KEY,
        platform: device.platform,
        deviceLabel: device.deviceLabel,
        userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
        active: true,
        lastUsedAt: new Date(),
        lastError: null,
      },
    }),
  ]);
  return NextResponse.json({ message: "Notificaciones Android activadas correctamente." });
}

export async function DELETE(request: Request) {
  if (!validRequestOrigin(request)) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }
  if (!(await isAuthenticatedTrainer())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const { workspaceId } = await requireTrainerWorkspace();
  const device = payload(await request.json().catch(() => null));
  if (!device) {
    return NextResponse.json({ error: "El dispositivo Android no es válido." }, { status: 400 });
  }
  await prisma.trainerNativePushDevice.updateMany({
    where: { workspaceId, appId: device.appId, token: device.token },
    data: { active: false, lastUsedAt: new Date() },
  });
  return NextResponse.json({ message: "Notificaciones Android desactivadas." });
}

export async function PUT(request: Request) {
  if (!validRequestOrigin(request)) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }
  if (!(await isAuthenticatedTrainer())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const { workspaceId } = await requireTrainerWorkspace();
  const device = payload(await request.json().catch(() => null));
  if (!device) {
    return NextResponse.json({ error: "El dispositivo Android no es válido." }, { status: 400 });
  }
  const record = await prisma.trainerNativePushDevice.findFirst({
    where: { workspaceId, appId: device.appId, token: device.token, active: true },
    select: { id: true, token: true },
  });
  if (!record) {
    return NextResponse.json({ error: "No se encontró este dispositivo." }, { status: 404 });
  }
  const result = await sendTrainerNativeTestPush(record);
  return result.delivered
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "No se pudo enviar la notificación de prueba." }, { status: 502 });
}
