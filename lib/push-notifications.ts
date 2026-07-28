import "server-only";

import webpush from "web-push";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadNotifiableAchievements } from "@/lib/notifiable-achievements";
import type { PortalAchievement } from "@/lib/portal-achievements";

function vapidConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

function unlockedAt(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00.000Z`);
}

export async function establishAchievementBaseline(studentId: string) {
  const achievements = await loadNotifiableAchievements(studentId);
  await prisma.achievementNotification.createMany({
    data: achievements.map((item) => ({ studentId, achievementKey: item.id, unlockedAt: unlockedAt(item.unlockedAt), status: "BASELINE" })),
    skipDuplicates: true,
  });
}

function content(items: PortalAchievement[]) {
  if (items.length > 1) return { title: `Desbloqueaste ${items.length} logros`, body: "Entrá a BM Training para verlos." };
  const item = items[0];
  if (item.exercise) return { title: "Nuevo récord personal", body: `Mejoraste tu marca en ${item.exercise}.` };
  if (item.category === "EVALUACIONES") return { title: "Nuevo logro en BM Training", body: "Entrá a la app para ver tu progreso." };
  return { title: "Nuevo logro desbloqueado", body: item.description };
}

export async function notifyNewAchievements(studentId: string) {
  try {
    if (!vapidConfigured()) return;
    const subscriptions = await prisma.studentPushSubscription.findMany({ where: { studentId, active: true } });
    if (!subscriptions.length) return;
    const achievements = await loadNotifiableAchievements(studentId);
    const claimed: Array<{ notificationId: string; achievement: PortalAchievement }> = [];
    for (const achievement of achievements) {
      try {
        const notification = await prisma.achievementNotification.create({ data: { studentId, achievementKey: achievement.id, unlockedAt: unlockedAt(achievement.unlockedAt), status: "PENDING" } });
        claimed.push({ notificationId: notification.id, achievement });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
      }
    }
    if (!claimed.length) return;
    webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
    const message = content(claimed.map((item) => item.achievement));
    const payload = JSON.stringify({ ...message, url: "/portal#logros", tag: "bm-training-achievements" });
    let delivered = false;
    const errors: string[] = [];
    await Promise.all(subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload, { TTL: 86400, urgency: "normal" });
        delivered = true;
        await prisma.studentPushSubscription.update({ where: { id: subscription.id }, data: { lastUsedAt: new Date() } });
      } catch (error) {
        const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
        if (statusCode === 404 || statusCode === 410) await prisma.studentPushSubscription.update({ where: { id: subscription.id }, data: { active: false } });
        errors.push(statusCode ? `Push ${statusCode}` : "Error de entrega");
      }
    }));
    await prisma.achievementNotification.updateMany({
      where: { id: { in: claimed.map((item) => item.notificationId) } },
      data: delivered ? { status: "SENT", notifiedAt: new Date(), error: null } : { status: "FAILED", error: errors.join("; ").slice(0, 500) },
    });
  } catch (error) {
    console.error("No se pudo procesar la notificación de logro", error);
  }
}
