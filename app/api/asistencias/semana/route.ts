import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, adminAuthError, verifyAdminSessionValue } from "@/lib/admin-auth";
import { loadWeeklyAttendance } from "@/lib/weekly-attendance-data";
import { argentinaDateKey, isDateKey } from "@/lib/weekly-attendance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorize() {
  const session = verifyAdminSessionValue((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if (session.ok) return null;
  const failure = adminAuthError(session);
  return Response.json({ error: failure.error }, { status: failure.status });
}

export async function GET(request: Request) {
  const unauthorized = await authorize();
  if (unauthorized) return unauthorized;

  try {
    const url = new URL(request.url);
    if (url.searchParams.has("studentId") || url.searchParams.has("trainerId") || url.searchParams.has("organizationId")) {
      return Response.json({ error: "Los permisos se resuelven desde la sesión administrativa." }, { status: 400 });
    }
    const reference = url.searchParams.get("week") ?? argentinaDateKey();
    if (!isDateKey(reference)) return Response.json({ error: "La semana seleccionada no es válida." }, { status: 400 });
    return Response.json(await loadWeeklyAttendance(reference));
  } catch (error) {
    console.error("No se pudo construir el historial semanal de asistencias", error);
    if (error instanceof Error && error.message === "INVALID_WEEK") {
      return Response.json({ error: "La semana seleccionada no es válida." }, { status: 400 });
    }
    return Response.json({ error: "No se pudo cargar el historial semanal de asistencias." }, { status: 500 });
  }
}
