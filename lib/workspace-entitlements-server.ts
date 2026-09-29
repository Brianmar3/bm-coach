import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  effectiveTrainerPlan,
  type TrainerSubscriptionPlanValue,
} from "@/lib/trainer-subscription";

type DatabaseClient = Prisma.TransactionClient | typeof prisma;

export async function loadWorkspaceTrainerPlan(
  workspaceId: string,
  client: DatabaseClient = prisma,
): Promise<TrainerSubscriptionPlanValue> {
  if (!workspaceId.trim()) throw new Error("Workspace requerido.");
  const owner = await client.workspaceMembership.findFirst({
    where: {
      workspaceId,
      role: "OWNER",
      status: "ACTIVE",
      user: { status: "ACTIVE" },
    },
    orderBy: { createdAt: "asc" },
    select: {
      user: {
        select: {
          platformRole: true,
          trainerSubscription: {
            select: { plan: true, trialEndsAt: true },
          },
        },
      },
    },
  });
  if (owner?.user.platformRole === "PLATFORM_OWNER") return "PREMIUM";
  return owner?.user.trainerSubscription
    ? effectiveTrainerPlan(owner.user.trainerSubscription)
    : "STARTER";
}
