import { platformOwnerApiAccess } from "@/lib/platform-auth";
import { DEFAULT_PLATFORM_SETTINGS, parsePlatformSettings, PLATFORM_SETTINGS_ID } from "@/lib/platform-settings";
import { prisma } from "@/lib/prisma";
import { validRequestOrigin } from "@/lib/portal-auth";

export async function GET() {
  const access = await platformOwnerApiAccess();
  if (!access.ok) return access.response;
  const settings = await prisma.platformSettings.findUnique({ where: { id: PLATFORM_SETTINGS_ID } });
  return Response.json(settings ?? { id: PLATFORM_SETTINGS_ID, ...DEFAULT_PLATFORM_SETTINGS });
}

export async function PUT(request: Request) {
  const access = await platformOwnerApiAccess();
  if (!access.ok) return access.response;
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen de solicitud inválido." }, { status: 403 });
  const raw = await request.text();
  if (raw.length > 4096) return Response.json({ error: "Solicitud demasiado grande." }, { status: 413 });
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return Response.json({ error: "Datos inválidos." }, { status: 400 }); }
  const settings = parsePlatformSettings(value);
  if (!settings) return Response.json({ error: "Revisá la configuración de plataforma." }, { status: 400 });
  const saved = await prisma.platformSettings.upsert({ where: { id: PLATFORM_SETTINGS_ID }, create: { id: PLATFORM_SETTINGS_ID, ...settings }, update: settings });
  return Response.json(saved);
}
