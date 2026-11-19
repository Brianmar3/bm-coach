export type QuickStudentRow = { firstName: string; lastName: string; phone: string };
export const quickStudentNameKey = (row: Pick<QuickStudentRow, "firstName" | "lastName">) => `${row.firstName} ${row.lastName}`.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/\s+/g, " ");
export const quickStudentPhoneKey = (phone: string | undefined) => (phone ?? "").replace(/\D/g, "");
export const quickStudentBatchFits = (limit: number | null, active: number, pending: number, incoming: number) => limit === null || active + pending + incoming <= limit;

export function parseQuickStudentLine(line: string): QuickStudentRow {
  const parts = line.trim().split(/\s*[,;|\t]\s*/);
  let phone = parts.length > 1 ? parts.pop()!.trim() : "";
  let name = parts.join(" ").trim().replace(/\s+/g, " ");
  if (!phone) {
    const trailing = /^(.*?)\s+(\+?[\d()\-\s]{6,24})$/.exec(name);
    if (trailing && quickStudentPhoneKey(trailing[2]).length >= 6) { name = trailing[1]; phone = trailing[2].trim(); }
  }
  const words = name.split(" ").filter(Boolean);
  return { firstName: words[0] ?? "", lastName: words.slice(1).join(" "), phone };
}

export function quickStudentIssue(row: QuickStudentRow, existing: QuickStudentRow[], selected: QuickStudentRow[] = []) {
  if (!row.firstName.trim() || !row.lastName.trim()) return "Ingresá nombre y apellido.";
  if (row.phone && !/^\+?[\d\s()\-]{6,24}$/.test(row.phone)) return "El teléfono no es válido.";
  const same = (other: QuickStudentRow) => quickStudentNameKey(other) === quickStudentNameKey(row) || Boolean(quickStudentPhoneKey(row.phone) && quickStudentPhoneKey(other.phone) === quickStudentPhoneKey(row.phone));
  if (existing.some(same)) return "Posible duplicado de un alumno existente.";
  if (selected.some(same)) return "Posible duplicado en esta carga.";
  return null;
}
