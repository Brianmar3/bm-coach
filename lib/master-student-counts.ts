import { countActiveManagedStudents } from './trainer-plan-limits.ts';
export function masterStudentCounts(records: Array<{ data: unknown }>) {
 const managed = records.filter(({data}) => !(data && typeof data === 'object' && (data as Record<string, unknown>).accountType === 'SELF_SERVICE'));
 const active = countActiveManagedStudents(managed);
 return { total: managed.length, active, inactive: managed.length - active };
}
export function masterWorkspaceTotals(workspaces: Array<{ id: string; students: Array<{ data: unknown }> }>) {
 const unique = new Map(workspaces.map(workspace => [workspace.id, workspace]));
 return [...unique.values()].reduce((sum, workspace) => {
  const counts = masterStudentCounts(workspace.students);
  return { total:sum.total + counts.total, active:sum.active + counts.active, inactive:sum.inactive + counts.inactive };
 }, { total:0, active:0, inactive:0 });
}
