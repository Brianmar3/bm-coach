import { Prisma } from "@prisma/client";
import { futureClassDate, lockClassDay } from "@/lib/class-day-suspensions";
import { databaseDateKey, dateKeyToDatabase, isDateKey } from "@/lib/payment-dates";
import { validRequestOrigin } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { requireTrainerWorkspace } from "@/lib/trainer-workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { workspaceId } = await requireTrainerWorkspace();
    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!from || !to || !isDateKey(from) || !isDateKey(to) || to < from || (dateKeyToDatabase(to).getTime() - dateKeyToDatabase(from).getTime()) > 31 * 86400000) {
      return Response.json({ error: "Rango de fechas inválido." }, { status: 400 });
    }
    const rows = await prisma.classDaySuspension.findMany({ where: { workspaceId, date: { gte: dateKeyToDatabase(from), lte: dateKeyToDatabase(to) } }, select: { date: true } });
    return Response.json(rows.map((row) => databaseDateKey(row.date)), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "No se pudieron cargar las suspensiones." }, { status: 500 });
  }
}

async function change(request: Request, suspended: boolean) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  try {
    const { workspaceId } = await requireTrainerWorkspace();
    const { date } = await request.json() as { date?: unknown };
    if (!futureClassDate(date)) return Response.json({ error: "Seleccioná una fecha actual o futura válida." }, { status: 400 });
    await prisma.$transaction(async (tx) => {
      await lockClassDay(tx, workspaceId, date);
      if (suspended) {
        await tx.classDaySuspension.upsert({ where: { workspaceId_date: { workspaceId, date: dateKeyToDatabase(date) } }, create: { workspaceId, date: dateKeyToDatabase(date) }, update: {} });
      } else {
        await tx.classDaySuspension.deleteMany({ where: { workspaceId, date: dateKeyToDatabase(date) } });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return Response.json({ date, suspended });
  } catch {
    return Response.json({ error: "No se pudo actualizar el día. Intentá nuevamente." }, { status: 500 });
  }
}

export async function POST(request: Request) { return change(request, true); }
export async function DELETE(request: Request) { return change(request, false); }
