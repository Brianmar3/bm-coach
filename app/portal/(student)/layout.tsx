import type { ReactNode } from "react";
import { requirePortalPageSession } from "@/lib/portal-auth";
import { PortalShell } from "@/componentes/portal-shell";
import type { Student } from "@/types/gestion";

export default async function StudentPortalLayout({ children }: { children: ReactNode }) {
  const session = await requirePortalPageSession();
  const student = session.credential.student.data as unknown as Student;
  return <PortalShell studentName={`${student.firstName} ${student.lastName}`.trim()}>{children}</PortalShell>;
}
