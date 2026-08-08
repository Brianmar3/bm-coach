import { argentinaDateKey } from "@/lib/payment-dates";
import { loadPortalAttendance } from "@/lib/portal-attendance-data";
import { isPortalAttendancePeriod } from "@/lib/portal-attendance";
import { getPortalSession } from "@/lib/portal-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getPortalSession();
  if (!session) return Response.json({ error: "Sesión no válida." }, { status: 401 });
  if (session.credential.mustChangePassword) {
    return Response.json({ error: "Debés cambiar tu contraseña temporal.", code: "PASSWORD_CHANGE_REQUIRED" }, { status: 403 });
  }
  const requestedPeriod = new URL(request.url).searchParams.get("period");
  if (requestedPeriod && !isPortalAttendancePeriod(requestedPeriod)) {
    return Response.json({ error: "Período no válido." }, { status: 400 });
  }
  const period = isPortalAttendancePeriod(requestedPeriod) ? requestedPeriod : "current-month";
  const result = await loadPortalAttendance(session.studentId, period, argentinaDateKey());
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
