import "server-only";

import { prisma } from "@/lib/prisma";
import { getWorkspaceBranding, normalizeWorkspaceName, PLATFORM_FALLBACK_NAME } from "@/lib/workspace-branding";
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
  const [workspace, plan] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        name: true,
        settings: { orderBy: { updatedAt: "desc" }, take: 1, select: { data: true } },
        memberships: {
          where: { role: "OWNER", status: "ACTIVE" },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { user: { select: { name: true, brandName: true } } },
        },
      },
    }),
    loadWorkspaceBrandingPlan(workspaceId),
  ]);
  const data = workspace?.settings[0]?.data as { accentColor?: unknown; logoMode?: unknown; customLogoUrl?: unknown; systemName?: unknown } | null;
  const owner = workspace?.memberships[0]?.user;
  const configuredName = normalizeWorkspaceName(data?.systemName);
  const customBusinessName = configuredName?.toLocaleLowerCase("es") === PLATFORM_FALLBACK_NAME.toLocaleLowerCase("es")
    ? null
    : configuredName;
  return getWorkspaceBranding({
    ...data,
    businessName: customBusinessName ?? owner?.brandName,
    systemName: undefined,
    workspaceName: workspace?.name,
    trainerDisplayName: owner?.name,
  }, plan);
}

export async function loadStudentWorkspaceBranding(studentId: string) {
  const student = await prisma.studentRecord.findUnique({
    where: { id: studentId },
    select: { workspaceId: true },
  });
  return student?.workspaceId
    ? loadWorkspaceBranding(student.workspaceId)
    : getWorkspaceBranding(null, "STARTER");
}

export async function workspaceNotificationTitle(workspaceId: string, requestedTitle: string) {
  const branding = await loadWorkspaceBranding(workspaceId);
  return branding.isPremium ? branding.displayName : requestedTitle;
}

export async function studentNotificationTitle(studentId: string, requestedTitle: string) {
  const branding = await loadStudentWorkspaceBranding(studentId);
  return branding.isPremium ? branding.displayName : requestedTitle;
}

export async function loadWorkspaceAccentColor(workspaceId: string) {
  return (await loadWorkspaceBranding(workspaceId)).accentColor;
}
