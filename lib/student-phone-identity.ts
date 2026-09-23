export type StudentPhoneRecord = {
  id: string;
  workspaceId: string;
  phoneNormalized: string | null;
  data: unknown;
};

function legacyPhone(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return "";
  const phone = (data as Record<string, unknown>).phone;
  return typeof phone === "string" ? phone.replace(/\D/g, "") : "";
}

export function findWorkspacePhoneDuplicate(
  records: StudentPhoneRecord[],
  workspaceId: string,
  normalizedPhone: string,
  excludeId?: string,
) {
  if (!workspaceId || !normalizedPhone) return null;
  return records.find((record) =>
    record.workspaceId === workspaceId &&
    record.id !== excludeId &&
    (record.phoneNormalized === normalizedPhone || legacyPhone(record.data) === normalizedPhone)
  ) ?? null;
}
