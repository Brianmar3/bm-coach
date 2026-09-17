/** Authorization policy shared by request helpers and isolation tests. */
export type TrainerMembership = {
  userId: string;
  workspaceId: string;
  role: string;
  status: string;
  user: { status: string };
  workspace: { status: string; type: string };
};

export const WORKSPACE_RESOURCE_NOT_FOUND = "WORKSPACE_RESOURCE_NOT_FOUND";

export class WorkspaceResourceNotFoundError extends Error {
  readonly code = WORKSPACE_RESOURCE_NOT_FOUND;

  constructor() {
    super("Recurso no disponible.");
    this.name = "WorkspaceResourceNotFoundError";
  }
}

export function isWorkspaceResourceNotFound(error: unknown) {
  return error instanceof WorkspaceResourceNotFoundError
    || (typeof error === "object" && error !== null && "code" in error && error.code === WORKSPACE_RESOURCE_NOT_FOUND);
}

export function authorizedTrainerWorkspace(userId: string, memberships: TrainerMembership[]) {
  const eligible = memberships.filter((membership) => membership.userId === userId
    && membership.status === "ACTIVE" && membership.user.status === "ACTIVE"
    && membership.workspace.status === "ACTIVE" && membership.workspace.type === "PROFESSIONAL"
    && (membership.role === "OWNER" || membership.role === "COACH"));
  if (eligible.length !== 1) throw new Error("No hay un workspace de entrenador inequívoco y autorizado.");
  return { userId, workspaceId: eligible[0].workspaceId };
}

export function studentWorkspaceWhere(workspaceId: string) {
  if (!workspaceId?.trim()) throw new Error("Workspace requerido.");
  return { workspaceId };
}

export function assertSameWorkspace(workspaceId: string, record: { workspaceId: string | null } | null) {
  if (!workspaceId || !record || record.workspaceId !== workspaceId) throw new WorkspaceResourceNotFoundError();
}

export function accessibleContentWhere(workspaceId: string) {
  if (!workspaceId?.trim()) throw new Error("Workspace requerido.");
  return { OR: [{ scope: "GLOBAL" as const }, { scope: "WORKSPACE" as const, workspaceId }] };
}

export function assertWritableWorkspaceContent(workspaceId: string, record: { workspaceId: string | null; scope: string } | null) {
  if (!record || record.scope !== "WORKSPACE" || record.workspaceId !== workspaceId) throw new WorkspaceResourceNotFoundError();
}
