export type PortalStudentIdentity = { studentId: string; workspaceId: string };

export function resolvePortalStudentIdentity(session: {
  studentId: string;
  credential: { student: { id: string; workspaceId: string | null } };
}): PortalStudentIdentity | null {
  const student = session.credential.student;
  if (!session.studentId || student.id !== session.studentId || !student.workspaceId) return null;
  return { studentId: session.studentId, workspaceId: student.workspaceId };
}
