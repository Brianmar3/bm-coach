export type TrainerSessionIdentity = {
  status: string;
  memberships: Array<{
    role: string;
    status: string;
    workspace: { status: string; type: string };
  }>;
};

export function trainerIdentityHasWorkspaceAccess(identity: TrainerSessionIdentity | null | undefined) {
  if (!identity || identity.status !== "ACTIVE") return false;
  const eligible = identity.memberships.filter((membership) =>
    membership.status === "ACTIVE"
    && membership.workspace.status === "ACTIVE"
    && membership.workspace.type === "PROFESSIONAL"
    && (membership.role === "OWNER" || membership.role === "COACH"));
  return eligible.length === 1;
}
