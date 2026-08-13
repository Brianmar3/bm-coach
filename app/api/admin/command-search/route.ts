import { requireAdminApiResponse } from "@/lib/admin-api-auth";
import { normalizeCommandQuery } from "@/lib/trainer-commands";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireAdminApiResponse();
  if (unauthorized) return unauthorized;
  const query = normalizeCommandQuery(new URL(request.url).searchParams.get("q") ?? "");
  if (query.length < 2) return Response.json([]);

  const records = await prisma.studentRecord.findMany({
    select: { id: true, serviceType: true, data: true },
    orderBy: { updatedAt: "desc" },
  });
  const results = records.flatMap((record) => {
    const data = record.data && typeof record.data === "object" && !Array.isArray(record.data) ? record.data as Record<string, unknown> : {};
    const firstName = typeof data.firstName === "string" ? data.firstName : "";
    const lastName = typeof data.lastName === "string" ? data.lastName : "";
    const phone = typeof data.phone === "string" ? data.phone : "";
    if (!normalizeCommandQuery(`${firstName} ${lastName} ${phone}`).includes(query)) return [];
    const lifecycleStatus = data.lifecycleStatus === "suspendido" ? "suspendido" : data.status === "inactivo" ? "inactivo" : "activo";
    return [{ id: record.id, name: `${firstName} ${lastName}`.trim(), serviceType: record.serviceType, status: lifecycleStatus, plan: typeof data.plan === "string" ? data.plan : "", frequency: typeof data.flexibleSchedule === "string" ? data.flexibleSchedule : "" }];
  }).slice(0, 8);
  return Response.json(results);
}
