import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { coachedStudentsWhere } from "@/lib/coached-students";
import { countActiveManagedStudents, trainerStudentCapacity, trainerStudentLimitMessage } from "@/lib/trainer-plan-limits";
import { loadWorkspaceTrainerPlan } from "@/lib/workspace-entitlements-server";

type DatabaseClient = Prisma.TransactionClient | typeof prisma;

export class TrainerStudentLimitError extends Error {
  readonly status = 409;
  constructor(readonly limit: number) { super(trainerStudentLimitMessage(limit)); }
}

export async function loadTrainerStudentCapacity(workspaceId: string, client: DatabaseClient = prisma) {
  const [plan, students] = await Promise.all([
    loadWorkspaceTrainerPlan(workspaceId, client),
    client.studentRecord.findMany({ where: { workspaceId, AND: [coachedStudentsWhere] }, select: { data: true } }),
  ]);
  return trainerStudentCapacity(plan, countActiveManagedStudents(students));
}

export async function assertTrainerCanAddStudent(workspaceId: string, client: DatabaseClient = prisma) {
  const capacity = await loadTrainerStudentCapacity(workspaceId, client);
  if (capacity.limit !== null && capacity.used >= capacity.limit) throw new TrainerStudentLimitError(capacity.limit);
  return capacity;
}

export async function assertTrainerCanReplaceStudents(workspaceId: string, nextRecords: Array<{ data: unknown }>, client: DatabaseClient = prisma) {
  const capacity = await loadTrainerStudentCapacity(workspaceId, client);
  const nextUsed = countActiveManagedStudents(nextRecords);
  if (capacity.limit !== null && nextUsed > capacity.used && nextUsed > capacity.limit) throw new TrainerStudentLimitError(capacity.limit);
  return { ...capacity, nextUsed };
}
