export function isPlatformOwner(role: string | null | undefined) {
  return role === "PLATFORM_OWNER";
}

export function invitationIsUsable(invitation: { status: string; expiresAt: Date; acceptedAt: Date | null }, now = new Date()) {
  return invitation.status === "PENDING" && invitation.acceptedAt === null && invitation.expiresAt > now;
}

export function trainerWorkspaceSlug(label: string, suffix: string) {
  const base = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "entrenador";
  return `${base}-${suffix.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12)}`;
}
