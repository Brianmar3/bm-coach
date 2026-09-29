import type { Prisma } from "@prisma/client";

export function followUpSessionWhere(
  workspaceId: string,
  filters: Pick<Prisma.WorkoutSessionWhereInput, "id" | "studentId" | "routineId" | "status"> = {},
): Prisma.WorkoutSessionWhereInput {
  if (!workspaceId.trim()) throw new Error("Workspace requerido.");
  return {
    ...filters,
    student: { workspaceId },
    routine: { workspaceId },
  };
}

export function followUpAssignmentWhere(
  workspaceId: string,
  filters: Pick<Prisma.TrainingRoutineAssignmentWhereInput, "studentId" | "routineId" | "active"> = {},
): Prisma.TrainingRoutineAssignmentWhereInput {
  if (!workspaceId.trim()) throw new Error("Workspace requerido.");
  return {
    ...filters,
    student: { workspaceId },
    routine: { workspaceId },
  };
}

export function followUpRecordBelongsToWorkspace(
  workspaceId: string,
  record: { studentWorkspaceId: string; routineWorkspaceId: string },
) {
  return record.studentWorkspaceId === workspaceId
    && record.routineWorkspaceId === workspaceId;
}
