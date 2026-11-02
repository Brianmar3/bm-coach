import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, adminAuthError, verifyAdminSessionValue } from "@/lib/admin-auth";
import { requireTrainerWorkspace } from "@/lib/trainer-workspace";
import { prisma } from "@/lib/prisma";
import { parseAttendanceReport } from "@/lib/attendance-report";
import { loadAttendanceReport } from "@/lib/attendance-report-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = verifyAdminSessionValue((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if (!auth.ok) { const failure = adminAuthError(auth); return Response.json({ error: failure.error }, { status: failure.status }); }
  let filter;
  try { filter = parseAttendanceReport(new URL(request.url).searchParams); }
  catch (error) { return Response.json({ error: (error as Error).message }, { status: 400 }); }
  try {
    const { workspaceId } = await requireTrainerWorkspace();
    return Response.json(await loadAttendanceReport(prisma, workspaceId, filter), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("No se pudo consultar el historial general de asistencias", error);
    return Response.json({ error: "No se pudo cargar el informe de asistencias." }, { status: 500 });
  }
}
