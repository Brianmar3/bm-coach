import { getPortalSession } from "@/lib/portal-auth";
import { loadPointRanking } from "@/lib/point-ranking";

export async function GET() {
  const session = await getPortalSession();
  if (!session) return Response.json({ error: "Sesión no válida." }, { status: 401 });
  if (session.credential.mustChangePassword) return Response.json({ error: "Debés cambiar tu contraseña temporal." }, { status: 403 });

  const ranking = await loadPointRanking("month");
  const currentIndex = ranking.findIndex((entry) => entry.studentId === session.studentId);
  return Response.json({
    period: "month",
    currentStudentId: session.studentId,
    currentPosition: currentIndex >= 0 ? currentIndex + 1 : null,
    currentPoints: currentIndex >= 0 ? ranking[currentIndex].total : 0,
    ranking: ranking.map(({ studentId, studentName, total }) => ({ studentId, studentName, total })),
  });
}

