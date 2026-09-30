import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getPortalSession, validRequestOrigin } from "@/lib/portal-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUEST_BODY = "Solicitud administrativa: eliminación de cuenta y datos asociados.";

function requestId(studentId: string) {
  return `account-deletion-${createHash("sha256").update(studentId).digest("hex").slice(0, 32)}`;
}

async function authenticatedStudent() {
  const session = await getPortalSession({ allowSelfService: true });
  if (!session) return null;
  const workspaceId = session.credential.student.workspaceId;
  if (!workspaceId) return null;
  const student = await prisma.studentRecord.findFirst({
    where: { id: session.studentId, workspaceId },
    select: { id: true, workspaceId: true },
  });
  return student ? { session, studentId: student.id, workspaceId: student.workspaceId } : null;
}

export async function GET() {
  try {
    const identity = await authenticatedStudent();
    if (!identity) return Response.json({ error: "Sesión no válida." }, { status: 401 });
    const pending = await prisma.followUpComment.findFirst({
      where: {
        id: requestId(identity.studentId),
        studentId: identity.studentId,
        student: { workspaceId: identity.workspaceId },
        author: "STUDENT",
        context: "GENERAL",
        category: "QUESTION",
        status: "PENDING",
      },
      select: { id: true, updatedAt: true },
    });
    return Response.json({ requested: Boolean(pending), requestedAt: pending?.updatedAt.toISOString() ?? null });
  } catch (error) {
    console.error("Error al consultar la solicitud de eliminación", error);
    return Response.json({ error: "No se pudo consultar la solicitud." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
    const identity = await authenticatedStudent();
    if (!identity) return Response.json({ error: "Sesión no válida." }, { status: 401 });
    if (identity.session.credential.mustChangePassword) return Response.json({ error: "Debés cambiar tu contraseña temporal." }, { status: 403 });

    const deletionRequest = await prisma.followUpComment.upsert({
      where: { id: requestId(identity.studentId) },
      create: {
        id: requestId(identity.studentId),
        studentId: identity.studentId,
        author: "STUDENT",
        context: "GENERAL",
        category: "QUESTION",
        status: "PENDING",
        body: REQUEST_BODY,
        private: false,
      },
      update: {
        status: "PENDING",
        body: REQUEST_BODY,
        private: false,
      },
      select: { id: true, updatedAt: true },
    });

    return Response.json({ requested: true, requestedAt: deletionRequest.updatedAt.toISOString() }, { status: 201 });
  } catch (error) {
    console.error("Error al solicitar la eliminación de cuenta", error);
    return Response.json({ error: "No se pudo registrar la solicitud." }, { status: 500 });
  }
}
