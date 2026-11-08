import type { Prisma } from "@prisma/client";

// Master writers must take the trainer lock before reading or writing its subscription.
// NO KEY UPDATE is compatible with foreign-key checks against the trainer ID.
export async function lockMasterTrainer(tx: Prisma.TransactionClient, trainerId: string) {
  await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${trainerId} FOR NO KEY UPDATE`;
}
