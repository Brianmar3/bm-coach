import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionValue,
} from "@/lib/admin-auth";
import { validRequestOrigin } from "@/lib/portal-auth";
import {
  getTrainerPushPublicConfiguration,
  sendTrainerTestNotification,
  TRAINER_OWNER_KEY,
} from "@/lib/trainer-notifications";

type PushSubscriptionPayload = {
  endpoint?: unknown;
  keys?: {
    p256dh?: unknown;
    auth?: unknown;
  };
};

async function isAuthenticatedTrainer() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  return verifyAdminSessionValue(token).ok;
}

function parseSubscription(body: PushSubscriptionPayload) {
  const endpoint =
    typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  const p256dh =
    typeof body.keys?.p256dh === "string" ? body.keys.p256dh.trim() : "";
  const auth = typeof body.keys?.auth === "string" ? body.keys.auth.trim() : "";

  if (
    !endpoint.startsWith("https://") ||
    endpoint.length > 2048 ||
    !p256dh ||
    p256dh.length > 512 ||
    !auth ||
    auth.length > 512
  ) {
    return null;
  }

  return { endpoint, p256dh, auth };
}

export async function GET(request: Request) {
  if (!(await isAuthenticatedTrainer())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const endpoint = new URL(request.url).searchParams.get("endpoint")?.trim() ?? "";
  const [activeDevices, latestSubscription, activeCurrent] = await Promise.all([
    prisma.trainerPushSubscription.count({
      where: { ownerKey: TRAINER_OWNER_KEY, active: true },
    }),
    prisma.trainerPushSubscription.findFirst({
      where: { ownerKey: TRAINER_OWNER_KEY },
      orderBy: { updatedAt: "desc" },
      select: {
        updatedAt: true,
        lastError: true,
      },
    }),
    endpoint
      ? prisma.trainerPushSubscription.count({
          where: {
            ownerKey: TRAINER_OWNER_KEY,
            endpoint,
            active: true,
          },
        })
      : Promise.resolve(0),
  ]);
  const configuration = getTrainerPushPublicConfiguration();

  return NextResponse.json({
    configured: configuration.configured,
    publicKey: configuration.publicKey,
    diagnostics: {
      publicKeyPresent: configuration.publicKeyPresent,
      publicKeyLength: configuration.publicKeyLength,
      publicKeyValid: configuration.publicKeyValid,
    },
    activeDevices,
    activeCurrent: activeCurrent > 0,
    latestSubscription,
  });
}

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }
  if (!(await isAuthenticatedTrainer())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const configuration = getTrainerPushPublicConfiguration();
  if (!configuration.configured) {
    return NextResponse.json(
      { error: "Las notificaciones todavía no están configuradas." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | PushSubscriptionPayload
    | null;
  const subscription = body ? parseSubscription(body) : null;
  if (!subscription) {
    return NextResponse.json(
      { error: "La suscripción no es válida." },
      { status: 400 },
    );
  }

  await prisma.trainerPushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      ownerKey: TRAINER_OWNER_KEY,
      ...subscription,
      userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
      active: true,
      lastUsedAt: new Date(),
      lastError: null,
    },
    update: {
      ownerKey: TRAINER_OWNER_KEY,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
      active: true,
      lastUsedAt: new Date(),
      lastError: null,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!validRequestOrigin(request)) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }
  if (!(await isAuthenticatedTrainer())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { endpoint?: unknown }
    | null;
  const endpoint =
    typeof body?.endpoint === "string" ? body.endpoint.trim() : "";
  if (!endpoint) {
    return NextResponse.json({ error: "Falta la suscripción." }, { status: 400 });
  }

  await prisma.trainerPushSubscription.updateMany({
    where: {
      ownerKey: TRAINER_OWNER_KEY,
      endpoint,
    },
    data: {
      active: false,
      lastUsedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request) {
  if (!validRequestOrigin(request)) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }
  if (!(await isAuthenticatedTrainer())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { endpoint?: unknown }
    | null;
  const endpoint =
    typeof body?.endpoint === "string" ? body.endpoint.trim() : "";
  if (!endpoint) {
    return NextResponse.json({ error: "Falta la suscripción." }, { status: 400 });
  }

  const subscription = await prisma.trainerPushSubscription.findFirst({
    where: {
      ownerKey: TRAINER_OWNER_KEY,
      endpoint,
      active: true,
    },
    select: {
      id: true,
      endpoint: true,
      p256dh: true,
      auth: true,
    },
  });

  if (!subscription) {
    return NextResponse.json(
      { error: "No se encontró este dispositivo." },
      { status: 404 },
    );
  }

  const result = await sendTrainerTestNotification(subscription);
  if (!result.delivered) {
    return NextResponse.json(
      { error: "No se pudo enviar la notificación de prueba." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
