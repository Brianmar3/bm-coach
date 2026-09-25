import "server-only";

import { Prisma } from "@prisma/client";
import { after } from "next/server";
import webpush from "web-push";
import { loadNotifiableAchievements } from "@/lib/notifiable-achievements";
import { sendStudentNativePush } from "@/lib/native-push-notifications";
import type { PortalAchievement } from "@/lib/portal-achievements";
import { prisma } from "@/lib/prisma";
import { getNotificationDestination } from "@/lib/student-notification-destination";

type StudentPushMessage = {
  title: string;
  body: string;
  url?: string;
  tag: string;
  type?: string;
  eventKey?: string;
};

function vapidConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

async function deliverStudentPush(
  studentId: string,
  message: StudentPushMessage,
) {
  try {
    const resolvedMessage = {
      ...message,
      url: getNotificationDestination(message),
    };
    const nativeDelivery = sendStudentNativePush(studentId, resolvedMessage).catch(
      (error) => console.error("No se pudo entregar la notificación Android al alumno", error),
    );

    if (vapidConfigured()) {
      const subscriptions = await prisma.studentPushSubscription.findMany({ where: { studentId, active: true } });
      if (subscriptions.length) {
        webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
        const payload = JSON.stringify(resolvedMessage);
        await Promise.all(subscriptions.map(async (subscription) => {
          try {
            await webpush.sendNotification(
              { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
              payload,
              { TTL: 86400, urgency: "normal" },
            );
            await prisma.studentPushSubscription.update({ where: { id: subscription.id }, data: { lastUsedAt: new Date() } });
          } catch (error) {
            const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
            if (statusCode === 404 || statusCode === 410) {
              await prisma.studentPushSubscription.update({ where: { id: subscription.id }, data: { active: false } });
            }
            console.error("No se pudo entregar una notificación web al alumno", { statusCode });
          }
        }));
      }
    }
    await nativeDelivery;
  } catch (error) {
    console.error("No se pudo procesar la notificación al alumno", error);
  }
}

export async function sendStudentPush(
  studentId: string,
  message: StudentPushMessage,
) {
  after(() => deliverStudentPush(studentId, message));
}

function unlockedAt(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00.000Z`);
}

const ACHIEVEMENT_BASELINE_KEY = "__achievement-baseline:v1__";

export async function establishAchievementBaseline(studentId: string) {
  const existingBaseline = await prisma.achievementNotification.findFirst({
    where: { studentId, achievementKey: ACHIEVEMENT_BASELINE_KEY },
    select: { id: true },
  });
  if (existingBaseline) return;

  const achievements = await loadNotifiableAchievements(studentId, { includeAll: true });
  const baselineAt = new Date();
  await prisma.achievementNotification.createMany({
    data: [
      {
        studentId,
        achievementKey: ACHIEVEMENT_BASELINE_KEY,
        unlockedAt: baselineAt,
        celebratedAt: baselineAt,
        status: "BASELINE" as const,
      },
      ...achievements.map((item) => ({
        studentId,
        achievementKey: item.id,
        unlockedAt: unlockedAt(item.unlockedAt),
        celebratedAt: baselineAt,
        status: "BASELINE" as const,
      })),
    ],
    skipDuplicates: true,
  });
}

function content(items: PortalAchievement[]) {
  if (items.length > 1) return { title: `Desbloqueaste ${items.length} logros`, body: "Entrá a BM Training para verlos." };
  const item = items[0];
  if (item.id.includes(":first:")) return { title: "Primera marca registrada", body: `Guardaste tu primera marca en ${item.exercise}.` };
  if (item.id.includes(":milestone:")) return { title: "Nuevo logro desbloqueado", body: item.description };
  if (item.exercise) return { title: "Nuevo récord personal", body: `Mejoraste tu marca en ${item.exercise}.` };
  if (item.category === "EVALUACIONES") return { title: "Nuevo logro en BM Training", body: "Entrá a la app para ver tu progreso." };
  return { title: "Nuevo logro desbloqueado", body: item.description };
}

type ClaimedAchievement = {
  notificationId: string;
  achievement: PortalAchievement;
};

async function deliverAchievementPush(studentId: string, claimed: ClaimedAchievement[]) {
  const message = content(claimed.map((item) => item.achievement));
  const resolvedMessage = {
    ...message,
    url: getNotificationDestination({ type: "ACHIEVEMENT" }),
    tag: "bm-training-achievements",
    type: "ACHIEVEMENT",
  };
  const nativeResult = await sendStudentNativePush(studentId, resolvedMessage).catch(
    (error) => {
      console.error("No se pudo entregar el logro por Android", error);
      return { configured: true, delivered: false, results: [] };
    },
  );
  let delivered = nativeResult.delivered;
  const errors: string[] = [];
  if (!nativeResult.configured) errors.push("Firebase no configurado");
  errors.push(...nativeResult.results.map((result) => result.error).filter((error): error is string => Boolean(error)));

  if (vapidConfigured()) {
    const subscriptions = await prisma.studentPushSubscription.findMany({ where: { studentId, active: true } });
    webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
    const payload = JSON.stringify({ ...resolvedMessage, event: "achievement" });
    await Promise.all(subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          payload,
          { TTL: 86400, urgency: "normal" },
        );
        delivered = true;
        await prisma.studentPushSubscription.update({ where: { id: subscription.id }, data: { lastUsedAt: new Date() } });
      } catch (error) {
        const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.studentPushSubscription.update({ where: { id: subscription.id }, data: { active: false } });
        }
        errors.push(statusCode ? `Web Push ${statusCode}` : "Error Web Push");
      }
    }));
  } else {
    errors.push("Web Push no configurado");
  }
  await prisma.achievementNotification.updateMany({
    where: { id: { in: claimed.map((item) => item.notificationId) } },
    data: delivered
      ? { status: "SENT", notifiedAt: new Date(), error: null }
      : { status: "FAILED", error: (errors.join("; ") || "Sin dispositivos suscriptos").slice(0, 500) },
  });
}

export async function notifyNewAchievements(studentId: string): Promise<ClaimedAchievement[]> {
  try {
    const achievements = await loadNotifiableAchievements(studentId, { includeAll: true });
    const claimed: ClaimedAchievement[] = [];
    for (const achievement of achievements) {
      try {
        const notification = await prisma.achievementNotification.create({
          data: { studentId, achievementKey: achievement.id, unlockedAt: unlockedAt(achievement.unlockedAt), status: "PENDING" },
        });
        claimed.push({ notificationId: notification.id, achievement });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
      }
    }
    if (claimed.length) after(() => deliverAchievementPush(studentId, claimed));
    return claimed;
  } catch (error) {
    console.error("No se pudo procesar la notificación de logro", error);
    return [];
  }
}

export type AchievementCelebrationPayload = {
  notificationId: string;
  id: string;
  icon: string;
  name: string;
  description: string;
  exercise: string | null;
  previousValue: string | null;
  newValue: string | null;
  unlockedAt: string;
  points: number;
};

export async function achievementCelebrationPayload(
  studentId: string,
  claimed: ClaimedAchievement[],
): Promise<AchievementCelebrationPayload[]> {
  if (!claimed.length) return [];
  const pointEvents = await prisma.studentPointTransaction.findMany({
    where: {
      studentId,
      active: true,
      eventKey: {
        in: claimed.flatMap(({ achievement }) => [
          `achievement:${achievement.id}`,
          `personal-record:${achievement.id}`,
        ]),
      },
    },
    select: { eventKey: true, points: true },
  });
  const pointsByAchievement = new Map<string, number>();
  for (const event of pointEvents) {
    const id = event.eventKey.replace(/^(achievement|personal-record):/, "");
    pointsByAchievement.set(id, (pointsByAchievement.get(id) ?? 0) + event.points);
  }
  return claimed.map(({ notificationId, achievement }) => ({
    notificationId,
    id: achievement.id,
    icon: achievement.icon,
    name: achievement.name,
    description: achievement.description,
    exercise: achievement.exercise ?? null,
    previousValue: achievement.previousValue ?? null,
    newValue: achievement.newValue ?? null,
    unlockedAt: achievement.unlockedAt,
    points: pointsByAchievement.get(achievement.id) ?? 0,
  }));
}
