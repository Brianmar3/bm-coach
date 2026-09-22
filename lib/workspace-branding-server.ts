import "server-only";

import { prisma } from "@/lib/prisma";
import { resolveWorkspaceBranding } from "@/lib/workspace-branding";
import { effectiveTrainerPlan, type TrainerSubscriptionPlanValue } from "@/lib/trainer-subscription";

export async function loadWorkspaceBrandingPlan(workspaceId: string): Promise<TrainerSubscriptionPlanValue> {
  const owner = await prisma.workspaceMembership.findFirst({
    where: { workspaceId, role: "OWNER", status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: { user: { select: { trainerSubscription: { select: { plan: true, trialEndsAt: true } } } } },
  });
  return owner?.user.trainerSubscription ? effectiveTrainerPlan(owner.user.trainerSubscription) : "STARTER";
}

export async function loadWorkspaceBranding(workspaceId: string) {
  const [settings, plan] = await Promise.all([
    prisma.coachSettingsRecord.findFirst({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      select: { data: true },
    }),
    loadWorkspaceBrandingPlan(workspaceId),
  ]);
  const data = settings?.data as { accentColor?: unknown; logoMode?: unknown; customLogoUrl?: unknown } | null;
  return resolveWorkspaceBranding(data, plan);
}

export async function loadWorkspaceAccentColor(workspaceId: string) {
  return (await loadWorkspaceBranding(workspaceId)).accentColor;
}
