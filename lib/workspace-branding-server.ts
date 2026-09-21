import "server-only";

import { prisma } from "@/lib/prisma";
import { workspaceAccentColor } from "@/lib/workspace-branding";

export async function loadWorkspaceAccentColor(workspaceId: string) {
  const settings = await prisma.coachSettingsRecord.findFirst({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    select: { data: true },
  });
  const data = settings?.data as { accentColor?: unknown } | null;
  return workspaceAccentColor(data?.accentColor);
}
