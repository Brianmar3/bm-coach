import "server-only";
import { prisma } from "@/lib/prisma";
import { weeklyCelebrationKey, type CelebratableWeeklyMission } from "@/lib/portal-celebrations";

export async function withWeeklyCelebrationState(studentId: string, mission: CelebratableWeeklyMission | null) {
  const key = weeklyCelebrationKey(mission);
  if (!mission || !key) return mission;
  const receipt = await prisma.achievementNotification.findUnique({
    where: { studentId_achievementKey: { studentId, achievementKey: key } },
    select: { celebratedAt: true },
  });
  return { ...mission, celebrationConfirmed: Boolean(receipt?.celebratedAt) };
}
