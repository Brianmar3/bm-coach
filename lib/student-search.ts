export type SearchableStudent = { id: string; firstName: string; lastName: string };

export function normalizeStudentSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
}

export function searchStudents<T extends SearchableStudent>(students: T[], query: string, selectedIds: string[], limit = 8) {
  const normalized = normalizeStudentSearch(query);
  if (!normalized) return [];
  const selected = new Set(selectedIds);
  return students
    .filter((student) => !selected.has(student.id) && normalizeStudentSearch(`${student.firstName} ${student.lastName}`).includes(normalized))
    .slice(0, limit);
}
