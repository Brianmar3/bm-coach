import type { CelebrationAchievement } from "@/lib/portal-celebrations";
import { prisma } from "@/lib/prisma";
import { loadNotifiableAchievements } from "@/lib/notifiable-achievements";
import { getPortalSession, validRequestOrigin } from "@/lib/portal-auth";
import { weeklyCelebrationKey } from "@/lib/portal-celebrations";
import { loadCurrentWeeklyMission } from "@/lib/weekly-mission-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getPortalSession();
  if (!session) return Response.json({ error: "Sesión vencida." }, { status: 401 });

  const pending = await prisma.achievementNotification.findMany({
    where: {
      studentId: session.studentId,
      celebratedAt: null,
      status: { not: "BASELINE" },
    },
    orderBy: [{ unlockedAt: "asc" }, { createdAt: "asc" }],
    take: 20,
    select: { id: true, achievementKey: true },
  });
  if (!pending.length) return Response.json({ achievement: null });

  const achievements = await loadNotifiableAchievements(session.studentId, { includeAll: true });
  const byKey = new Map(achievements.map((item) => [item.id, item]));
  const match = pending.find((item) => byKey.has(item.achievementKey));
  const invalidIds = pending.filter((item) => !byKey.has(item.achievementKey)).map((item) => item.id);
  if (invalidIds.length) {
    await prisma.achievementNotification.updateMany({
      where: { id: { in: invalidIds }, studentId: session.studentId },
      data: { celebratedAt: new Date() },
    });
  }
  if (!match) return Response.json({ achievement: null });

  const achievement = await rewardPayload(session.studentId, match.id, byKey.get(match.achievementKey)!);
  return Response.json({ achievement });
}

async function rewardPayload(
  studentId: string,
  notificationId: string,
  achievement: Awaited<ReturnType<typeof loadNotifiableAchievements>>[number],
): Promise<CelebrationAchievement> {
  const pointEvents = await prisma.studentPointTransaction.findMany({
    where: {
      studentId,
      active: true,
      eventKey: { in: [`achievement:${achievement.id}`, `personal-record:${achievement.id}`] },
    },
    select: { points: true },
  });
  return {
    notificationId, id: achievement.id, icon: achievement.icon, name: achievement.name,
    description: achievement.description, exercise: achievement.exercise ?? null,
    previousValue: achievement.previousValue ?? null, newValue: achievement.newValue ?? null,
    unlockedAt: achievement.unlockedAt,
    points: pointEvents.reduce((sum, item) => sum + item.points, 0),
  };
}

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const session = await getPortalSession();
  if (!session) return Response.json({ error: "Sesión vencida." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { notificationId?: unknown; kind?: unknown; key?: unknown } | null;
  const studentId = session.studentId;
  if (body?.kind === "weekly") {
    const mission = await loadCurrentWeeklyMission(studentId);
    const key = weeklyCelebrationKey(mission);
    if (!key || body.key !== key || !mission?.pointsAwardedAt) return Response.json({ celebration: null });
    // The existing unique receipt arbitrates simultaneous claims without touching point events.
    const receipt = await prisma.achievementNotification.createMany({
      data: { studentId, achievementKey: key, unlockedAt: new Date(mission.pointsAwardedAt), celebratedAt: new Date(), status: "BASELINE" },
      skipDuplicates: true,
    });
    return Response.json({ celebration: receipt.count ? { kind: "weekly", key, mission } : null });
  }

  const notificationId = typeof body?.notificationId === "string" ? body.notificationId.trim() : "";
  if (!notificationId) return Response.json({ error: "Falta el logro." }, { status: 400 });
  const where = { id: notificationId, studentId, celebratedAt: null, status: { not: "BASELINE" as const } };
  const pending = await prisma.achievementNotification.findFirst({ where, select: { achievementKey: true } });
  if (!pending) return Response.json({ celebration: null });
  const achievements = await loadNotifiableAchievements(studentId, { includeAll: true });
  const achievement = achievements.find(item => item.id === pending.achievementKey);
  if (!achievement) return Response.json({ celebration: null });
  const payload = await rewardPayload(studentId, notificationId, achievement);
  const receipt = await prisma.achievementNotification.updateMany({ where, data: { celebratedAt: new Date() } });
  return Response.json({ celebration: receipt.count ? { kind: "achievement", key: notificationId, achievement: payload } : null });
}

export async function PATCH(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const session = await getPortalSession();
  if (!session) return Response.json({ error: "Sesión vencida." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { notificationId?: unknown; kind?: unknown; key?: unknown } | null;
  if (body?.kind === "weekly") {
    const mission = await loadCurrentWeeklyMission(session.studentId);
    const key = weeklyCelebrationKey(mission);
    if (!key || body.key !== key || !mission?.pointsAwardedAt) {
      return Response.json({ error: "El objetivo cambió. Actualizamos tu progreso." }, { status: 409 });
    }
    // Receipt only: BASELINE keeps this visual acknowledgement out of push and
    // achievement delivery queues. No points or mission fields are written.
    await prisma.achievementNotification.upsert({
      where: { studentId_achievementKey: { studentId: session.studentId, achievementKey: key } },
      create: { studentId: session.studentId, achievementKey: key, unlockedAt: new Date(mission.pointsAwardedAt), celebratedAt: new Date(), status: "BASELINE" },
      update: {},
    });
    return Response.json({ ok: true });
  }
  const notificationId = typeof body?.notificationId === "string" ? body.notificationId.trim() : "";
  if (!notificationId) return Response.json({ error: "Falta el logro." }, { status: 400 });

  const result = await prisma.achievementNotification.updateMany({
    where: { id: notificationId, studentId: session.studentId, celebratedAt: null },
    data: { celebratedAt: new Date() },
  });
  if (!result.count) {
    const existing = await prisma.achievementNotification.findFirst({
      where: { id: notificationId, studentId: session.studentId, celebratedAt: { not: null } },
      select: { id: true },
    });
    if (!existing) return Response.json({ error: "El logro no existe." }, { status: 404 });
  }
  return Response.json({ ok: true });
}
