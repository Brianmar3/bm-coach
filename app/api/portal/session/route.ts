import { getPortalSession } from "@/lib/portal-auth";
import type { Student } from "@/types/gestion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getPortalSession();
  if (!session) return Response.json({ authenticated: false }, { status: 401 });
  const student = session.credential.student.data as unknown as Student;
  return Response.json({ authenticated: true, mustChangePassword: session.credential.mustChangePassword, student: { id: session.studentId, firstName: student.firstName, lastName: student.lastName } });
}
