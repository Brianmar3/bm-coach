import { requireAdminApiResponse } from "@/lib/admin-api-auth";
import { requireTrainerWorkspace } from "@/lib/trainer-workspace";
import { prisma } from "@/lib/prisma";
import { classOpinions, feedbackReportFilter } from "@/lib/class-communication-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const unauthorized = await requireAdminApiResponse(); if (unauthorized) return unauthorized;
  let filter;
  try { filter = feedbackReportFilter(new URL(request.url).searchParams); }
  catch (error) { return Response.json({ error: (error as Error).message }, { status: 400 }); }
  const { workspaceId } = await requireTrainerWorkspace();
  try { return Response.json(await classOpinions(prisma, workspaceId, filter), { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { console.error("No se pudieron consultar opiniones de clases", error); return Response.json({ error: "No se pudieron cargar las opiniones." }, { status: 500 }); }
}
