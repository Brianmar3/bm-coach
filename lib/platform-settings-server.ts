import "server-only";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PLATFORM_SETTINGS, PLATFORM_SETTINGS_ID } from "@/lib/platform-settings";

export async function loadPlatformSettings() {
  return await prisma.platformSettings.findUnique({ where: { id: PLATFORM_SETTINGS_ID } }) ?? { id: PLATFORM_SETTINGS_ID, ...DEFAULT_PLATFORM_SETTINGS };
}
