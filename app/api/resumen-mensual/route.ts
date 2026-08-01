import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, adminAuthError, verifyAdminSessionValue } from "@/lib/admin-auth";
import { monthlyGeneralCsv, monthlySummaryCsv } from "@/lib/monthly-csv";
import { validMonthSelection } from "@/lib/monthly-period";
import { buildMonthlySummary, closeMonthlySummary, saveMonthlyDraft } from "@/lib/monthly-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorize() {
  const value = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  const session = verifyAdminSessionValue(value);
  if (session.ok) return null;
  const failure = adminAuthError(session);
  return Response.json({ error: failure.error }, { status: failure.status });
}

function selectionFromUrl(request: Request) {
  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year"));
  const month = Number(url.searchParams.get("month"));
  return validMonthSelection(year, month) ? { year, month } : null;
}

export async function GET(request: Request) {
  const unauthorized = await authorize();
  if (unauthorized) return unauthorized;
  const selection = selectionFromUrl(request);
  if (!selection) return Response.json({ error: "Seleccioná un mes y año válidos." }, { status: 400 });
  try {
    const data = await buildMonthlySummary(selection);
    const format = new URL(request.url).searchParams.get("format");
    if (format === "detail-csv" || format === "general-csv") {
      const csv = format === "detail-csv" ? monthlySummaryCsv(data) : monthlyGeneralCsv(data);
      const suffix = format === "detail-csv" ? "detalle" : "general";
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="resumen-${data.metadata.monthKey}-${suffix}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Error al consultar resumen mensual", error);
    return Response.json({ error: "No se pudo cargar el resumen mensual." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const unauthorized = await authorize();
  if (unauthorized) return unauthorized;
  try {
    const input = await request.json() as { year?: unknown; month?: unknown; action?: unknown };
    const year = Number(input.year);
    const month = Number(input.month);
    if (!validMonthSelection(year, month)) return Response.json({ error: "Seleccioná un mes y año válidos." }, { status: 400 });
    if (!(input.action === "generate" || input.action === "refresh" || input.action === "close")) {
      return Response.json({ error: "La acción solicitada no es válida." }, { status: 400 });
    }
    const selection = { year, month };
    const data = input.action === "close"
      ? await closeMonthlySummary(selection, "coach")
      : await saveMonthlyDraft(selection);
    return Response.json(data);
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ error: "La solicitud no es válida." }, { status: 400 });
    if (error instanceof Error && error.message === "MONTH_CLOSED") {
      return Response.json({ error: "El mes está cerrado y no puede actualizarse silenciosamente." }, { status: 409 });
    }
    console.error("Error al actualizar resumen mensual", error);
    return Response.json({ error: "No se pudo actualizar el resumen mensual." }, { status: 500 });
  }
}
