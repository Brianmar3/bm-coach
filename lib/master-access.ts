export type MasterEntryDestination = "/platform/trainers" | "/dashboard" | "/portal" | null;

export function masterEntryDestination(input: {
  platformOwnerValid: boolean;
  trainerValid: boolean;
  studentValid: boolean;
}): MasterEntryDestination {
  if (input.platformOwnerValid) return "/platform/trainers";
  if (input.trainerValid) return "/dashboard";
  if (input.studentValid) return "/portal";
  return null;
}
