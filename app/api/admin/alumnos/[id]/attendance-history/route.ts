import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, adminAuthError, verifyAdminSessionValue } from "@/lib/admin-auth";
import { requireTrainerWorkspace } from "@/lib/trainer-workspace";
import { prisma } from "@/lib/prisma";
import { argentinaDateKey } from "@/lib/payment-dates";
import { parseAttendanceHistoryFilter } from "@/lib/student-attendance-history";
import { loadStudentAttendanceHistory } from "@/lib/student-attendance-history-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = verifyAdminSessionValue((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if (!auth.ok) { const failure = adminAuthError(auth); return Response.json({ error: failure.error }, { status: failure.status }); }
  const today = argentinaDateKey();
  let filter;
  try { filter = parseAttendanceHistoryFilter(new URL(request.url).searchParams, today); }
  catch (error) { return Response.json({ error: (error as Error).message }, { status: 400 }); }
  try {
    const { workspaceId } = await requireTrainerWorkspace();
    const { id } = await context.params;
    const data = await loadStudentAttendanceHistory(prisma, workspaceId, id, filter, today);
    return data ? Response.json(data, { headers: { "Cache-Control": "private, no-store" } }) : Response.json({ error: "Alumno no encontrado." }, { status: 404 });
  } catch (error) {
    console.error("No se pudo cargar el historial individual de asistencias", error);
    return Response.json({ error: "No se pudo cargar el historial de asistencias." }, { status: 500 });
  }
}
