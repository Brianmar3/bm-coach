import { prisma } from "@/lib/prisma";
import { requireAdminApiResponse } from "@/lib/admin-api-auth";
import { requireTrainerWorkspace } from "@/lib/trainer-workspace";
import { isAccountDeletionRequest } from "@/lib/account-deletion-request";
import { validRequestOrigin } from "@/lib/portal-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestWhere = (workspaceId: string) => ({
  id: { startsWith: "account-deletion-" },
  author: "STUDENT" as const,
  context: "GENERAL" as const,
  category: "QUESTION" as const,
  student: { workspaceId },
});

export async function GET() {
  const unauthorized = await requireAdminApiResponse();
  if (unauthorized) return unauthorized;
  const { workspaceId } = await requireTrainerWorkspace();
  const records = await prisma.followUpComment.findMany({
    where: { ...requestWhere(workspaceId), status: "PENDING" },
    select: { id: true, studentId: true, body: true, status: true, updatedAt: true, student: { select: { data: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const requests = records.filter(isAccountDeletionRequest).map((record) => {
    const data = record.student.data && typeof record.student.data === "object" && !Array.isArray(record.student.data) ? record.student.data as Record<string, unknown> : {};
    return {
      id: record.id,
      studentId: record.studentId,
      studentName: [data.firstName, data.lastName].filter((part): part is string => typeof part === "string" && Boolean(part.trim())).join(" ") || "Alumno",
      requestedAt: record.updatedAt.toISOString(),
      status: record.status,
      body: record.body,
    };
  });
  return Response.json({ requests });
}

export async function PATCH(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const unauthorized = await requireAdminApiResponse();
  if (unauthorized) return unauthorized;
  const { workspaceId } = await requireTrainerWorkspace();
  const payload = await request.json().catch(() => null) as { requestId?: unknown } | null;
  const id = typeof payload?.requestId === "string" ? payload.requestId : "";
  if (!/^account-deletion-[a-f0-9]{32}$/.test(id)) return Response.json({ error: "Solicitud inválida." }, { status: 400 });
  const record = await prisma.followUpComment.findFirst({
    where: { ...requestWhere(workspaceId), id, status: "PENDING" },
    select: { id: true, studentId: true },
  });
  if (!record || !isAccountDeletionRequest(record)) return Response.json({ error: "Solicitud no encontrada." }, { status: 404 });
  const result = await prisma.$transaction(async (transaction) => {
    const changed = await transaction.followUpComment.updateMany({
      where: { ...requestWhere(workspaceId), id, studentId: record.studentId, status: "PENDING" },
      data: { status: "REVIEWED" },
    });
    if (changed.count !== 1) return false;
    await transaction.followUpComment.create({
      data: {
        studentId: record.studentId,
        parentId: id,
        author: "COACH",
        context: "GENERAL",
        category: "QUESTION",
        status: "REVIEWED",
        private: true,
        body: "Solicitud de eliminación marcada como gestionada por el entrenador. La cuenta y sus datos no fueron eliminados automáticamente.",
      },
    });
    return true;
  });
  if (!result) return Response.json({ error: "La solicitud ya no está pendiente." }, { status: 409 });
  return Response.json({ status: "REVIEWED", accountDeleted: false });
}
