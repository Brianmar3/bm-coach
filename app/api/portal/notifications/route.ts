import { prisma } from "@/lib/prisma";
import { getPortalSession, validRequestOrigin } from "@/lib/portal-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getPortalSession();
  if (!session) {
    return Response.json({ error: "Sesión vencida." }, { status: 401 });
  }

  const [notifications, unreadCount] = await Promise.all([
    prisma.studentNotification.findMany({
      where: { studentId: session.studentId },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        url: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.studentNotification.count({
      where: {
        studentId: session.studentId,
        readAt: null,
      },
    }),
  ]);

  return Response.json({ notifications, unreadCount });
}

export async function PATCH(request: Request) {
  if (!validRequestOrigin(request)) {
    return Response.json({ error: "Origen no permitido." }, { status: 403 });
  }
  const session = await getPortalSession();
  if (!session) {
    return Response.json({ error: "Sesión vencida." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { id?: unknown; all?: unknown }
    | null;

  if (body?.all === true) {
    await prisma.studentNotification.updateMany({
      where: {
        studentId: session.studentId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return Response.json({ ok: true });
  }

  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id) {
    return Response.json(
      { error: "Falta la notificación." },
      { status: 400 },
    );
  }

  const result = await prisma.studentNotification.updateMany({
    where: {
      id,
      studentId: session.studentId,
    },
    data: { readAt: new Date() },
  });

  if (result.count === 0) {
    return Response.json(
      { error: "No se encontró la notificación." },
      { status: 404 },
    );
  }

  return Response.json({ ok: true });
}
