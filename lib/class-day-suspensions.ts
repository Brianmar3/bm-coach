import "server-only";

import type { Prisma } from "@prisma/client";
import { argentinaDateKey, dateKeyToDatabase, isDateKey } from "@/lib/payment-dates";

export function futureClassDate(value: unknown): value is string {
  return typeof value === "string" && isDateKey(value) && value >= argentinaDateKey();
}

export async function lockClassDay(tx: Prisma.TransactionClient, workspaceId: string, dateKey: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${workspaceId}), hashtext(${dateKey}))`;
}

export async function classDayIsSuspended(tx: Prisma.TransactionClient, workspaceId: string, dateKey: string) {
  return Boolean(await tx.classDaySuspension.findUnique({
    where: { workspaceId_date: { workspaceId, date: dateKeyToDatabase(dateKey) } },
    select: { date: true },
  }));
}
