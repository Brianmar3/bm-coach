import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPortalSession, validRequestOrigin } from "@/lib/portal-auth";
import { accountDeletionRequestId, ACCOUNT_DELETION_BODY } from "@/lib/account-deletion-request";
import { sendTrainerNativePush } from "@/lib/native-push-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authenticatedStudent() {
  const session = await getPortalSession({ allowSelfService: true });
  if (!session) return null;
  const workspaceId = session.credential.student.workspaceId;
  if (!workspaceId) return null;
  const student = await prisma.studentRecord.findFirst({
    where: { id: session.studentId, workspaceId },
    select: { id: true, workspaceId: true, data: true },
  });
  return student ? { session, studentId: student.id, workspaceId: student.workspaceId, data: student.data } : null;
}

export async function GET() {
  try {
    const identity = await authenticatedStudent();
    if (!identity) return Response.json({ error: "Sesión no válida." }, { status: 401 });
    const pending = await prisma.followUpComment.findFirst({
      where: {
        id: accountDeletionRequestId(identity.studentId),
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

    const id = accountDeletionRequestId(identity.studentId);
    const where = { id, studentId: identity.studentId, student: { workspaceId: identity.workspaceId }, author: "STUDENT" as const, context: "GENERAL" as const, category: "QUESTION" as const };
    let created = false;
    let deletionRequest = await prisma.followUpComment.findFirst({ where, select: { id: true, status: true, updatedAt: true } });
    if (!deletionRequest) {
      try {
        deletionRequest = await prisma.followUpComment.create({
          data: { id, studentId: identity.studentId, author: "STUDENT", context: "GENERAL", category: "QUESTION", status: "PENDING", body: ACCOUNT_DELETION_BODY, private: false },
          select: { id: true, status: true, updatedAt: true },
        });
        created = true;
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
        deletionRequest = await prisma.followUpComment.findFirst({ where, select: { id: true, status: true, updatedAt: true } });
        if (!deletionRequest) return Response.json({ error: "La solicitud ya existe en otra cuenta." }, { status: 409 });
      }
    }
    if (deletionRequest.status === "REVIEWED") {
      const reopened = await prisma.followUpComment.updateMany({ where: { ...where, status: "REVIEWED" }, data: { status: "PENDING", body: ACCOUNT_DELETION_BODY, private: false } });
      created = reopened.count === 1;
      deletionRequest = await prisma.followUpComment.findFirst({ where, select: { id: true, status: true, updatedAt: true } });
    }
    if (!deletionRequest || deletionRequest.status !== "PENDING") return Response.json({ error: "No se pudo confirmar la solicitud." }, { status: 409 });

    if (created) {
      const data = identity.data && typeof identity.data === "object" && !Array.isArray(identity.data) ? identity.data as Record<string, unknown> : {};
      const name = [data.firstName, data.lastName].filter((part): part is string => typeof part === "string" && Boolean(part.trim())).join(" ") || "Un alumno";
      await sendTrainerNativePush(identity.workspaceId, {
        title: "Solicitud de eliminación",
        body: `${name} solicitó eliminar su cuenta y datos asociados.`,
        url: "/alumnos",
        tag: id,
      }).catch((error) => console.error("No se pudo avisar al entrenador de la solicitud de eliminación", error));
    }

    return Response.json({ requested: true, requestedAt: deletionRequest.updatedAt.toISOString() }, { status: created ? 201 : 200 });
  } catch (error) {
    console.error("Error al solicitar la eliminación de cuenta", error);
    return Response.json({ error: "No se pudo registrar la solicitud." }, { status: 500 });
  }
}
