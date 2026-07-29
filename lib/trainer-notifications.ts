import "server-only";

import webpush from "web-push";

import { ClassResponseStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const TRAINER_OWNER_KEY = "coach";

type TrainerPushSubscriptionRecord = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type AttendanceNotificationInput = {
  eventKey: string;
  studentId: string;
  studentName: string;
  occurrenceId: string;
  scheduleId?: string | null;
  className: string;
  classDate: Date;
  startTime: string;
  response: ClassResponseStatus;
};

type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

function getVapidConfiguration() {
  const publicKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "")
    .trim()
    .replace(/^(['"])(.*)\1$/, "$2")
    .trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();

  if (
    publicKey.length !== 87 ||
    !/^[A-Za-z0-9_-]+$/.test(publicKey) ||
    !privateKey ||
    !subject
  ) {
    return null;
  }

  return { publicKey, privateKey, subject };
}

function formatArgentinaDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function buildAttendanceMessage(input: AttendanceNotificationInput) {
  const date = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
  }).format(input.classDate);
  if (input.response === ClassResponseStatus.GOING) {
    return `${input.studentName} confirmó asistencia a ${input.className} de las ${input.startTime} del ${date}.`;
  }

  return `${input.studentName} indicó que no asistirá a ${input.className} de las ${input.startTime} del ${date}.`;
}

function buildAttendanceUrl(input: AttendanceNotificationInput) {
  const params = new URLSearchParams({
    date: formatArgentinaDateKey(input.classDate),
  });

  if (input.scheduleId) {
    params.set("scheduleId", input.scheduleId);
  }

  return `/asistencias?${params.toString()}`;
}

async function sendToSubscription(
  subscription: TrainerPushSubscriptionRecord,
  payload: PushPayload,
) {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload),
    );

    await prisma.trainerPushSubscription.update({
      where: { id: subscription.id },
      data: {
        active: true,
        lastUsedAt: new Date(),
        lastError: null,
      },
    });

    return { delivered: true, error: null };
  } catch (error) {
    const statusCode =
      typeof error === "object" && error && "statusCode" in error
        ? Number(error.statusCode)
        : null;
    const message = error instanceof Error ? error.message : "Error desconocido";
    const expired = statusCode === 404 || statusCode === 410;

    await prisma.trainerPushSubscription.update({
      where: { id: subscription.id },
      data: {
        active: !expired,
        lastError: message.slice(0, 500),
      },
    });

    console.error("[trainer-push] No se pudo enviar una notificación", {
      subscriptionId: subscription.id,
      statusCode,
      expired,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: message,
    });

    return { delivered: false, error: message };
  }
}

export async function dispatchTrainerPush(
  notificationId: string,
  payload: PushPayload,
) {
  const subscriptions = await prisma.trainerPushSubscription.findMany({
    where: {
      ownerKey: TRAINER_OWNER_KEY,
      active: true,
    },
    select: {
      id: true,
      endpoint: true,
      p256dh: true,
      auth: true,
    },
  });

  const vapid = getVapidConfiguration();
  const attemptedAt = new Date();

  if (!vapid) {
    await prisma.trainerNotification.update({
      where: { id: notificationId },
      data: {
        pushAttemptedAt: attemptedAt,
        pushError: "VAPID no está configurado.",
      },
    });
    return;
  }

  if (subscriptions.length === 0) {
    await prisma.trainerNotification.update({
      where: { id: notificationId },
      data: {
        pushAttemptedAt: attemptedAt,
        pushError: "No hay dispositivos activos.",
      },
    });
    return;
  }

  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const results = await Promise.all(
    subscriptions.map((subscription) => sendToSubscription(subscription, payload)),
  );
  const delivered = results.some((result) => result.delivered);
  const errors = results
    .map((result) => result.error)
    .filter((error): error is string => Boolean(error));

  await prisma.trainerNotification.update({
    where: { id: notificationId },
    data: {
      pushAttemptedAt: attemptedAt,
      pushDeliveredAt: delivered ? new Date() : null,
      pushError: delivered ? null : errors.join(" | ").slice(0, 1000),
    },
  });
}

export async function createAttendanceTrainerNotification(
  input: AttendanceNotificationInput,
) {
  const message = buildAttendanceMessage(input);
  const url = buildAttendanceUrl(input);

  try {
    const notification = await prisma.trainerNotification.create({
      data: {
        ownerKey: TRAINER_OWNER_KEY,
        type: "CLASS_RESPONSE",
        eventKey: input.eventKey,
        title: "BM Training",
        message,
        url,
        studentId: input.studentId,
        occurrenceId: input.occurrenceId,
        response: input.response,
      },
    });

    return {
      notification,
      payload: {
        title: notification.title,
        body: notification.message,
        url: notification.url,
        tag: `class-response-${input.occurrenceId}-${input.studentId}`,
      },
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return null;
    }

    console.error("[trainer-notification] No se pudo crear la notificación", {
      eventKey: input.eventKey,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function sendTrainerTestNotification(
  subscription: TrainerPushSubscriptionRecord,
) {
  const vapid = getVapidConfiguration();
  if (!vapid) {
    throw new Error("VAPID_NOT_CONFIGURED");
  }

  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  return sendToSubscription(subscription, {
    title: "BM Training",
    body: "Las notificaciones del entrenador están activadas correctamente.",
    url: "/dashboard",
    tag: "trainer-push-test",
  });
}

export function getTrainerPushPublicConfiguration() {
  const raw = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const publicKey = raw.trim().replace(/^(['"])(.*)\1$/, "$2").trim();
  const publicKeyValid =
    publicKey.length === 87 && /^[A-Za-z0-9_-]+$/.test(publicKey);

  return {
    configured: Boolean(getVapidConfiguration()),
    publicKey: publicKeyValid ? publicKey : "",
    publicKeyLength: publicKey.length,
    publicKeyPresent: raw.length > 0,
    publicKeyValid,
  };
}
