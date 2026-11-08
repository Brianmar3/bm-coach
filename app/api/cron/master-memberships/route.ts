import { prisma } from "@/lib/prisma";
import { authorizedMasterCron, masterEmailConfig } from "@/lib/master-email";
import { runMasterDigest } from "@/lib/master-email-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!authorizedMasterCron(request, process.env.CRON_SECRET)) return Response.json({ error: "No autorizado." }, { status: 401, headers });
  try {
    const config = masterEmailConfig(process.env);
    if (!config) return Response.json({ status: "DISABLED" }, { headers });
    const result = await runMasterDigest(prisma, config);
    const reviewCount = await prisma.masterEmailDigest.count({ where: { status: "REVIEW" } });
    if (reviewCount) console.error("master_memberships_email_review_required", { count: reviewCount });
    console.info("master_memberships_email", result);
    return Response.json({ ...result, reviewCount }, { headers, status: result.status === "REVIEW" ? 503 : 200 });
  } catch {
    // Provider codes are stored in the attempt ledger. Never log credentials or email contents.
    console.error("master_memberships_email_failed");
    return Response.json({ error: "No se pudo procesar el resumen del Master." }, { status: 503, headers });
  }
}
